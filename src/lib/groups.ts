import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Group } from '@/app/types/group';
import { createNotification } from '@/lib/notifications';

// 🔧 Helper to remove undefined fields
function cleanData<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

// ✅ Create a new group (fixed)
export async function createGroup(groupData: Omit<Group, 'id' | 'createdAt'>) {
  const cleanGroup = cleanData(groupData);

  const groupRef = await addDoc(collection(db, 'groups'), {
    ...cleanGroup,
    createdAt: serverTimestamp(),
  members: groupData.createdBy ? [groupData.createdBy] : [],
  admins: groupData.createdBy ? [groupData.createdBy, ...(Array.isArray((groupData as any).admins) ? (groupData as any).admins : [])] : (Array.isArray((groupData as any).admins) ? (groupData as any).admins : []),
  });

  return groupRef.id;
}

// ✅ Get a single group by ID
export async function getGroupById(groupId: string) {
  const docRef = doc(db, 'groups', groupId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// ✅ Get all groups
export async function getAllGroups() {
  const snapshot = await getDocs(collection(db, 'groups'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ✅ Join a group
export async function joinGroup(groupId: string, userId: string) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayUnion(userId),
  });
}

// ✅ Leave a group
export async function leaveGroup(groupId: string, userId: string) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayRemove(userId),
  });
}

// ✅ Request to join a group
export async function requestToJoin(groupId: string, userId: string) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    requests: arrayUnion(userId),
  });
}

// ✅ Approve a pending request (admin/owner only)
export async function approveRequest(groupId: string, userId: string) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    requests: arrayRemove(userId),
    members: arrayUnion(userId),
  });
}

// ✅ Promote/demote admin
export async function toggleAdmin(groupId: string, userId: string, makeAdmin: boolean) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, makeAdmin ? { admins: arrayUnion(userId) } : { admins: arrayRemove(userId) });
}

// ✅ Add announcement
export async function addAnnouncement(groupId: string, message: string, authorId: string) {
  const groupRef = doc(db, 'groups', groupId);
  const g = await getDoc(groupRef);
  const data = (g.exists() ? (g.data() as any) : {}) as any;
  const members: string[] = Array.isArray(data.members) ? data.members.filter(Boolean) : [];
  // Avoid serverTimestamp() inside arrayUnion payload; use Timestamp.now() to prevent Firestore error
  const item = { id: crypto.randomUUID?.() || `${Date.now()}`, message, createdAt: Timestamp.now(), author: authorId };
  await updateDoc(groupRef, { announcements: arrayUnion(item) });

  // Notify all members except the author
  const recipients = members.filter((m) => m && m !== authorId);
  const url = `/groups/${groupId}`;
  await Promise.all(
    recipients.map((uid) =>
      createNotification(uid, {
        type: 'system',
        title: 'New group announcement',
        body: message,
        url,
        from: { uid: authorId },
      }).catch(() => {})
    )
  );

  // Also drop a system message into the group chat
  try {
    await addDoc(collection(db, 'groups', groupId, 'messages'), {
      text: `📢 ${message}`,
      senderId: authorId,
      senderName: 'Announcement',
      timestamp: serverTimestamp(),
      kind: 'announcement',
    });
  } catch {
    // non-fatal
  }
  return item;
}
