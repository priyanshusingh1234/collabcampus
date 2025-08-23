"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  endAt,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  startAt,
  where,
} from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";

interface UserLite { id: string; username: string; displayName?: string; avatarUrl?: string; verified?: boolean; }

async function fetchUsers(qs: { q: string; onlyVerified: boolean; take: number; }): Promise<UserLite[]> {
  const users = collection(db, "users");
  const out: UserLite[] = [];
  const seen = new Set<string>();
  const qLower = qs.q.trim().toLowerCase();

  // Fast path: Verified-only with no query — avoid composite index by not ordering server-side
  if (qs.onlyVerified && qLower.length === 0) {
    try {
      const snap = await getDocs(query(users, where("verified", "==", true), fbLimit(qs.take)));
      for (const d of snap.docs) {
        const data = d.data() as any;
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push({ id: d.id, username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl, verified: !!data.verified });
      }
      // Optional: client-side sort by usernameLower/username
      out.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
      return out.slice(0, qs.take);
    } catch {
      // fall through to generic attempts
    }
  }

  const filters = [] as any[];
  if (qs.onlyVerified) filters.push(where("verified", "==", true));

  const attempts = [
    query(users, ...filters, orderBy("usernameLower"), startAt(qLower), endAt(qLower + "\uf8ff"), fbLimit(qs.take)),
    query(users, ...filters, orderBy("username"), startAt(qs.q), endAt(qs.q + "\uf8ff"), fbLimit(qs.take)),
  ];

  let attempted = false;
  for (const qq of attempts) {
    try {
      attempted = true;
      const snap = await getDocs(qq);
      for (const d of snap.docs) {
        const data = d.data() as any;
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push({ id: d.id, username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl, verified: !!data.verified });
      }
      if (out.length >= qs.take) break;
    } catch {
      // ignore and try next strategy
    }
  }

  // Fallback: if verified+search failed due to missing index, fetch verified and filter client-side
  if (qs.onlyVerified && out.length === 0) {
    try {
      const snap = await getDocs(query(users, where("verified", "==", true), fbLimit(100)));
      const pool: UserLite[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl, verified: !!data.verified };
      });
      const filtered = qLower
        ? pool.filter((u) => ((u.username || "").toLowerCase().startsWith(qLower)))
        : pool;
      filtered.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
      return filtered.slice(0, qs.take);
    } catch {
      // final fallback yields empty
    }
  }

  return out.slice(0, qs.take);
}

export default function UsersDirectoryPage() {
  const [q, setQ] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserLite[]>([]);

  useEffect(() => {
    let h: any;
    setLoading(true);
    h = setTimeout(async () => {
      try {
        const res = await fetchUsers({ q, onlyVerified, take: 24 });
        setItems(res);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [q, onlyVerified]);

  const hasQuery = q.trim().length > 0 || onlyVerified;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyVerified} onCheckedChange={(v) => setOnlyVerified(Boolean(v))} />
          Verified only
        </label>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>}

      {!loading && items.length === 0 && (
        <div className="text-sm text-muted-foreground">{hasQuery ? "No users found." : "Try a search by username or toggle verified."}</div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        {items.map((u) => (
          <li key={u.id}>
            <Link href={`/user/${u.username}`} className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent">
              <Avatar className="h-9 w-9">
                {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.username} /> : <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>}
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium truncate">
                  <span className="truncate">{u.displayName || u.username}</span>
                  {u.verified && <VerifiedTick size={12} />}
                </div>
                <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
