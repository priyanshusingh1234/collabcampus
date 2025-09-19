"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { heartbeat, setOnline, setOffline } from "@/lib/presence";

export default function PresenceWatcher() {
  const { user } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function goOnline() {
      if (!user?.uid) return;
      try { await setOnline(user.uid); } catch {}
      // heartbeat every 45s
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = setInterval(() => {
        if (!user?.uid) return;
        heartbeat(user.uid).catch(() => {});
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
      if (user?.uid) setOffline(user.uid);
    }
    function handleVisibility() {
      if (document.visibilityState === "visible" && user?.uid) {
        // Refresh online immediately when tab becomes active
        setOnline(user.uid).catch(() => {});
      }
    }
    function handleOnline() {
      if (user?.uid) setOnline(user.uid).catch(() => {});
    }
    function handleOffline() {
      if (user?.uid) setOffline(user.uid).catch(() => {});
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user?.uid]);

  return null;
}
