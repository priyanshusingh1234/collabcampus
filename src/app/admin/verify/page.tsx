"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, where, doc } from "firebase/firestore";
import { ADMIN_EMAILS } from "@/lib/verification";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthState } from "react-firebase-hooks/auth";
import { awardFollowerBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";

export default function AdminVerifyPage() {
  const [user, loading] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [checking, setChecking] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // wait for auth
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    // Gate: check email against ADMIN_EMAILS or a flag in the DB
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
        const data = snap.docs[0]?.data();
        const emailAllowed = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());
  const allowed = emailAllowed || !!data?.verifiedByAdmin;
        setIsAdmin(allowed);
        if (allowed) {
          const us = await getDocs(query(collection(db, "users")));
          setUsers(us.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [loading, user, router]);

  if (loading || checking) {
    return <div className="container py-10">Checking admin access…</div>;
  }

  if (!isAdmin) {
    return <div className="container py-10">Access denied. Admins only.</div>;
  }

  const toggleVerify = async (userId: string, current: boolean) => {
    const ref = doc(db, "users", userId);
    await updateDoc(ref, { verifiedByAdmin: !current, verified: !current, verifiedAt: new Date() });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, verifiedByAdmin: !current, verified: !current } : u)));
  };

  const backfillFollowerStats = async () => {
    setBackfillMsg(null);
    setBackfilling(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      let updated = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const followersLen = Array.isArray(data?.followers) ? data.followers.length : 0;
        const followingLen = Array.isArray(data?.following) ? data.following.length : 0;
        await updateDoc(doc(db, "users", d.id), {
          "stats.followers": followersLen,
          "stats.following": followingLen,
        });
        try {
          await awardFollowerBadges({ userRef: doc(db, "users", d.id), currentBadges: data?.badges || [], nextFollowerCount: followersLen });
          await recomputeVerificationFromSnapshot(doc(db, "users", d.id));
        } catch {}
        updated++;
      }
      setBackfillMsg(`Backfilled ${updated} users.`);
      // Refresh list
      const us = await getDocs(query(collection(db, "users")));
      setUsers(us.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e: any) {
      setBackfillMsg(`Backfill failed: ${e?.message || e}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="container py-10 space-y-6">
      <h1 className="text-2xl font-bold">Admin Verification</h1>
      <div className="flex items-center gap-3">
        <Button onClick={backfillFollowerStats} disabled={backfilling} variant="secondary">
          {backfilling ? "Backfilling…" : "Backfill follower/following stats"}
        </Button>
        {backfillMsg && <span className="text-sm text-muted-foreground">{backfillMsg}</span>}
      </div>
      <div className="grid gap-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded border p-3">
            <div className="flex items-center gap-3">
              <img src={u.avatarUrl} alt={u.username} className="w-8 h-8 rounded-full" />
              <div>
                <div className="font-medium">{u.username}</div>
                <div className="text-xs text-muted-foreground">Followers: {u?.stats?.followers || 0} · Following: {u?.stats?.following || 0} · Answers: {u?.stats?.answers || 0}</div>
              </div>
            </div>
            <Button onClick={() => toggleVerify(u.id, !!u.verified)} variant={u.verified ? "secondary" : "default"}>
              {u.verified ? "Unverify" : "Verify"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
