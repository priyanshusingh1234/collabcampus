"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getConversationId, ensureConversation, setTyping, updateLastRead, setLastMessage, type BasicUser } from "@/lib/chat";
import { isBlocked, toggleBlock } from "@/lib/blocks";
import { subscribePresence, type PresenceDoc } from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/use-long-press";
import VoiceCall from "@/components/chat/VoiceCall";
// Attachment uploads removed

export type ChatDialogProps = {
  me: BasicUser & { uid: string };
  other: BasicUser & { uid: string };
  open: boolean;
  onOpenChange?: (v: boolean) => void;
};

export default function ChatDialog({ me, other, open, onOpenChange }: ChatDialogProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [conv, setConv] = useState<any | null>(null);
  const [blocked, setBlocked] = useState<{ byMe: boolean; byOther: boolean }>({ byMe: false, byOther: false });
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const conversationId = useMemo(() => getConversationId(me.uid, other.uid), [me.uid, other.uid]);
  const [presence, setPresence] = useState<PresenceDoc | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const blockedState = blocked; // expose for VoiceCall

  useEffect(() => {
    if (!open) return;
    let unsubMsgs: () => void | undefined;
    let unsubConv: () => void | undefined;
  (async () => {
      try {
        await ensureConversation(me.uid, {
          uid: me.uid,
          username: me.username ?? null as any,
          displayName: me.displayName ?? null as any,
          avatarUrl: me.avatarUrl ?? null as any,
        }, other.uid, {
          uid: other.uid,
          username: other.username ?? null as any,
          displayName: other.displayName ?? null as any,
          avatarUrl: other.avatarUrl ?? null as any,
        });
        // block state
        const byMe = await isBlocked(me.uid, other.uid);
        const byOther = await isBlocked(other.uid, me.uid);
        setBlocked({ byMe, byOther });

        const msgsRef = collection(db, "conversations", conversationId, "messages");
        const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));
        unsubMsgs = onSnapshot(q, (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setMessages(arr);
          // read receipts
          updateLastRead(conversationId, me.uid).catch(() => {});
          // scroll
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
        });
        unsubConv = onSnapshot(doc(db, "conversations", conversationId), (snap) => {
          const data = snap.data() as any;
          setConv(data);
          if (data?.typing) setTypingOther(!!data.typing[other.uid]);
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      unsubMsgs && unsubMsgs();
      unsubConv && unsubConv();
      setTyping(conversationId, me.uid, false).catch(() => {});
    };
  }, [open, conversationId, me.uid, other.uid]);

  // Subscribe to other user's presence
  useEffect(() => {
    if (!open) return;
  const unsub = subscribePresence(other.uid, (p) => setPresence(p));
    return () => unsub && unsub();
  }, [open, other.uid]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    if (blocked.byMe) return toast.error("You've blocked this user.");
    if (blocked.byOther) return toast.error("You can't message this user.");
    try {
      setBusy(true);
      const colRef = collection(db, "conversations", conversationId, "messages");
      await addDoc(colRef, {
        text,
        senderId: me.uid,
        receiverId: other.uid,
        createdAt: serverTimestamp(),
        seenAt: null,
      });
      await setLastMessage(conversationId, { text, senderId: me.uid });
      setInput("");
      setTyping(conversationId, me.uid, false).catch(() => {});
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to send message");
    } finally {
      setBusy(false);
    }
  }


  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInput(v);
    setTyping(conversationId, me.uid, v.trim().length > 0).catch(() => {});
  }

  async function handleToggleBlock() {
    const v = !blocked.byMe;
    await toggleBlock(me.uid, other.uid, v);
    setBlocked((prev) => ({ ...prev, byMe: v }));
    toast.success(v ? "User blocked" : "User unblocked");
  }

  // Close message options on outside click, scroll, or Escape
  useEffect(() => {
    if (!showMenuId || !open) return;
    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-message-menu]')) setShowMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenuId(null);
    };
    const onScroll = () => setShowMenuId(null);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [showMenuId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-2 sm:p-6" role="dialog" aria-modal>
      <div className="w-full max-w-lg bg-background rounded-xl shadow-xl flex flex-col h-[85vh] sm:h-[75vh]">
        <div className="flex items-center gap-3 p-3 border-b">
          <Avatar className="h-9 w-9">
            <AvatarImage src={other.avatarUrl || ""} />
            <AvatarFallback>{other.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold leading-tight">{other.displayName || other.username || "User"}</div>
            <div className="text-xs text-muted-foreground h-4">
              {blocked.byOther
                ? "You can't message this user"
                : typingOther
                ? "typing..."
                : presence?.state === "online"
                ? "online"
                : presence?.lastActive?.toDate
                ? `last seen ${new Date(presence.lastActive.toDate()).toLocaleString()}`
                : "offline"}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleToggleBlock} title={blocked.byMe ? "Unblock" : "Block"}>
            {blocked.byMe ? <Icons.UserCheck className="h-5 w-5"/> : <Icons.UserX className="h-5 w-5"/>}
          </Button>
          <VoiceCall conversationId={conversationId} me={me} other={other} blocked={blocked} compact />
          <Button variant="ghost" size="icon" onClick={() => onOpenChange?.(false)} title="Close">
            <Icons.X className="h-5 w-5"/>
          </Button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
          {messages.map((m) => {
            const mine = m.senderId === me.uid;
            const time = m.createdAt?.toDate ? m.createdAt.toDate() : null;
            const seen = !!(mine && conv?.lastReadAt?.[other.uid]?.toMillis && m?.createdAt?.toMillis && m.createdAt.toMillis() <= conv.lastReadAt[other.uid].toMillis());
            return (
              <Pressable key={m.id} onLongPress={() => setShowMenuId(m.id)} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`group relative max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm"}`}>
                  {editingId === m.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className={`w-full bg-transparent outline-none ${mine ? "placeholder:text-primary-foreground/70" : "placeholder:text-foreground/70"}`}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            const text = editText.trim();
                            if (text) await updateDoc(doc(db, "conversations", conversationId, "messages", m.id), { text });
                            setEditingId(null);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                        data-no-longpress
                      />
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-no-longpress>Cancel</Button>
                      <Button size="sm" onClick={async () => {
                        const text = editText.trim();
                        if (text) await updateDoc(doc(db, "conversations", conversationId, "messages", m.id), { text });
                        setEditingId(null);
                      }} data-no-longpress>Save</Button>
                    </div>
                  ) : (
                    <>{m.text}</>
                  )}
                  <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                    {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    {mine && (seen ? <Icons.CheckCheck className="h-3 w-3"/> : <Icons.Check className="h-3 w-3"/>)}
                  </div>
                   {mine && (
                    <div className="absolute -top-2 right-0 hidden md:group-hover:flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Edit" onClick={() => { setEditingId(m.id); setEditText(m.text || ""); }} data-no-longpress>
                        <Icons.Pencil className="h-3 w-3"/>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Delete"
                        onClick={async () => {
                          try {
                            if (m.senderId !== me.uid) {
                              toast.error("You can only delete your own messages");
                              return (
                                <div className="flex items-center gap-2">
                                  {/* ...existing code... */}
                                  <span className="text-xs text-muted-foreground">{other.displayName || other.username}</span>
                                  {presence?.state === "online" && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold">Online</span>
                                  )}
                                </div>
                              );
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ public_id: att.publicId, resource_type: rt }),
                              }).catch(() => {});
                            }
                            await deleteDoc(doc(db, "conversations", conversationId, "messages", m.id));
                          } catch (e) {
                            console.error(e);
                            toast.error("Failed to delete message");
                          }
                        }}
                        data-no-longpress
                      >
                        <Icons.Trash2 className="h-3 w-3"/>
                      </Button>
                    </div>
                  )}
                   {showMenuId === m.id && (
                    <div className="absolute top-6 right-0 bg-background border rounded shadow text-foreground z-10" data-message-menu>
                      {mine ? (
                        <>
                          <button className="block px-3 py-2 text-sm w-full text-left" data-no-longpress onClick={() => { setEditingId(m.id); setEditText(m.text || ""); setShowMenuId(null); }}>Edit</button>
                          <button
                            className="block px-3 py-2 text-sm w-full text-left text-red-600"
                            onClick={async () => {
                              try {
                                if (m.senderId !== me.uid) {
                                  toast.error("You can only delete your own messages");
                                  return;
                                }
                                const att = (m as any)?.attachment;
                                if (att?.provider === "cloudinary" && att?.publicId) {
                                  const rt = att.resourceType === "image" || att.resourceType === "video" || att.resourceType === "raw" ? att.resourceType : undefined;
                                  await fetch("/api/cloudinary-delete", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ public_id: att.publicId, resource_type: rt }),
                                  }).catch(() => {});
                                }
                                await deleteDoc(doc(db, "conversations", conversationId, "messages", m.id));
                              } catch (e) {
                                console.error(e);
                                toast.error("Failed to delete message");
                              } finally {
                                setShowMenuId(null);
                              }
                            }}
                            data-no-longpress
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          {m.text ? (
                            <button
                              className="block px-3 py-2 text-sm w-full text-left"
                              data-no-longpress
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(m.text);
                                  toast.success("Copied");
                                } catch {
                                  toast.error("Copy failed");
                                } finally {
                                  setShowMenuId(null);
                                }
                              }}
                            >
                              Copy
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                   )}
                </div>
              </Pressable>
            );
          })}
        </div>

  <div className="p-3 border-t flex items-center gap-2">
          <Input
            placeholder={blocked.byMe ? "You've blocked this user" : blocked.byOther ? "You can't message this user" : "Type a message"}
            value={input}
            onChange={onChange}
            disabled={busy || blocked.byMe || blocked.byOther}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={busy || !input.trim() || blocked.byMe || blocked.byOther}>
            <Icons.Send className="h-4 w-4"/>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pressable({ onLongPress, className, children }: { onLongPress: () => void; className?: string; children: React.ReactNode }) {
  const handlers = useLongPress(() => {
    onLongPress();
  }, 500);
  const stopIfNoLongPress = (e: React.SyntheticEvent) => {
    const el = e.target as HTMLElement;
    if (!el) return;
    if (el.closest('[data-no-longpress]')) return;
    // @ts-ignore forward
    handlers.onTouchStart?.(e);
  };
  return (
    <div
      className={className}
      onTouchStart={stopIfNoLongPress as any}
      onTouchEnd={handlers.onTouchEnd as any}
      onMouseDown={(e) => {
        const el = e.target as HTMLElement;
        if (el && el.closest('[data-no-longpress]')) return;
        handlers.onMouseDown?.(e as any);
      }}
      onMouseUp={handlers.onMouseUp as any}
      onContextMenu={(e) => {
        const el = e.target as HTMLElement;
        if (el && el.closest('[data-no-longpress]')) return;
        handlers.onContextMenu?.(e as any);
      }}
    >
      {children}
    </div>
  );
}
