import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Optional: list of admin emails for manual verification toggles
export const ADMIN_EMAILS: string[] = [
  "pkkpk2222@outlook.com",
];
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function calculateVerificationScore(user: any): number {
  const followers = Number(user?.stats?.followers || 0);
  const posts = Number(user?.stats?.posts || 0);
  const answers = Number(user?.stats?.answers || 0);
  const badges: string[] = Array.isArray(user?.badges) ? user.badges : [];

  let score = 0;
  // Followers heavy weight
  score += Math.min(followers, 1000) / 1000 * 70; // up to 70 pts
  // Content signals
  score += Math.min(posts, 20) / 20 * 5; // up to 5
  score += Math.min(answers, 200) / 200 * 20; // up to 20
  // Badges signals
  if (badges.includes("Answer Master (100)")) score += 10;
  if (badges.includes("Published 20 Posts")) score += 4;
  if (badges.includes("Curiosity Champion (50)")) score += 3;

  return Math.round(score);
}

export async function maybeUpdateVerificationByUid(uid: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  const newStatus = determineVerified(data);
  if ((data as any)?.verified === newStatus) return false;
  await updateDoc(userRef, { verified: newStatus, verifiedAt: new Date() });
  return true;
}

export function determineVerified(user: any): boolean {
  // Sticky verification logic:
  // - Admin override always verifies the user
  // - If user.verified is already true, keep it true (do not downgrade on incidental recomputes)
  //   Admin tools explicitly toggle verified to false when needed.
  const adminOverride = !!user?.verifiedByAdmin;
  const current = !!user?.verified;
  return adminOverride || current;
}

export async function recomputeVerificationFromSnapshot(userRef: any) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;
  const user: any = snap.data();
  const next = determineVerified(user);
  if ((user && user.verified) !== next) {
    await updateDoc(userRef, { verified: next, verifiedAt: new Date() });
    return true;
  }
  return false;
}
