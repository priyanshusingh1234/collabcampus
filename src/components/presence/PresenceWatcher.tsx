"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { heartbeat, setOnline, setOffline } from "@/lib/presence";

export default function PresenceWatcher() {
  const { user } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const usePg = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USE_PG_PRESENCE === 'true';

  async function apiSet(uid: string, state: 'online' | 'offline') {
    try {
      const res = await fetch(`/api/presence/${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    async function goOnline() {
      if (!user?.uid) return;
      if (usePg) {
        await apiSet(user.uid, 'online');
      } else {
        try { await setOnline(user.uid); } catch {}
      }
      // heartbeat every 45s
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = setInterval(() => {
        if (!user?.uid) return;
        if (usePg) {
          apiSet(user.uid, 'online');
        } else {
          heartbeat(user.uid).catch(() => {});
        }
      }, 45_000) as any;
    }

    if (user?.uid) {
      goOnline();
    } else if (timerRef.current) {
      clearInterval(timerRef.current as any);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current as any);
        timerRef.current = null;
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (user?.uid) {
        if (usePg) {
          // fire-and-forget
          navigator.sendBeacon?.(`/api/presence/${encodeURIComponent(user.uid)}`, JSON.stringify({ state: 'offline' }));
        } else {
          setOffline(user.uid);
        }
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible" && user?.uid) {
        // Refresh online immediately when tab becomes active
        if (usePg) apiSet(user.uid, 'online'); else setOnline(user.uid).catch(() => {});
      }
    }
    function handleOnline() {
      if (user?.uid) { if (usePg) apiSet(user.uid, 'online'); else setOnline(user.uid).catch(() => {}); }
    }
    function handleOffline() {
      if (user?.uid) { if (usePg) apiSet(user.uid, 'offline'); else setOffline(user.uid).catch(() => {}); }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user?.uid]);

  return null;
}
