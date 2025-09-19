"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import { getIceServers } from "@/lib/webrtc";

type BasicUser = {
  uid: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};

type CallDoc = {
  status: "ringing" | "accepted" | "connected" | "ended";
  fromUid: string;
  toUid: string;
  createdAt: any;
  updatedAt: any;
  offer?: any;
  answer?: any;
  endedAt?: any;
  endReason?: string;
};

export type VoiceCallHandle = {
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  setSpeaker: (on: boolean) => Promise<boolean>;
  getState: () => { micMuted: boolean; connected: boolean; status: CallDoc["status"] | null };
} | null;

export function VoiceCall({
  conversationId,
  me,
  other,
  blocked,
  compact = false,
  autoAccept = false,
  hideInlineControls = false,
  onState,
  controlsRef,
}: {
  conversationId: string;
  me: BasicUser & { uid: string };
  other: BasicUser & { uid: string };
  blocked?: { byMe: boolean; byOther: boolean };
  compact?: boolean; // when true, render only the icon button; banners render inline when active
  autoAccept?: boolean; // when true and an inbound ringing call exists, auto-accept
  hideInlineControls?: boolean; // suppress inline banners/controls (used by GlobalCallUI host)
  onState?: (s: { status: CallDoc["status"] | null; connected: boolean; micMuted: boolean }) => void;
  controlsRef?: React.MutableRefObject<VoiceCallHandle>;
}) {
  const callRef = useMemo(() => doc(db, "conversations", conversationId, "calls", "current"), [conversationId]);
  const callerCandidatesRef = useMemo(() => collection(db, "conversations", conversationId, "calls", "current", "callerCandidates"), [conversationId]);
  const calleeCandidatesRef = useMemo(() => collection(db, "conversations", conversationId, "calls", "current", "calleeCandidates"), [conversationId]);

  const [call, setCall] = useState<CallDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [inbound, setInbound] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startedRef = useRef(false);
  const myRoleRef = useRef<"caller" | "callee" | null>(null);
  const iceUnsubsRef = useRef<Array<() => void>>([]);
  const acceptedOnceRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(callRef, (snap) => {
      const data = snap.exists() ? (snap.data() as CallDoc) : null;
      setCall(data);
      if (data) {
        setInbound(data.status === "ringing" && data.toUid === me.uid);
        if (data.status === "ended") {
          // remote ended
          cleanupPeer("Remote ended");
        }
        onState?.({ status: data.status, connected, micMuted });
      } else {
        setInbound(false);
        setConnected(false);
        onState?.({ status: null, connected: false, micMuted });
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Auto-accept when requested by parent (e.g., GlobalCallUI)
  useEffect(() => {
    if (!autoAccept) return;
    if (!inbound) return;
    if (acceptedOnceRef.current) return;
    if (call?.status === "ringing" && call.toUid === me.uid) {
      acceptedOnceRef.current = true;
      acceptCall().catch(() => {
        acceptedOnceRef.current = false;
      });
    }
  }, [autoAccept, inbound, call?.status, call?.toUid, me.uid]);

  const getPc = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const role = myRoleRef.current;
      try {
        if (role === "caller") {
          await addDoc(callerCandidatesRef, event.candidate.toJSON());
        } else if (role === "callee") {
          await addDoc(calleeCandidatesRef, event.candidate.toJSON());
        }
      } catch (e) {
        // ignore
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        // Attempt immediate play
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      setConnected(st === "connected");
      onState?.({ status: call?.status ?? null, connected: st === "connected", micMuted });
      if (st === "failed") {
        // End immediately on hard failure
        updateDoc(callRef, { status: "ended", endedAt: serverTimestamp(), endReason: st, updatedAt: serverTimestamp() }).catch(() => {});
        cleanupPeer(`Peer ${st}`);
      } else if (st === "disconnected") {
        // Grace period: transient network blips are common on mobile
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            updateDoc(callRef, { status: "ended", endedAt: serverTimestamp(), endReason: "timeout", updatedAt: serverTimestamp() }).catch(() => {});
            cleanupPeer("Peer disconnected timeout");
          }
        }, 5000);
      } else if (st === "connected") {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      } else if (st === "closed") {
        cleanupPeer("Peer closed");
      }
    };

    // Some browsers only fire iceconnectionstatechange for detailed ICE states
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === "failed") {
        updateDoc(callRef, { status: "ended", endedAt: serverTimestamp(), endReason: `ice_${st}`, updatedAt: serverTimestamp() }).catch(() => {});
        cleanupPeer("ICE failed");
      } else if (st === "disconnected") {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            updateDoc(callRef, { status: "ended", endedAt: serverTimestamp(), endReason: `ice_timeout`, updatedAt: serverTimestamp() }).catch(() => {});
            cleanupPeer("ICE disconnected timeout");
          }
        }, 5000);
      } else if (st === "connected" || st === "completed") {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      }
    };
    pcRef.current = pc;
    return pc;
  }, [calleeCandidatesRef, callerCandidatesRef, callRef]);

  const ensureMic = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    const pc = getPc();
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
    return stream;
  }, [getPc]);

  const startCall = useCallback(async () => {
    if (blocked?.byMe || blocked?.byOther) {
      return toast.error(blocked.byMe ? "You've blocked this user" : "You can't call this user");
    }
    if (startedRef.current) return;
    startedRef.current = true;
    myRoleRef.current = "caller";
    setLoading(true);
    try {
      await ensureMic();
      const pc = getPc();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await setDoc(callRef, {
        status: "ringing",
        fromUid: me.uid,
        toUid: other.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        offer,
      } as CallDoc);

      // Listen for answer and remote ICE
      const unsubCall = onSnapshot(callRef, async (snap) => {
        const data = snap.data() as CallDoc | undefined;
        if (!data) return;
        if (data.answer && pc.signalingState !== "stable") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch {}
        }
        if (data.status === "ended") {
          unsubCall();
          cleanupPeer("Ended");
        }
      });
      const unsubCallee = onSnapshot(calleeCandidatesRef, (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(change.doc.data() as RTCIceCandidateInit));
            } catch {}
          }
        });
      });
      iceUnsubsRef.current.push(unsubCall, unsubCallee);
      toast.success("Calling…");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Call failed to start");
      startedRef.current = false;
      cleanupPeer("Start failed");
    } finally {
      setLoading(false);
    }
  }, [blocked?.byMe, blocked?.byOther, calleeCandidatesRef, callRef, ensureMic, getPc, me.uid, other.uid]);

  const acceptCall = useCallback(async () => {
    if (!call || call.status !== "ringing" || call.toUid !== me.uid) return;
    myRoleRef.current = "callee";
    setLoading(true);
    try {
      await ensureMic();
      const pc = getPc();
      const offer = call.offer;
      if (!offer) throw new Error("Missing offer");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, {
        status: "accepted",
        answer,
        updatedAt: serverTimestamp(),
      });
      // Listen for caller ICE
      const unsubCaller = onSnapshot(callerCandidatesRef, (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(change.doc.data() as RTCIceCandidateInit));
            } catch {}
          }
        });
      });
      iceUnsubsRef.current.push(unsubCaller);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to accept call");
    } finally {
      setLoading(false);
    }
  }, [call, callerCandidatesRef, callRef, ensureMic, getPc, me.uid]);

  const declineCall = useCallback(async () => {
    try {
      await updateDoc(callRef, { status: "ended", endReason: "declined", endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await clearCandidates();
    } catch {}
    cleanupPeer("Declined");
  }, [callRef]);

  const endCall = useCallback(async () => {
    try {
      const snap = await getDoc(callRef);
      if (snap.exists()) {
        await updateDoc(callRef, { status: "ended", endReason: "hangup", endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      await clearCandidates();
    } catch {}
    cleanupPeer("Hangup");
  }, [callRef]);

  const clearCandidates = useCallback(async () => {
    try {
      const clear = async (ref: ReturnType<typeof collection>) => {
        const qs = await import("firebase/firestore").then((m) => m.getDocs(ref));
        await Promise.all(qs.docs.map((d) => deleteDoc(d.ref)));
      };
      await Promise.all([clear(callerCandidatesRef), clear(calleeCandidatesRef)]);
    } catch {}
  }, [calleeCandidatesRef, callerCandidatesRef]);

  function cleanupPeer(reason?: string) {
    iceUnsubsRef.current.forEach((u) => u());
    iceUnsubsRef.current = [];
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    const pc = pcRef.current;
    if (pc) {
      try { pc.ontrack = null; } catch {}
      try { pc.onicecandidate = null; } catch {}
      try { pc.close(); } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setConnected(false);
    startedRef.current = false;
    myRoleRef.current = null;
    if (reason) {
      // Optional feedback
    }
  }

  useEffect(() => {
    return () => {
      cleanupPeer("unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mic mute toggle
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMicMuted(next);
    onState?.({ status: call?.status ?? null, connected, micMuted: next });
  }, [micMuted]);

  // Attempt to switch audio output device to speaker if supported
  const setSpeaker = useCallback(async (on: boolean): Promise<boolean> => {
    try {
      const el = remoteAudioRef.current as any;
      if (!el || typeof el.setSinkId !== "function") {
        setSpeakerOn(on);
        return false;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outs = devices.filter((d) => d.kind === "audiooutput");
      if (!outs.length) {
        setSpeakerOn(on);
        return false;
      }
      let target = outs[0];
      if (on) {
        const speaker = outs.find((d) => /speaker/i.test(d.label));
        if (speaker) target = speaker;
      }
      await el.setSinkId(target.deviceId);
      setSpeakerOn(on);
      return true;
    } catch {
      setSpeakerOn(on);
      return false;
    }
  }, []);

  // Expose controls to parent via ref
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      accept: acceptCall,
      decline: declineCall,
      hangup: endCall,
      toggleMute,
      setSpeaker,
      getState: () => ({ micMuted, connected, status: call?.status ?? null }),
    };
    return () => {
      controlsRef.current = null;
    };
  }, [acceptCall, declineCall, endCall, toggleMute, setSpeaker, micMuted, connected, call?.status]);

  const canStart = !blocked?.byMe && !blocked?.byOther && (!call || call.status === "ended");

  return (
    <div className="flex items-center gap-2">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {/* Start/Active buttons */}
      {!hideInlineControls && (
        <>
          <Button
            variant="ghost"
            size={compact ? "icon" : "sm"}
            onClick={startCall}
            disabled={!canStart || loading}
            title={blocked?.byMe ? "You've blocked this user" : blocked?.byOther ? "You can't call this user" : "Start voice call"}
          >
            <Icons.Phone className="h-5 w-5" />{!compact && <span className="ml-2 hidden sm:inline">Call</span>}
          </Button>

          {/* Incoming banner */}
          {inbound && call?.status === "ringing" && (
            <div className="flex items-center gap-2 bg-amber-100 text-amber-900 px-2 py-1 rounded-md">
              <Icons.PhoneIncoming className="h-4 w-4" />
              <span className="text-xs">Incoming call</span>
              <Button size="sm" variant="default" onClick={acceptCall} disabled={loading}>Accept</Button>
              <Button size="sm" variant="secondary" onClick={declineCall} disabled={loading}>Decline</Button>
            </div>
          )}

          {/* Ongoing call controls */}
          {call && call.status !== "ended" && (
            <div className="flex items-center gap-2 bg-emerald-600 text-white px-2 py-1 rounded-md">
              <Icons.PhoneCall className="h-4 w-4" />
              <span className="text-xs">{connected ? "Connected" : call.status === "ringing" ? "Ringing…" : call.status}</span>
              <Button size="icon" variant="secondary" onClick={toggleMute} title={micMuted ? "Unmute" : "Mute"}>
                {micMuted ? <Icons.MicOff className="h-4 w-4" /> : <Icons.Mic className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="destructive" onClick={endCall} title="Hang up">
                <Icons.PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VoiceCall;
