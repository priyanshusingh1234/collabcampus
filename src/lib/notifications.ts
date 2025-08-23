import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

export type AppNotification = {
  type: 'mention' | 'system';
  title: string;
  body?: string;
  url?: string;
  from?: { uid: string; username?: string; avatarUrl?: string };
  read?: boolean;
  createdAt?: any;
  recipientUid?: string; // used for top-level fallback
};

// Extract @mentions from plain text/HTML
export function extractMentions(input: string): string[] {
  if (!input) return [];
  // Remove HTML tags to avoid catching @ in attributes
  const text = input.replace(/<[^>]*>/g, ' ');
  const regex = /@([a-zA-Z0-9_.-]{3,32})/g;
  const matches = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
  matches.add(m[1]);
  }
  return Array.from(matches);
}

export async function resolveUsernamesToUids(usernames: string[]): Promise<
  Array<{ uid: string; username: string; avatarUrl?: string }>
> {
  const results: Array<{ uid: string; username: string; avatarUrl?: string }> = [];
  if (!usernames.length) return results;

  // Firestore 'in' supports up to 10 items; chunk if needed
  const needles = Array.from(new Set<string>([
    ...usernames,
    ...usernames.map((u) => u.toLowerCase()),
  ]));
  const chunks: string[][] = [];
  for (let i = 0; i < needles.length; i += 10) {
    chunks.push(needles.slice(i, i + 10));
  }
  for (const c of chunks) {
    const q = query(collection(db, 'users'), where('username', 'in', c));
    const snap = await getDocs(q);
    snap.forEach((doc) => {
      const d = doc.data() as any;
      if (d?.uid && d?.username) {
        results.push({ uid: d.uid, username: d.username, avatarUrl: d.avatarUrl });
      }
    });
  }
  return results;
}

export async function createNotification(
  recipientUid: string,
  payload: AppNotification
) {
  const docData = {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  } as any;
  try {
    // Resolve actual user document id (some projects key users by arbitrary ids, not uid)
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', recipientUid)));
    const docId = snap.docs[0]?.id || null;
    if (docId) {
      const col = collection(db, 'users', docId, 'notifications');
      await addDoc(col, docData);
      return;
    }
  } catch (err) {
    // continue to fallback
  }
  // Fallback: top-level notifications collection
  await addDoc(collection(db, 'notifications'), {
    ...docData,
    recipientUid,
  });
}

export async function notifyMentions(options: {
  from: { uid: string; username?: string; avatarUrl?: string };
  text: string;
  title: string;
  url: string;
}) {
  const { from, text, title, url } = options;
  const mentions = extractMentions(text);
  if (!mentions.length) return;

  const users = await resolveUsernamesToUids(mentions);
  // Avoid notifying the author themselves and duplicates
  const uniqueRecipients = new Set(users.map((u) => u.uid).filter((uid) => uid !== from.uid));

  const notifTitle = `${from.username || 'Someone'} mentioned you`;
  const body = title;

  await Promise.all(
    Array.from(uniqueRecipients).map(async (uid) => {
      try {
        await createNotification(uid, {
          type: 'mention',
          title: notifTitle,
          body,
          url,
          from,
        });
      } catch (e) {
        // ignore to avoid blocking main flow
        console.warn('notifyMentions: failed for', uid, e);
      }
    })
  );
}

// Notify both the author's followers and the users the author follows when the author posts something
export async function notifyFollowersAndFollowingOfActivity(options: {
  authorUid: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  title: string;
  url: string;
  kind: 'post' | 'question';
}) {
  const { authorUid, authorUsername, authorAvatarUrl, title, url, kind } = options;
  // Fetch author profile to get followers/following arrays
  let followers: string[] = [];
  let following: string[] = [];
  try {
    // Prefer direct doc by uid
    const authorDocs = await getDocs(query(collection(db, 'users'), where('uid', '==', authorUid)));
    const d = authorDocs.docs[0]?.data() as any;
    if (d) {
      followers = Array.isArray(d.followers) ? d.followers.filter(Boolean) : [];
      following = Array.isArray(d.following) ? d.following.filter(Boolean) : [];
    }
  } catch {}

  const recipients = new Set<string>();
  for (const uid of followers) if (uid && uid !== authorUid) recipients.add(uid);
  for (const uid of following) if (uid && uid !== authorUid) recipients.add(uid);

  if (recipients.size === 0) return;

  const from = { uid: authorUid, username: authorUsername, avatarUrl: authorAvatarUrl };
  const notifTitle = `${authorUsername || 'Someone'} posted a new ${kind}`;
  const body = title;

  await Promise.all(
    Array.from(recipients).map(async (uid) => {
      try {
        await createNotification(uid, {
          type: 'system',
          title: notifTitle,
          body,
          url,
          from,
        });
      } catch (e) {
        console.warn('notifyFollowersAndFollowingOfActivity failed for', uid, e);
      }
    })
  );
}
