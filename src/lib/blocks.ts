import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BlockListDoc = {
  uid: string;
  blocked: string[];
  updatedAt?: any;
};

export async function isBlocked(byUid: string, targetUid: string): Promise<boolean> {
  const ref = doc(db, "blocks", byUid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as BlockListDoc) : null;
  return !!data?.blocked?.includes(targetUid);
}

export async function toggleBlock(byUid: string, targetUid: string, value: boolean) {
  const ref = doc(db, "blocks", byUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid: byUid, blocked: value ? [targetUid] : [], updatedAt: new Date() });
    return;
  }
  await updateDoc(ref, {
    blocked: value ? arrayUnion(targetUid) : arrayRemove(targetUid),
    updatedAt: new Date(),
  });
}
