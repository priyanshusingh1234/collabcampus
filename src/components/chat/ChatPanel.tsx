"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, setDoc, where, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureConversation, getConversationId, setLastMessage, setTyping, updateLastRead, type BasicUser } from "@/lib/chat";
import { isBlocked, toggleBlock } from "@/lib/blocks";
import { subscribePresence, type PresenceDoc } from "@/lib/presence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import AttachmentButton, { type AttachmentMeta } from "./AttachmentButton";
import MediaPreviewModal from "./MediaPreviewModal";
import { useLongPress } from "@/hooks/use-long-press";
import { isPremium } from "@/lib/premium";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import VoiceCall from "@/components/chat/VoiceCall";

export type ChatPanelProps = {
  me: BasicUser & { uid: string };
  other: BasicUser & { uid: string };
  onReady?: () => void;
};

export default function ChatPanel({ me, other, onReady }: ChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [conv, setConv] = useState<any | null>(null);
  const [blocked, setBlocked] = useState<{ byMe: boolean; byOther: boolean }>({ byMe: false, byOther: false });
  const [presence, setPresence] = useState<PresenceDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const premium = isPremium(me);

  function formatDayLabel(d: Date | null) {
    if (!d) return "";
    const today = new Date();
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.floor((t0.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString();
  }
  const conversationId = useMemo(() => getConversationId(me.uid, other.uid), [me.uid, other.uid]);

  useEffect(() => {
  let unsubMsgs: undefined | (() => void);
  let unsubConv: undefined | (() => void);
  let unsubPins: undefined | (() => void);
    const readyRef = { current: false } as { current: boolean };
    (async () => {
      try {
        await ensureConversation(
          me.uid,
          { uid: me.uid, username: me.username ?? null as any, displayName: me.displayName ?? null as any, avatarUrl: me.avatarUrl ?? null as any },
          other.uid,
          { uid: other.uid, username: other.username ?? null as any, displayName: other.displayName ?? null as any, avatarUrl: other.avatarUrl ?? null as any }
        );
        const byMe = await isBlocked(me.uid, other.uid);
        const byOther = await isBlocked(other.uid, me.uid);
        setBlocked({ byMe, byOther });

        const msgsRef = collection(db, "conversations", conversationId, "messages");
        const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));
        unsubMsgs = onSnapshot(q, (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setMessages(arr);
          updateLastRead(conversationId, me.uid).catch(() => {});
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
          if (!readyRef.current) {
            readyRef.current = true;
            onReady && onReady();
          }
        });
        unsubConv = onSnapshot(doc(db, "conversations", conversationId), (snap) => {
          const data = snap.data() as any;
          setConv(data);
          if (data?.typing) setTypingOther(!!data.typing[other.uid]);
        });
        if (premium) {
          const pinsRef = collection(db, "conversations", conversationId, "pinned");
          const qp = query(pinsRef, where("byUid", "==", me.uid));
          unsubPins = onSnapshot(qp, (snap) => {
            const next = new Set<string>();
            snap.docs.forEach((d) => {
              const v = d.data() as any;
              if (v?.messageId) next.add(v.messageId);
            });
            setPinnedIds(next);
          });
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      unsubMsgs && unsubMsgs();
      unsubConv && unsubConv();
      unsubPins && unsubPins();
      setTyping(conversationId, me.uid, false).catch(() => {});
    };
  }, [conversationId, me.uid, other.uid, premium]);

  useEffect(() => {
    const unsub = subscribePresence(other.uid, (p) => setPresence(p));
    return () => unsub && unsub();
  }, [other.uid]);

  // Close message options menu on outside click, scroll, or Escape
  useEffect(() => {
    if (!showMenuId) return;
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
  }, [showMenuId]);

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

  // Premium: toggle pin for a message
  async function togglePin(messageId: string) {
    if (!premium) return;
    const pinId = `${me.uid}_${messageId}`;
    const ref = doc(db, "conversations", conversationId, "pinned", pinId);
    try {
      if (pinnedIds.has(messageId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { messageId, byUid: me.uid, createdAt: serverTimestamp() });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to toggle pin");
    } finally {
      setShowMenuId(null);
    }
  }

  // Premium: react to a message with an emoji
  async function react(messageId: string, emoji: string) {
    if (!premium) return;
    try {
      const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
      const target = messages.find((m) => m.id === messageId);
      const current = target?.reactions?.[me.uid] as string | undefined;
      if (current === emoji) {
        await updateDoc(msgRef, { [`reactions.${me.uid}`]: deleteField() as any });
      } else {
        await updateDoc(msgRef, { [`reactions.${me.uid}`]: emoji });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to react");
    } finally {
      setShowMenuId(null);
    }
  }

  // Attachment uploads removed with UploadThing
  async function sendAttachment(meta: AttachmentMeta, text?: string) {
    if (blocked.byMe) return toast.error("You've blocked this user.");
    if (blocked.byOther) return toast.error("You can't message this user.");
    try {
      setBusy(true);
      const colRef = collection(db, "conversations", conversationId, "messages");
      const payload: any = {
        text: text || "",
        senderId: me.uid,
        receiverId: other.uid,
        createdAt: serverTimestamp(),
        seenAt: null,
        attachment: {
          url: meta.secureUrl || meta.url,
          publicId: meta.publicId,
          resourceType: meta.resourceType,
          width: meta.width || null,
          height: meta.height || null,
          bytes: meta.bytes,
          format: meta.format || null,
          originalFilename: meta.originalFilename || null,
          provider: "cloudinary",
        },
      };
      await addDoc(colRef, payload);
      await setLastMessage(conversationId, { text: "📎 Attachment", senderId: me.uid });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to send attachment");
    } finally {
      setBusy(false);
    }
  }

  function onFilePicked(file: File, previewUrl: string) {
    // Revoke prior preview to avoid leaks
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    setPickedFile(file);
    setPickedPreview(previewUrl);
  setPickedType(file.type || null);
  }

  async function sendPicked() {
    if (!pickedFile) return;
    try {
      setBusy(true);
      // Sign
      const signRes = await fetch("/api/cloudinary-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "chat", resource_type: "auto" }),
      });
      const signed = await signRes.json();
      if (!signRes.ok) throw new Error(signed?.error || "Sign failed");

      // Upload
      const form = new FormData();
      form.append("file", pickedFile);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("signature", signed.signature);
      if (signed.folder) form.append("folder", signed.folder);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`;
      const upRes = await fetch(uploadUrl, { method: "POST", body: form });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up?.error?.message || "Upload failed");

  await sendAttachment({
        url: up.url,
        secureUrl: up.secure_url,
        publicId: up.public_id,
        resourceType: up.resource_type,
        bytes: up.bytes,
        width: up.width,
        height: up.height,
        format: up.format,
        originalFilename: up.original_filename,
  }, caption || undefined);
      toast.success("Sent attachment");
      cancelPicked();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send attachment");
    } finally {
      setBusy(false);
    }
  }

  function cancelPicked() {
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    setPickedFile(null);
    setPickedPreview(null);
  setPickedType(null);
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
  <div className="flex items-center gap-3 p-3 border-b">
        <Avatar className="h-9 w-9 overflow-hidden">
          <img src={other.avatarUrl || ""} className="h-full w-full object-cover" />
          <AvatarFallback>
            {(other.displayName || other.username || "").slice(0, 1).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-semibold leading-tight flex items-center gap-2">
            {other.username ? (
              <Link href={`/user/${encodeURIComponent(other.username)}`} className="hover:underline" prefetch={false}>
                {other.displayName || other.username}
              </Link>
            ) : (
              <span>{other.displayName || "User"}</span>
            )}
            {(other as any)?.isPremium && <PremiumBadge compact />}
          </div>
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
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 bg-muted/30">
    {messages.map((m, i) => {
          const mine = m.senderId === me.uid;
          const time = m.createdAt?.toDate ? m.createdAt.toDate() : null;
          const seen = !!(mine && conv?.lastReadAt?.[other.uid]?.toMillis && m?.createdAt?.toMillis && m.createdAt.toMillis() <= conv.lastReadAt[other.uid].toMillis());
          const prev = i > 0 ? (messages[i - 1] as any) : null;
          const prevDate = prev?.createdAt?.toDate ? prev.createdAt.toDate() : null;
          const isNewDay = !prevDate || (time && prevDate && (prevDate.toDateString() !== time.toDateString()));
          return (
        <div key={m.id}>
          {isNewDay && (
            <div className="text-center text-xs text-gray-500 my-4 select-none">{formatDayLabel(time)}</div>
          )}
      <Pressable onLongPress={() => setShowMenuId(m.id)} className={`mb-4 flex items-start ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`group relative max-w-[75%] p-3 rounded-2xl shadow ${mine ? "bg-green-600 text-white rounded-br-none" : "bg-white dark:bg-gray-800 rounded-bl-none"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="w-7 h-7 overflow-hidden">
                    <img src={(mine ? me.avatarUrl : other.avatarUrl) || ""} className="h-full w-full object-cover" />
                    <AvatarFallback>
                      {(mine
                        ? (me.displayName || me.username || "")
                        : (other.displayName || other.username || "")
                      ).slice(0, 1).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1">
                    <span className={`${mine ? "text-white/90" : "text-gray-900 dark:text-gray-100"} text-xs font-medium`}>
                      {mine ? (me.displayName || me.username || "You") : (other.displayName || other.username || "User")}
                    </span>
                  </div>
                </div>
                {m.attachment ? (
                  <div className="space-y-2">
                    {m.attachment.resourceType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.attachment.url} alt={m.attachment.originalFilename || "attachment"} className="rounded-md max-h-64 object-contain" />
                    ) : m.attachment.resourceType === "video" ? (
                      <video src={m.attachment.url} controls className="rounded-md max-h-64" />
                    ) : (
                      <a href={m.attachment.url} className="underline" target="_blank" rel="noreferrer">Download file</a>
                    )}
                    {m.text ? <div>{m.text}</div> : null}
                  </div>
                ) : editingId === m.id ? (
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
                    />
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={async () => {
                      const text = editText.trim();
                      if (text) await updateDoc(doc(db, "conversations", conversationId, "messages", m.id), { text });
                      setEditingId(null);
                    }}>Save</Button>
                  </div>
                ) : (
                  <>{m.text}</>
                )}
                {/* Reactions row */}
                {premium && (
                  <div className={`mt-1 flex gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {Object.entries((m.reactions || {}) as Record<string, string>)
                      .reduce<Record<string, number>>((acc, [, emo]) => {
                        acc[emo] = (acc[emo] || 0) + 1;
                        return acc;
                      }, {})
                    && Object.entries(
                      Object.entries((m.reactions || {}) as Record<string, string>).reduce<Record<string, number>>((acc, [, emo]) => {
                        acc[emo] = (acc[emo] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emo, count]) => (
                      <span key={emo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${mine ? "bg-green-700/40" : "bg-black/5 dark:bg-white/10"}`}>
                        <span>{emo}</span>
                        <span>{count as number}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className={`text-[10px] opacity-70 mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
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
                            return;
                          }
                          // If this message has a Cloudinary attachment, delete it first
                          const att = m?.attachment;
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
                        <button className="block px-3 py-2 text-sm w-full text-left text-red-600" data-no-longpress onClick={async () => {
                          try {
                            if (m.senderId !== me.uid) {
                              toast.error("You can only delete your own messages");
                              return;
                            }
                            const att = m?.attachment;
                            if (att?.provider === "cloudinary" && att?.publicId) {
                              const rt = att.resourceType === "image" || att.resourceType === "video" || att.resourceType === "raw" ? att.resourceType : undefined;
                              await fetch("/api/cloudinary-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ public_id: att.publicId, resource_type: rt }) }).catch(() => {});
                            }
                            await deleteDoc(doc(db, "conversations", conversationId, "messages", m.id));
                          } catch (e) {
                            console.error(e);
                            toast.error("Failed to delete message");
                          } finally {
                            setShowMenuId(null);
                          }
                        }}>Delete</button>
                        {premium ? (
                          <>
                            <div className="h-px bg-border my-1"/>
                            <div className="px-3 py-1 text-[11px] opacity-70">React</div>
                            <div className="px-2 pb-2 flex gap-1">
                              {["👍","❤️","😂","😮","😢","🙏"].map((emo) => (
                                <button key={emo} className="h-7 w-7 rounded bg-muted hover:bg-muted/80" onClick={() => react(m.id, emo)} data-no-longpress>{emo}</button>
                              ))}
                            </div>
                            <button className="block px-3 py-2 text-sm w-full text-left" data-no-longpress onClick={() => togglePin(m.id)}>
                              {pinnedIds.has(m.id) ? 'Unpin' : 'Pin'}
                            </button>
                          </>
                        ) : (
                          <Link href="/pricing" className="block px-3 py-2 text-sm w-full text-left" data-no-longpress>Unlock Premium</Link>
                        )}
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
                        {premium ? (
                          <>
                            <div className="h-px bg-border my-1"/>
                            <div className="px-3 py-1 text-[11px] opacity-70">React</div>
                            <div className="px-2 pb-2 flex gap-1">
                              {["👍","❤️","😂","😮","😢","🙏"].map((emo) => (
                                <button key={emo} className="h-7 w-7 rounded bg-muted hover:bg-muted/80" onClick={() => react(m.id, emo)} data-no-longpress>{emo}</button>
                              ))}
                            </div>
                            <button className="block px-3 py-2 text-sm w-full text-left" data-no-longpress onClick={() => togglePin(m.id)}>
                              {pinnedIds.has(m.id) ? 'Unpin' : 'Pin'}
                            </button>
                          </>
                        ) : (
                          <Link href="/pricing" className="block px-3 py-2 text-sm w-full text-left" data-no-longpress>Unlock Premium</Link>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </Pressable>
        </div>
          );
        })}
      </div>

      {/* Composer */}
  <div className="p-3 border-t flex items-center gap-2">
        {pickedPreview ? (
          <>
            <AttachmentButton deferred onPicked={onFilePicked} disabled title="Attach" />
            <Button size="sm" variant="secondary" onClick={() => { /* open modal below */ }} disabled className="hidden"/>
          </>
        ) : (
          <AttachmentButton deferred onPicked={onFilePicked} disabled={busy || blocked.byMe || blocked.byOther} />
        )}
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
  <MediaPreviewModal
      open={!!pickedPreview}
      url={pickedPreview}
      filename={pickedFile?.name || null}
  mimeType={pickedType}
      caption={caption}
      setCaption={setCaption}
      onCancel={cancelPicked}
      onSend={async () => {
        // optionally include caption with message text
        await sendPicked();
        setCaption("");
      }}
      />
    </div>
  );
}

function Pressable({ onLongPress, className, children }: { onLongPress: () => void; className?: string; children: React.ReactNode }) {
  // Wrap the hook to ignore long-press when pressing on interactive controls
  const handlers = useLongPress(() => {
    onLongPress();
  }, 500);
  const stopIfNoLongPress = (e: React.SyntheticEvent) => {
    const el = e.target as HTMLElement;
    if (!el) return;
    // Skip long-press if the target or its ancestors opt-out
    if (el.closest('[data-no-longpress]')) return;
    // Otherwise forward to handlers
    // @ts-ignore - React SyntheticEvent types differ by event kind
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
