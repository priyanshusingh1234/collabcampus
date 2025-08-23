"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  endAt,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  startAt,
} from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedTick } from "@/components/ui/VerifiedTick";

type UserLite = {
  uid?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  verified?: boolean;
};

async function searchUsers(usernameQuery: string, take = 8): Promise<UserLite[]> {
  if (!usernameQuery || !db) return [];
  const usersCol = collection(db, "users");
  const qLower = usernameQuery.trim().toLowerCase();

  // Primary: case-insensitive via usernameLower prefix
  const queries = [
    query(
      usersCol,
      orderBy("usernameLower"),
      startAt(qLower),
      endAt(qLower + "\uf8ff"),
      fbLimit(take)
    ),
    // Fallback: case-sensitive using username field (covers older docs without usernameLower)
    query(
      usersCol,
      orderBy("username"),
      startAt(usernameQuery),
      endAt(usernameQuery + "\uf8ff"),
      fbLimit(take)
    ),
  ];

  const results: UserLite[] = [];
  const seen = new Set<string>();
  for (const qq of queries) {
    try {
      const snap = await getDocs(qq);
      for (const d of snap.docs) {
        const data = d.data() as any;
        const key = data.uid || d.id;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          uid: data.uid || d.id,
          username: data.username,
          displayName: data.displayName || data.username,
          avatarUrl: data.avatarUrl,
          verified: !!data.verified,
        });
      }
      if (results.length >= take) break;
    } catch (e) {
      // Ignore specific query failures (e.g., missing index/field) and try next
      continue;
    }
  }

  return results.slice(0, take);
}

export function UserSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserLite[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced search
  useEffect(() => {
    let timer: any;
    if (q.trim().length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer = setTimeout(async () => {
      try {
        const r = await searchUsers(q, 8);
        setResults(r);
        setOpen(true);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const onEnter = () => {
    const sel = results[active];
    if (!sel?.username) return;
    setOpen(false);
    router.push(`/user/${sel.username}`);
  };

  const showClear = useMemo(() => q.length > 0, [q]);

  return (
    <div ref={wrapRef} className={cn("relative w-full md:w-80", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search users by username"
          className="w-full h-9 rounded-md border bg-background pl-9 pr-8 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {loading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : showClear ? (
          <button
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
            onClick={() => { setQ(""); setResults([]); setOpen(false); }}
          >
            ✕
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <ul className="max-h-80 overflow-auto divide-y">
            {results.map((u, i) => (
              <li key={`${u.uid}-${i}`}>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground",
                    i === active && "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    setOpen(false);
                    if (u.username) router.push(`/user/${u.username}`);
                  }}
                >
                  <Avatar className="h-8 w-8">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.username || u.displayName || "User"} />
                    ) : (
                      <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-sm font-medium truncate">
                      <span className="truncate">{u.displayName || u.username}</span>
                      {u.verified && <VerifiedTick size={12} />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
