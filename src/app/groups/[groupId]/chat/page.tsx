'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  SendHorizonal,
  Trash2,
  Edit,
  MoreVertical,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import AttachmentButton, { type AttachmentMeta } from '@/components/chat/AttachmentButton';
import MediaPreviewModal from '@/components/chat/MediaPreviewModal';
import { useLongPress } from '@/hooks/use-long-press';

interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  avatarUrl?: string;
  attachment?: {
    url: string;
    publicId: string;
    resourceType: 'image'|'video'|'raw'|'auto';
    width?: number|null;
    height?: number|null;
    bytes?: number;
    format?: string|null;
    originalFilename?: string|null;
    provider?: 'cloudinary';
  };
}

interface GroupData {
  owner: string;
  admins: string[];
  members: string[];
}

export default function GroupChatPage() {
  const { groupId } = useParams();
  const gid = Array.isArray(groupId) ? groupId[0] : (groupId as string);
  const router = useRouter();
  const [user, loadingUser, errorUser] = useAuthState(auth); // added loading and error
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [pickedType, setPickedType] = useState<string | null>(null);

  // Redirect unauthenticated users to signin page
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push('/auth/sign-in');
    }
  }, [user, loadingUser, router]);

  useEffect(() => {
  if (!user || !gid) return;

    let unsubscribeMessages: (() => void) | null = null;

    (async () => {
  const groupSnap = await getDoc(doc(db, 'groups', gid));
      if (!groupSnap.exists()) {
        toast.error('Group not found');
        router.push('/groups');
        return;
      }
      const data = groupSnap.data();
      const owner = data.createdBy || '';
      const admins: string[] = data.admins || [];
      const members: string[] = data.members || [];
      const isMember = members.includes(user.uid);

      setGroupData({ owner, admins, members });

      if (!isMember) {
        toast.error('Join the group to access chat');
        router.push(`/groups/${gid}`);
        return;
      }

      const q = query(collection(db, 'groups', gid, 'messages'), orderBy('timestamp', 'asc'));
      unsubscribeMessages = onSnapshot(q, async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ChatMessage) }));
        const senderIds = Array.from(new Set(docs.map((msg) => msg.senderId)));
        const userDocs = await Promise.all(
          senderIds.map(async (uid) => {
            const snap = await getDoc(doc(db, 'users', uid));
            return { uid, avatarUrl: snap.exists() ? snap.data().avatarUrl || '' : '' };
          })
        );
        const avatarMap: Record<string, string> = {};
        userDocs.forEach(({ uid, avatarUrl }) => {
          avatarMap[uid] = avatarUrl;
        });
        setMessages(docs.map((msg) => ({ ...msg, avatarUrl: avatarMap[msg.senderId] || '' })));
      });
    })();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [user, gid, router]);

  // Scroll to bottom on messages update
  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Focus edit input on edit start
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editingMessageId]);

  // Basic checks to allow editing/deleting only for authorized users
  const canEditMessage = (senderId: string) => {
    if (!user || !groupData) return false;
    return senderId === user.uid;
  };

  const canDeleteMessage = (senderId: string) => {
    if (!user || !groupData) return false;
    return senderId === user.uid || groupData.owner === user.uid || groupData.admins.includes(user.uid);
  };

  const getUserRole = (userId: string) => {
    if (!groupData) return '';
    if (userId === groupData.owner) return 'Owner';
    if (groupData.admins.includes(userId)) return 'Admin';
    return '';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Message actions handlers:
  const sendMessage = async () => {
  if (!text.trim() || !user || !gid) return;
    if (!groupData?.members?.includes(user.uid)) {
      toast.error('You must be a member to send messages');
      return;
    }
    try {
  await addDoc(collection(db, 'groups', gid, 'messages'), {
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
      });
      setText('');
    } catch {
      toast.error('Failed to send message');
    }
  };


  const updateMessage = async () => {
  if (!editingMessageId || !editText.trim()) return;
    if (!user || !groupData?.members?.includes(user.uid)) {
      toast.error('You must be a member to edit messages');
      return;
    }
    try {
  await updateDoc(doc(db, 'groups', gid!, 'messages', editingMessageId), {
        text: editText.trim(),
      });
      setEditingMessageId(null);
      setEditText('');
      toast.success('Message updated');
    } catch {
      toast.error('Failed to update message');
    }
    setShowMenuId(null);
  };

  async function sendAttachment(meta: AttachmentMeta) {
    if (!user || !gid) return;
    if (!groupData?.members?.includes(user.uid)) {
      toast.error('You must be a member to send attachments');
      return;
    }
    try {
      await addDoc(collection(db, 'groups', gid, 'messages'), {
        text: '',
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        attachment: {
          url: meta.secureUrl || meta.url,
          publicId: meta.publicId,
          resourceType: meta.resourceType,
          width: meta.width || null,
          height: meta.height || null,
          bytes: meta.bytes,
          format: meta.format || null,
          originalFilename: meta.originalFilename || null,
          provider: 'cloudinary',
        },
      });
    } catch {
      toast.error('Failed to send attachment');
    }
  }

  function onFilePicked(file: File, previewUrl: string) {
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    setPickedFile(file);
    setPickedPreview(previewUrl);
  setPickedType(file.type || null);
  }

  function cancelPicked() {
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    setPickedFile(null);
    setPickedPreview(null);
  setPickedType(null);
  }

  async function sendPicked() {
    if (!pickedFile || !user || !gid) return;
    if (!groupData?.members?.includes(user.uid)) {
      toast.error('You must be a member to send attachments');
      return;
    }
    try {
      // sign
      const signRes = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'chat', resource_type: 'auto' }),
      });
      const signed = await signRes.json();
      if (!signRes.ok) throw new Error(signed?.error || 'Sign failed');
      // upload
      const form = new FormData();
      form.append('file', pickedFile);
      form.append('api_key', signed.apiKey);
      form.append('timestamp', String(signed.timestamp));
      form.append('signature', signed.signature);
      if (signed.folder) form.append('folder', signed.folder);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`;
      const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up?.error?.message || 'Upload failed');
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
      });
      toast.success('Sent attachment');
      cancelPicked();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to send attachment');
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!gid) return;
    if (!user || !groupData?.members?.includes(user.uid)) {
      toast.error('You must be a member to delete messages');
      return;
    }
    try {
      // Fetch the message to check for an attachment
      const msgSnap = await getDoc(doc(db, 'groups', gid, 'messages', messageId));
      const msg = msgSnap.exists() ? (msgSnap.data() as ChatMessage) : null;
      const att = msg?.attachment;
      if (att?.provider === 'cloudinary' && att.publicId) {
        const rt = att.resourceType === 'image' || att.resourceType === 'video' || att.resourceType === 'raw' ? att.resourceType : undefined;
        await fetch('/api/cloudinary-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_id: att.publicId, resource_type: rt }),
        }).catch(() => {});
      }
      await deleteDoc(doc(db, 'groups', gid, 'messages', messageId));
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
    setShowMenuId(null);
  };

  // Hide message options menu on outside click
  useEffect(() => {
    function closeMenuOnClick(e: MouseEvent) {
      if (menuAnchor && !menuAnchor.contains(e.target as Node)) setShowMenuId(null);
    }
    if (showMenuId) document.addEventListener('mousedown', closeMenuOnClick);
    return () => {
      document.removeEventListener('mousedown', closeMenuOnClick);
    };
  }, [showMenuId, menuAnchor]);

  if (loadingUser || !user) {
    // You can show a loader or blank screen while checking auth and routing
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-100">
      <ScrollArea className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => {
          const isSelf = msg.senderId === user.uid;
          const showDateHeader =
            index === 0 || formatDate(msg.timestamp) !== formatDate(messages[index - 1]?.timestamp);

          return (
            <div key={msg.id || index}>
              {showDateHeader && (
                <div className="text-center text-xs text-gray-500 my-4 select-none">
                  {formatDate(msg.timestamp)}
                </div>
              )}
              <Pressable onLongPress={() => setShowMenuId(msg.id!)} className={cn('mb-4 flex items-start', isSelf ? 'justify-end' : 'justify-start')}>
        {(canEditMessage(msg.senderId) || canDeleteMessage(msg.senderId)) && (
                  <div
                    className="relative pr-1"
                    ref={(el) => {
                      if (showMenuId === msg.id) setMenuAnchor(el);
                    }}
                  >
                    <button
          className="appearance-none p-1 rounded-full hover:bg-gray-200 transition focus:outline-none"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowMenuId(showMenuId === msg.id ? null : msg.id!);
                      }}
                      aria-label="Open message options"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                    {showMenuId === msg.id && (
                      <div
                        className="absolute z-40 top-8 left-1 bg-white dark:bg-gray-900 shadow-lg rounded-md min-w-[120px] py-1"
                        style={{ minWidth: 120 }}
                      >
                        {canEditMessage(msg.senderId) && (
                          <button
                            className="flex w-full items-center gap-2 py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() => {
                              setEditingMessageId(msg.id!);
                              setEditText(msg.text);
                              setShowMenuId(null);
                              setTimeout(() => {
                                editInputRef.current?.focus();
                              }, 50);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        {canDeleteMessage(msg.senderId) && (
                          <button
                            className="flex w-full items-center gap-2 py-2 px-4 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500"
                            onClick={() => deleteMessage(msg.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[75%] p-3 rounded-2xl shadow relative',
                    isSelf ? 'bg-green-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 rounded-bl-none'
                  )}
                  style={{ wordBreak: 'break-word' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={msg.avatarUrl || undefined} alt={msg.senderName} />
                      <AvatarFallback>{msg.senderName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      <p
                        className={cn(
                          'text-sm font-semibold truncate max-w-[150px]',
                          isSelf ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                        )}
                        title={msg.senderName}
                      >
                        {isSelf ? 'You' : msg.senderName}
                      </p>
                      {!isSelf && getUserRole(msg.senderId) && (
                        <span className="flex items-center text-xs rounded-full px-2 py-0.5 select-none gap-1">
                          {getUserRole(msg.senderId) === 'Owner' ? (
                            <>
                              <CheckCircle2
                                className="text-blue-500 dark:text-blue-400"
                                size={14}
                                aria-label="Verified owner"
                              />
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                Owner
                              </span>
                            </>
                          ) : (
                            <>
                              <Check
                                className="text-green-600 dark:text-green-400"
                                size={10}
                                aria-label="Admin"
                              />
                              <span className="text-green-700 dark:text-green-400 font-medium">
                                Admin
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {editingMessageId === msg.id ? (
                    <div className="flex flex-col gap-2 mt-2 bg-gray-50 dark:bg-[#202123] rounded-lg p-2">
                      <Input
                        ref={editInputRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        className="flex-1 bg-white text-black dark:bg-[#202123] dark:text-white"
                        onKeyDown={(e) => e.key === 'Enter' && updateMessage()}
                        aria-label="Edit message input"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditText('');
                            setShowMenuId(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={updateMessage} disabled={!editText.trim()}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : msg.attachment ? (
                    <div className="space-y-2">
                      {msg.attachment.resourceType === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={msg.attachment.url} alt={msg.attachment.originalFilename || 'attachment'} className="rounded-md max-h-64 object-contain" />
                      ) : msg.attachment.resourceType === 'video' ? (
                        <video src={msg.attachment.url} controls className="rounded-md max-h-64" />
                      ) : (
                        <a href={msg.attachment.url} className="underline" target="_blank" rel="noreferrer">Download file</a>
                      )}
                      {msg.text ? (
                        <p className={cn(isSelf ? 'text-white' : 'text-gray-800 dark:text-gray-200')}>{msg.text}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className={cn(isSelf ? 'text-white' : 'text-gray-800 dark:text-gray-200')}>
                      {msg.text}
                    </p>
                  )}
                  <p
                    className={cn(
                      'text-xs mt-1 text-right select-none',
                      isSelf ? 'text-green-200' : 'text-gray-400'
                    )}
                    aria-label="message timestamp"
                  >
                    {msg.timestamp
                      ?.toDate?.()
                      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </Pressable>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </ScrollArea>

  <div className="p-4 border-t bg-white flex gap-2 items-center">
        {editingMessageId ? (
          <>
            <Input
              ref={editInputRef}
              placeholder="Edit message..."
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateMessage()}
              className="flex-1 bg-white text-black dark:bg-[#202123] dark:text-white"
              autoFocus
              aria-label="Edit message input"
            />
            <Button
              onClick={() => {
                setEditingMessageId(null);
                setEditText('');
                setShowMenuId(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={updateMessage} disabled={!editText.trim()}>
              Save
            </Button>
          </>
        ) : (
          <>
            {pickedPreview ? (
              <AttachmentButton deferred onPicked={() => {}} disabled title="Attach" />
            ) : (
              <AttachmentButton deferred onPicked={onFilePicked} />
            )}
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
              aria-label="Type a message"
            />
            <Button onClick={sendMessage} disabled={!text.trim()} aria-label="Send message">
              <SendHorizonal className="h-5 w-5" />
            </Button>
          </>
        )}
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
          const saved = text;
          if (caption) setText(caption);
          await sendPicked();
          setCaption('');
          if (!caption) setText(saved);
        }}
      />
    </div>
  );
}

function Pressable({ onLongPress, className, children }: { onLongPress: () => void; className?: string; children: React.ReactNode }) {
  const handlers = useLongPress(onLongPress, 500);
  return (
    <div {...handlers} className={className}>
      {children}
    </div>
  );
}
