
"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel"), { ssr: false });
import { getConversationId, type BasicUser } from "@/lib/chat";
import { subscribePresence, type PresenceDoc } from "@/lib/presence";
import { useSearchParams, useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ensureConversation, type BasicUser as BasicUserType } from "@/lib/chat";

type ConversationListItem = {
  id: string;
  participants: Record<string, BasicUser>;
  participantIds: string[];
  lastMessage?: { text?: string; senderId: string; createdAt?: any } | null;
  updatedAt?: any;
  lastReadAt?: Record<string, any>;
};

function MessagesInner() {
  const [user] = useAuthState(auth);
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [filter, setFilter] = useState("");
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceDoc | null>>({});
  const [selectedOther, setSelectedOther] = useState<BasicUser | null>(null);
  const [userInfoMap, setUserInfoMap] = useState<Record<string, BasicUser>>({});
  const [meProfile, setMeProfile] = useState<(BasicUser & { isPremium?: boolean; plan?: string | null; subscription?: any; role?: string; uid?: string }) | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const meUid = user?.uid ?? "";

  // helper to dedupe by id and keep latest order
  function uniqById(list: ConversationListItem[]): ConversationListItem[] {
    const map = new Map<string, ConversationListItem>();
    for (const it of list) map.set(it.id, it);
    return Array.from(map.values());
  }

  // Load conversations for the current user
  useEffect(() => {
  if (!meUid) return;
    const convRef = collection(db, "conversations");
  const q = query(convRef, where("participantIds", "array-contains", meUid));
    const unsub = onSnapshot(q, (snap) => {
      const rows: ConversationListItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const unique = uniqById(rows);
      unique.sort((a, b) => {
        const ta = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const tb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return tb - ta;
      });
      setItems(unique);
    });
    return () => unsub();
  }, [db, meUid]);

  // Load current user's profile for avatarUrl/displayName (auth.photoURL may be empty)
  useEffect(() => {
    if (!meUid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", meUid));
        if (cancelled) return;
        if (snap.exists()) {
          const u = snap.data() as any;
          setMeProfile({
            uid: meUid,
            username: u.username || (user as any)?.username || undefined,
            displayName: u.displayName || user?.displayName || (user as any)?.username || undefined,
            avatarUrl: u.avatarUrl || (user as any)?.photoURL || undefined,
            // premium-related flags
            isPremium: Boolean(u.isPremium || u.plan === 'pro' || u.subscription?.status === 'active' || u.role === 'premium'),
            plan: u.plan ?? null,
            subscription: u.subscription ?? null,
            role: u.role ?? undefined,
          });
        } else {
          setMeProfile({
            uid: meUid,
            username: (user as any)?.username || undefined,
            displayName: user?.displayName || (user as any)?.username || undefined,
            avatarUrl: (user as any)?.photoURL || undefined,
            isPremium: false,
            plan: null,
            subscription: null,
            role: undefined,
          });
        }
      } catch {
        setMeProfile({
          uid: meUid,
          username: (user as any)?.username || undefined,
          displayName: user?.displayName || (user as any)?.username || undefined,
          avatarUrl: (user as any)?.photoURL || undefined,
          isPremium: false,
          plan: null,
          subscription: null,
          role: undefined,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meUid, db, user]);

  // Subscribe to presence for other participants and hydrate their user info by uid
  useEffect(() => {
    if (!meUid) return;
    const subs: Array<() => void> = [];
    const others = new Set<string>();
    for (const c of items) {
      const otherId = c.participantIds.find((x) => x !== meUid);
      if (otherId) others.add(otherId);
    }
    const unsubscribers = Array.from(others).map((uid) => subscribePresence(uid, (p) => setPresenceMap((prev) => ({ ...prev, [uid]: p }))));

    // Fetch user docs in chunks of 10 for those not present in the map
    (async () => {
      const need: string[] = Array.from(others).filter((uid) => !userInfoMap[uid]);
      if (need.length === 0) return;
      const chunk = 10;
      for (let i = 0; i < need.length; i += chunk) {
        const uids = need.slice(i, i + chunk);
        const qUsers = query(collection(db, "users"), where("uid", "in", uids));
        const snap = await getDocs(qUsers);
        const updates: Record<string, BasicUser> = {};
        snap.forEach((d) => {
          const u = d.data() as any;
          if (u?.uid) {
            updates[u.uid] = {
              uid: u.uid,
              username: u.username || undefined,
              displayName: u.displayName || u.username || undefined,
              avatarUrl: u.avatarUrl || undefined,
            };
          }
        });
        if (Object.keys(updates).length) setUserInfoMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => unsubscribers.forEach((u) => u && u());
  }, [items, meUid, db, userInfoMap]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter((c) => {
      const otherId = (c.participantIds || []).find((x) => x !== meUid);
      const other = (otherId && (userInfoMap[otherId] || (c.participants?.[otherId] as BasicUser))) || undefined;
      const name = (other?.displayName || other?.username || "").toLowerCase();
      return name.includes(f);
    });
  }, [items, filter, meUid, userInfoMap]);

  function unreadCountFor(c: ConversationListItem): number {
    const me = user?.uid;
    if (!me) return 0;
    const lastRead = c.lastReadAt?.[me];
    const myLast = lastRead?.toMillis ? lastRead.toMillis() : 0;
    const last = c.lastMessage?.createdAt?.toMillis ? c.lastMessage.createdAt.toMillis() : 0;
    const otherId = c.lastMessage?.senderId;
    if (!otherId || otherId === me) return 0; // only count if last msg from other
    return last > myLast ? 1 : 0; // show at least 1 to mark unread; list view keeps it light
  }

  function openChatWith(other: BasicUser) {
  setSelectedOther(other);
  setChatLoading(true);
    const params = new URLSearchParams(Array.from(searchParams?.entries?.() || []));
    params.set("with", other.uid);
  router.replace(`/messages?${params.toString()}`);
  }

  // (removed simple preselect; handled by robust effect below)
  // Preselect from query and fetch user if convo not present yet
  useEffect(() => {
    const withUid = searchParams?.get("with");
    if (!withUid || !meUid) return;
    // Already selected?
    if (selectedOther?.uid === withUid) return;
    const convId = [meUid, withUid].sort().join("__");
    const match = items.find((c) => c.id === convId) || items.find((c) => c.participants && c.participants[withUid]);
    if (match) {
      const otherId = (match.participantIds || []).find((x) => x !== meUid) || withUid;
      const info = userInfoMap[otherId] || (match.participants?.[otherId] as BasicUser) || (match.participants?.[withUid] as BasicUser);
      if (otherId) {
        setSelectedOther({ uid: otherId, username: info?.username, displayName: info?.displayName, avatarUrl: info?.avatarUrl });
        setChatLoading(true);
      }
      return;
    }
    (async () => {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", withUid)));
      if (!snap.empty) {
        const u = snap.docs[0].data() as any;
        const other: BasicUser = { uid: u.uid, username: u.username || null, displayName: u.displayName || u.username || null, avatarUrl: u.avatarUrl || null } as any;
  setSelectedOther(other);
  setChatLoading(true);
        // Optimistically add conversation stub if not in list yet
        const exists = items.some((c) => c.id === convId);
        if (meUid) {
          setItems((prev) => {
            const draft: ConversationListItem = {
              id: convId,
              participants: {
                [meUid]: { uid: meUid, username: (user as any)?.username, displayName: user?.displayName || (user as any)?.username, avatarUrl: (user as any)?.photoURL },
                [withUid]: other as any,
              },
              participantIds: [meUid, withUid].sort(),
              lastMessage: null,
              updatedAt: { toMillis: () => Date.now(), toDate: () => new Date() } as any,
              lastReadAt: {},
            };
            const existingIdx = prev.findIndex((p) => p.id === convId);
            if (existingIdx >= 0) {
              const copy = prev.slice();
              copy[existingIdx] = { ...copy[existingIdx], ...draft };
              return copy;
            }
            return [draft, ...prev];
          });
        }
        try {
    const me: BasicUserType = { uid: meUid, username: (user as any)?.username, displayName: user?.displayName || (user as any)?.username, avatarUrl: (user as any)?.photoURL };
    await ensureConversation(meUid, me, other.uid, other);
        } catch {}
      }
    })();
  }, [searchParams, items, meUid, db, selectedOther?.uid]);

  if (!user) {
    return (
      <div className="container max-w-3xl py-10 text-center">
        <p className="mb-4">Please sign in to view your messages.</p>
        <Button asChild>
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  const meBasic: BasicUser = meProfile || {
    uid: user.uid,
    username: (user as any)?.username,
    displayName: user.displayName || (user as any)?.username,
    avatarUrl: (user as any)?.photoURL,
  };

  return (
    <div className="container py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <div className="w-64">
          <Input placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 border rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No conversations yet.</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => {
                const otherId = (c.participantIds || []).find((x) => x !== meUid);
                const other = (otherId && (userInfoMap[otherId] || (c.participants?.[otherId] as BasicUser))) || undefined;
                if (!otherId || !other) return null;
                const unread = unreadCountFor(c);
                const presence = presenceMap[otherId];
                const lastText = c.lastMessage?.text || "";
                const lastTime = c.updatedAt?.toDate ? c.updatedAt.toDate() : null;
                return (
                  <li key={c.id} className="p-3 hover:bg-accent/40 cursor-pointer" onClick={() => openChatWith({ uid: otherId, username: other.username, displayName: other.displayName, avatarUrl: other.avatarUrl })}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <Link href={other.username ? `/user/${encodeURIComponent(other.username)}` : "#"} prefetch={false} onClick={(e) => e.stopPropagation()}>
                            <AvatarImage src={other.avatarUrl || ""} />
                            <AvatarFallback>{other.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                          </Link>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                            presence?.state === "online" ? "bg-emerald-500" : "bg-muted"
                          }`}
                          title={presence?.state === "online" ? "Online" : "Offline"}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate">
                            {other.username ? (
                              <Link href={`/user/${encodeURIComponent(other.username)}`} className="hover:underline" prefetch={false} onClick={(e) => e.stopPropagation()}>
                                {other.displayName || other.username}
                              </Link>
                            ) : (
                              <span>{other.displayName || "User"}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground ml-2">
                            {lastTime ? lastTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {lastText || (c.lastMessage?.senderId === meBasic.uid ? "Sent a message" : "New message")}
                        </div>
                      </div>
                      {unread > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 min-h-[60vh] border rounded-lg overflow-hidden">
          {selectedOther ? (
            <div className="relative h-full">
              {chatLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              )}
              <ChatPanel
                key={getConversationId(user.uid, selectedOther.uid)}
                me={{ uid: user.uid, username: (user as any)?.username, displayName: meBasic.displayName || user.displayName || (user as any)?.username, avatarUrl: meBasic.avatarUrl, ...(meProfile || {}) }}
                other={selectedOther}
                onReady={() => setChatLoading(false)}
              />
            </div>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              Select a chat to start messaging.
            </div>
          )}
        </div>
      </div>

  {/* Inline panel handles chat; no modal needed */}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="container py-10 text-center">Loading…</div>}>
      <MessagesInner />
    </Suspense>
  );
}
