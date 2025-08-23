import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type PresenceDoc = {
  uid: string;
  state: "online" | "offline";
  lastActive: any;
  updatedAt: any;
};

export function presenceRef(uid: string) {
  return doc(db, "presence", uid);
}

export async function setOnline(uid: string) {
  const ref = presenceRef(uid);
  await setDoc(ref, { uid, state: "online", lastActive: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
}

export async function heartbeat(uid: string) {
  const ref = presenceRef(uid);
  await updateDoc(ref, { state: "online", lastActive: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function subscribePresence(uid: string, cb: (doc: PresenceDoc | null) => void) {
  return onSnapshot(presenceRef(uid), (snap) => {
    if (!snap.exists()) return cb(null);
    cb(snap.data() as PresenceDoc);
  });
}
