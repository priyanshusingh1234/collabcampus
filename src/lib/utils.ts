import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Resolve a user's document id in /users given their auth uid
// Some projects store users with arbitrary doc IDs; this helper queries by uid field.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function resolveUserDocId(uid: string): Promise<string | null> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
    return snap.docs[0]?.id || null;
  } catch {
    return null;
  }
}
