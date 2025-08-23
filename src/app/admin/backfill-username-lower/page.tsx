"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { collection, doc, getDocs, limit, query, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";

export default function BackfillUsernameLower() {
  const [user] = useAuthState(auth);
  const [count, setCount] = useState<number | null>(null);
  const [processed, setProcessed] = useState(0);
  const [running, setRunning] = useState(false);

  if (!user) return <div className="p-6">Please sign in.</div>;

  // Very light allowlist: reuse the same admin email as elsewhere if available
  const adminEmails = ["pkkpk2222@outlook.com"]; // keep in sync with verification allowlist
  const isAdmin = adminEmails.includes(user.email || "");
  if (!isAdmin) return <div className="p-6">Admins only.</div>;

  async function runBackfill() {
    setRunning(true);
    try {
      const usersCol = collection(db, "users");
      const snap = await getDocs(query(usersCol));
      setCount(snap.size);
      let done = 0;
      for (const d of snap.docs) {
        const data = d.data() as any;
        const username: string = data.username || "";
        const lower: string = data.usernameLower || "";
        if (username && !lower) {
          await updateDoc(doc(db, "users", d.id), {
            usernameLower: username.toLowerCase(),
          });
        }
        done++;
        setProcessed(done);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Backfill usernameLower</h1>
      <p className="text-sm text-muted-foreground">Fill missing usernameLower for case-insensitive user search.</p>
      <div className="text-sm">Users scanned: {processed}{count !== null ? ` / ${count}` : ""}</div>
      <Button disabled={running} onClick={runBackfill}>{running ? "Running..." : "Run backfill"}</Button>
    </div>
  );
}
