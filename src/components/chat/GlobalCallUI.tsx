"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collectionGroup, doc, onSnapshot, query, updateDoc, where, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getConversationId, type BasicUser } from "@/lib/chat";
import VoiceCall, { type VoiceCallHandle } from "@/components/chat/VoiceCall";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";

type CallDoc = {
  status: "ringing" | "accepted" | "connected" | "ended";
  fromUid: string;
  toUid: string;
  createdAt?: any;
  updatedAt?: any;
};

export default function GlobalCallUI() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<{
    conversationId: string;
    callPath: string; // full path to calls/current
    data: CallDoc;
    caller?: BasicUser;
  } | null>(null);
  const [autoAccept, setAutoAccept] = useState(false);
  const unsubRef = useRef<null | (() => void)>(null);
  const convUnsubsRef = useRef<Array<() => void>>([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const vcRef = useRef<VoiceCallHandle>(null);
  const [callUi, setCallUi] = useState<{ status: CallDoc["status"] | null; connected: boolean; micMuted: boolean }>({ status: null, connected: false, micMuted: false });
  const [callStartTs, setCallStartTs] = useState<number | null>(null);
  const [speakerOn, setSpeakerOn] = useState(false);

  // Subscribe to any ringing calls targeting this user
  useEffect(() => {
    if (!user?.uid) return;
    // Clean any prior sub
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    // Clean fallback subs
    convUnsubsRef.current.forEach((u) => u());
    convUnsubsRef.current = [];
    setUsingFallback(false);
    const cg = collectionGroup(db, "calls");
    const q = query(cg, where("toUid", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      // Find a ringing call addressed to me
      const first = snap.docs
        .map((d) => ({ path: d.ref.path, data: d.data() as CallDoc }))
        .find((d) => d.data.status === "ringing");
      if (!first) {
        setIncoming(null);
        setAutoAccept(false);
        return;
      }
      // conversationId is parent of 'calls/current': conversations/{id}/calls/current
      const parts = first.path.split("/");
      const convId = parts.length >= 3 ? parts[1] : getConversationId(user.uid, (first.data.fromUid || ""));
      // fetch caller basic profile
      let caller: BasicUser | undefined = undefined;
      try {
        const qs = await getDocs(query(collection(db, "users"), where("uid", "==", first.data.fromUid)));
        const doc0 = qs.docs[0];
        if (doc0) {
          const d = doc0.data() as any;
          caller = { uid: d.uid, username: d.username, displayName: d.displayName, avatarUrl: d.avatarUrl };
        }
      } catch {}
      setIncoming({ conversationId: convId, callPath: first.path, data: first.data, caller });
    }, (err) => {
      // Likely missing collection group index or rules issue; fall back
      if (typeof window !== "undefined") {
        console.warn("GlobalCallUI collectionGroup failed; falling back to per-conversation listeners:", err?.message || err);
      }
      tryFallback();
    });
    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
      convUnsubsRef.current.forEach((u) => u());
      convUnsubsRef.current = [];
    };
  }, [user?.uid]);

  // Fallback: subscribe to conversations containing me, then each conversation's calls/current
  function tryFallback() {
    if (!user?.uid) return;
    setUsingFallback(true);
    // conversations where participantIds array contains me
    const convsQ = query(collection(db, "conversations"), where("participantIds", "array-contains", user.uid));
    const unsubConvs = onSnapshot(convsQ, (convSnap) => {
      // Cleanup existing per-conversation subs
      convUnsubsRef.current.forEach((u) => u());
      convUnsubsRef.current = [];
      const unsubs: Array<() => void> = [];
      convSnap.docs.forEach((convDoc) => {
        const convId = convDoc.id;
        const callDocRef = doc(db, "conversations", convId, "calls", "current");
        const unsubCall = onSnapshot(callDocRef, async (callSnap) => {
          if (!callSnap.exists()) {
            if (incoming?.conversationId === convId) {
              setIncoming(null);
              setAutoAccept(false);
            }
            return;
          }
          const data = callSnap.data() as CallDoc;
          if (data.toUid !== user.uid || data.status !== "ringing") {
            if (incoming?.conversationId === convId) {
              setIncoming(null);
              setAutoAccept(false);
            }
            return;
          }
          // fetch caller
          let caller: BasicUser | undefined = undefined;
          try {
            const qs = await getDocs(query(collection(db, "users"), where("uid", "==", data.fromUid)));
            const doc0 = qs.docs[0];
            if (doc0) {
              const d = doc0.data() as any;
              caller = { uid: d.uid, username: d.username, displayName: d.displayName, avatarUrl: d.avatarUrl };
            }
          } catch {}
          setIncoming({ conversationId: convId, callPath: callDocRef.path, data, caller });
        }, (err) => {
          if (typeof window !== "undefined") {
            console.warn("GlobalCallUI fallback call listener error:", err?.message || err);
          }
        });
        unsubs.push(unsubCall);
      });
      convUnsubsRef.current = unsubs;
    }, (err) => {
      if (typeof window !== "undefined") {
        console.warn("GlobalCallUI fallback conversations listener error:", err?.message || err);
      }
    });
    convUnsubsRef.current.push(unsubConvs);
  }

  async function decline() {
    if (!incoming) return;
    try {
      await updateDoc(doc(db, incoming.callPath), { status: "ended", endReason: "declined" });
    } catch {}
    setIncoming(null);
    setAutoAccept(false);
  }

  async function hangup() {
    if (!incoming) return;
    try {
      await updateDoc(doc(db, incoming.callPath), { status: "ended", endReason: "hangup" });
    } catch {}
    setIncoming(null);
    setAutoAccept(false);
    setCallStartTs(null);
  }

  if (!incoming || !user) return null;

  const me: BasicUser & { uid: string } = {
    uid: user.uid,
    username: (user as any).username,
    displayName: user.displayName || (user as any).username,
    avatarUrl: (user as any).photoURL,
  };
  const other: BasicUser & { uid: string } = incoming.caller || { uid: incoming.data.fromUid } as any;

  const isRinging = incoming.data.status === "ringing" && !callUi.connected;
  const inCall = callUi.status === "accepted" || callUi.connected;

  function onStateUpdate(s: { status: CallDoc["status"] | null; connected: boolean; micMuted: boolean }) {
    setCallUi(s);
    if ((s.status === "accepted" || s.connected) && !callStartTs) {
      setCallStartTs(Date.now());
    }
    if (s.status === null) {
      // Call doc disappeared, close overlay
      setCallStartTs(null);
      setIncoming(null);
      setAutoAccept(false);
    }
  }

  const elapsed = callStartTs ? Math.floor((Date.now() - callStartTs) / 1000) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      {/* Hidden VoiceCall host to manage WebRTC once accepted */}
      <div className="absolute top-0 left-0 opacity-0 pointer-events-none">
        <VoiceCall
          conversationId={incoming.conversationId}
          me={me}
          other={other}
          compact
          autoAccept={autoAccept}
          hideInlineControls
          controlsRef={vcRef}
          onState={onStateUpdate}
        />
      </div>

      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center gap-6 text-white">
          {!inCall && <div className="mt-6 text-sm uppercase tracking-wide opacity-80">Incoming call</div>}
          <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white/20 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={other.avatarUrl || "/favicon.ico"} alt="avatar" className="h-full w-full object-cover" />
          </div>
          <div className="text-2xl font-semibold text-center">
            {other.displayName || other.username || "Unknown"}
          </div>

          {/* Ringing controls */}
          {isRinging && (
            <div className="mt-8 flex items-center justify-between w-full">
              <div className="flex flex-col items-center gap-3">
                <Button size="icon" className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700" onClick={decline}>
                  <Icons.PhoneOff className="h-7 w-7" />
                </Button>
                <div className="text-xs opacity-80">Decline</div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setAutoAccept(true)}
                >
                  <Icons.Phone className="h-7 w-7 rotate-90" />
                </Button>
                <div className="text-xs opacity-80">Accept</div>
              </div>
            </div>
          )}

          {/* In-call controls for mobile */}
          {inCall && (
            <div className="mt-6 w-full flex flex-col items-center gap-4">
              <div className="text-sm opacity-80">{callUi.connected ? `${mm}:${ss}` : (incoming.data.status || "connecting…")}</div>
              <div className="grid grid-cols-3 gap-6 w-full max-w-xs">
                <Button variant="secondary" className="h-14 rounded-full flex flex-col items-center justify-center" onClick={() => vcRef.current?.toggleMute()}>
                  {callUi.micMuted ? <Icons.MicOff className="h-5 w-5" /> : <Icons.Mic className="h-5 w-5" />}
                  <span className="mt-1 text-[11px]">{callUi.micMuted ? "Unmute" : "Mute"}</span>
                </Button>
                <Button variant="destructive" className="h-14 rounded-full flex flex-col items-center justify-center" onClick={hangup}>
                  <Icons.PhoneOff className="h-5 w-5" />
                  <span className="mt-1 text-[11px]">Hang up</span>
                </Button>
                <Button variant="secondary" className="h-14 rounded-full flex flex-col items-center justify-center" onClick={async () => {
                  const next = !speakerOn;
                  const ok = await (vcRef.current?.setSpeaker?.(next) ?? Promise.resolve(false));
                  setSpeakerOn(next);
                }}>
                  <Icons.Volume2 className="h-5 w-5" />
                  <span className="mt-1 text-[11px]">{speakerOn ? "Earpiece" : "Speaker"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
