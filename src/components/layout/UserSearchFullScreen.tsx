"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, endAt, getDocs, limit as fbLimit, orderBy, query, startAt, where } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedTick } from "@/components/ui/VerifiedTick";

type UserLite = {
  uid?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  verified?: boolean;
};

async function searchUsers(usernameQuery: string, take = 20): Promise<UserLite[]> {
  if (!usernameQuery || !db) return [];
  const usersCol = collection(db, "users");
  const qLower = usernameQuery.trim().toLowerCase();
  const queries = [
    query(usersCol, orderBy("usernameLower"), startAt(qLower), endAt(qLower + "\uf8ff"), fbLimit(take)),
    query(usersCol, orderBy("username"), startAt(usernameQuery), endAt(usernameQuery + "\uf8ff"), fbLimit(take))
  ];
  const out: UserLite[] = []; const seen = new Set<string>();
  for (const qq of queries) {
    try {
      const snap = await getDocs(qq);
      for (const d of snap.docs) {
        const data = d.data() as any;
        const key = data.uid || d.id; if (seen.has(key)) continue; seen.add(key);
        out.push({ uid: data.uid || d.id, username: data.username, displayName: data.displayName || data.username, avatarUrl: data.avatarUrl, verified: !!data.verified });
      }
      if (out.length >= take) break;
    } catch {}
  }
  return out.slice(0, take);
}

async function getSuggestedUsers(take = 12): Promise<UserLite[]> {
  if (!db) return [];
  const users = collection(db, "users");
  try {
    const snap = await getDocs(query(users, where("verified", "==", true), fbLimit(take)));
    return snap.docs.map(d => {
      const x = d.data() as any;
      return { uid: x.uid || d.id, username: x.username, displayName: x.displayName || x.username, avatarUrl: x.avatarUrl, verified: !!x.verified };
    });
  } catch {
    const snap = await getDocs(query(users, orderBy("usernameLower"), fbLimit(take)));
    return snap.docs.map(d => {
      const x = d.data() as any;
      return { uid: x.uid || d.id, username: x.username, displayName: x.displayName || x.username, avatarUrl: x.avatarUrl, verified: !!x.verified };
    });
  }
}

export default function UserSearchFullScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserLite[]>([]);
  const [suggested, setSuggested] = useState<UserLite[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { getSuggestedUsers().then(setSuggested).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  useEffect(() => {
    let timer: any;
    if (q.trim().length === 0) { setResults([]); return; }
    setLoading(true);
    timer = setTimeout(async () => {
      try { const r = await searchUsers(q, 20); setResults(r); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const list = (items: UserLite[]) => (
    <ul className="divide-y">
      {items.map((u, i) => (
        <li key={`${u.uid}-${i}`}>
          <button
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-accent/50"
            onClick={() => { if (u.username) router.push(`/user/${u.username}`); }}
          >
            <Avatar className="h-9 w-9">
              {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.username || u.displayName || "User"} /> : <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>}
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-medium truncate">
                <span className="truncate">{u.displayName || u.username}</span>
                {u.verified && <VerifiedTick size={12} />}
              </div>
              <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="h-screen w-screen bg-background flex flex-col">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by username" className="w-full h-11 rounded-md border bg-background pl-9 pr-10 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
          {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {q.trim().length > 0 ? (
          results.length > 0 ? (
            list(results)
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No users found for “{q}”.</div>
          )
        ) : (
          <div>
            <div className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Suggested Users</div>
            {list(suggested)}
          </div>
        )}
      </div>
    </div>
  );
}
