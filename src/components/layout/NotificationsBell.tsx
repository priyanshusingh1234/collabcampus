"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Notif = {
  id: string;
  title: string;
  body?: string;
  url?: string;
  read?: boolean;
  createdAt?: any;
  type?: string;
  from?: { uid: string; username?: string; avatarUrl?: string };
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Notif[];
      setItems(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const markAllRead = async () => {
    if (!user?.uid) return;
    await Promise.all(
      items.filter((i) => !i.read).map((i) => updateDoc(doc(db, "users", user.uid!, "notifications", i.id), { read: true }))
    );
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0} title="Mark all as read">
            <CheckCheck className="h-4 w-4" />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className={`flex flex-col items-start space-y-1 ${!n.read ? 'bg-accent/30' : ''}`} asChild>
              {n.url ? (
                <Link href={n.url} className="w-full">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                </Link>
              ) : (
                <div className="w-full">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                </div>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
