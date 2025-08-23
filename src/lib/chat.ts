import { doc, getDoc, setDoc, serverTimestamp, updateDoc, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BasicUser = {
  uid: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};

export type ConversationDoc = {
  id: string;
  participantIds: [string, string];
  participants: Record<string, { uid: string; username?: string | null; displayName?: string | null; avatarUrl?: string | null }>;
  createdAt: any;
  updatedAt: any;
  lastMessage?: {
    text?: string;
    senderId: string;
    createdAt: any;
  } | null;
  typing?: Record<string, boolean>;
  lastReadAt?: Record<string, any>;
};

export function getConversationId(a: string, b: string): string {
  return [a, b].sort().join("__");
}

export function getConversationRef(uid1: string, uid2: string): DocumentReference {
  const id = getConversationId(uid1, uid2);
  return doc(db, "conversations", id);
}

export async function ensureConversation(uid1: string, user1: BasicUser, uid2: string, user2: BasicUser) {
  const ref = getConversationRef(uid1, uid2);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const toStore = (u: BasicUser) => ({
      uid: u.uid,
      username: u.username ?? null,
      displayName: u.displayName ?? null,
      avatarUrl: u.avatarUrl ?? null,
    });
    const participants: ConversationDoc["participants"] = {
      [user1.uid]: toStore(user1),
      [user2.uid]: toStore(user2),
    };
    await setDoc(ref, {
      participantIds: [user1.uid, user2.uid].sort(),
      participants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      typing: { [user1.uid]: false, [user2.uid]: false },
      lastReadAt: {},
    } as Omit<ConversationDoc, "id">);
  }
  return ref;
}

export async function setTyping(conversationId: string, uid: string, value: boolean) {
  const ref = doc(db, "conversations", conversationId);
  await updateDoc(ref, { [`typing.${uid}`]: value, updatedAt: serverTimestamp() });
}

export async function updateLastRead(conversationId: string, uid: string) {
  const ref = doc(db, "conversations", conversationId);
  await updateDoc(ref, { [`lastReadAt.${uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setLastMessage(conversationId: string, payload: { text?: string; senderId: string }) {
  const ref = doc(db, "conversations", conversationId);
  await updateDoc(ref, {
    lastMessage: { text: payload.text || "", senderId: payload.senderId, createdAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}
