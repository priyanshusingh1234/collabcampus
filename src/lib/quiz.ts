import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';

export type QuizQuestion = {
  id?: string;
  text: string;
  choices: string[]; // 2-6 options
  answerIndex: number; // index in choices
  explanation?: string;
  // UI/settings for builder (optional)
  required?: boolean;
  shuffle?: boolean;
  allowOther?: boolean;
  allowComment?: boolean;
  defaultChoiceIndex?: number | null;
};

export type Quiz = {
  id?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  createdBy: { uid: string; username?: string };
  visibility: 'public' | 'unlisted';
  // Optional metadata
  category?: string; // e.g., "Trivia", "History", etc.
  // Optional banner image stored via ImageKit
  bannerImageUrl?: string;
  bannerImageFileId?: string;
  bannerImageFilePath?: string;
  createdAt?: any;
};

export async function createQuiz(q: Omit<Quiz, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'quizzes'), { ...q, createdAt: serverTimestamp() });
}

export async function getQuiz(id: string) {
  const d = await getDoc(doc(db, 'quizzes', id));
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data() as any) } as Quiz;
}

export async function getRecentQuizzes(limitN = 10) {
  const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Quiz[];
}

export async function getQuizzesByUser(uid: string, limitN = 50) {
  // Avoid requiring a composite index by not combining where + orderBy here; sort client-side instead
  const q = query(collection(db, 'quizzes'), where('createdBy.uid', '==', uid), limit(limitN));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Quiz[];
  // Sort by createdAt desc if present
  return list.sort((a, b) => {
    const ta = (a as any)?.createdAt?.toMillis?.() || 0;
    const tb = (b as any)?.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
}

export type QuizAttempt = { uid: string; username?: string; score: number; total: number; createdAt?: any };

export async function saveAttempt(quizId: string, attempt: Omit<QuizAttempt, 'createdAt'>) {
  // Remove previous attempts by this user for this quiz to keep only the latest
  const attemptsRef = collection(db, 'quizzes', quizId, 'attempts');
  const existing = await getDocs(query(attemptsRef, where('uid', '==', attempt.uid)));
  if (!existing.empty) {
    const docs = existing.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + 450)) batch.delete(d.ref);
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  }
  return await addDoc(attemptsRef, { ...attempt, createdAt: serverTimestamp() });
}

export async function getTopAttempts(quizId: string, limitN = 5) {
  const q = query(collection(db, 'quizzes', quizId, 'attempts'), orderBy('score', 'desc'), orderBy('createdAt', 'asc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as (QuizAttempt & { id: string })[];
}

export async function deleteQuiz(quizId: string) {
  // Read quiz first to find any assets to cleanup (e.g., banner)
  const quizDocRef = doc(db, 'quizzes', quizId);
  const quizDoc = await getDoc(quizDocRef);

  // delete attempts in batches
  const attemptsSnap = await getDocs(collection(db, 'quizzes', quizId, 'attempts'));
  if (!attemptsSnap.empty) {
    const docs = attemptsSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + 450)) batch.delete(d.ref);
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  }

  // Delete banner asset if exists
  try {
    const data = quizDoc.exists() ? (quizDoc.data() as Quiz) : null;
    const fileId = (data as any)?.bannerImageFileId as string | undefined;
    if (fileId) {
      await fetch('/api/imagekit/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
    }
  } catch (err) {
    console.warn('Failed to delete quiz banner asset (continuing):', err);
  }

  await deleteDoc(quizDocRef);
}