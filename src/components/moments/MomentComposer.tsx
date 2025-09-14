"use client";
import { useState, useRef, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMentionSuggestions } from "@/hooks/useMentionSuggestions";
import { notifyMentions } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { XMarkIcon, PhotoIcon, AtSymbolIcon, ArrowUpTrayIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { MentionText } from "@/components/ui/MentionText";

interface UploadingMedia { file: File; preview: string; uploading?: boolean; url?: string; error?: string; fileId?: string; }

async function uploadToImageKit(file: File): Promise<{ url: string; fileId: string; filePath?: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('folder', 'posts');
  const res = await fetch('/api/imagekit/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  const json = await res.json();
  return { url: json.url as string, fileId: json.fileId as string, filePath: json.filePath as string };
}

export function MomentComposer({ onCreated, onClose }: { onCreated?: () => void; onClose?: () => void }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<UploadingMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const mention = useMentionSuggestions(caption);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when media is added
  useEffect(() => {
    if (media.length > 0 && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [media.length]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4);
    const mapped: UploadingMedia[] = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setMedia(mapped);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files || []).filter(file => 
      file.type.startsWith('image/')
    ).slice(0, 4);
    
    if (files.length > 0) {
      const mapped: UploadingMedia[] = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
      setMedia(mapped);
    }
  }

  function removeMedia(index: number) {
    setMedia(prev => prev.filter((_, i) => i !== index));
  }

  async function ensureProfile(uid: string) {
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
    const d = snap.docs[0];
    return d?.data();
  }

  async function handleSubmit() {
    if (!user || submitting) return;
    if (media.length === 0) {
      toast({ title: 'Add an image', description: 'Select at least one image.' });
      return;
    }
    setSubmitting(true);
    try {
      const profile: any = await ensureProfile(user.uid);
      const uploaded: { url: string; fileId?: string }[] = [];
      for (const item of media) {
        try {
          const { url, fileId } = await uploadToImageKit(item.file);
          uploaded.push({ url, fileId });
        } catch (e) {
          toast({ variant: 'destructive', title: 'Upload failed', description: (e as Error).message });
          throw e;
        }
      }
      const docRef = await addDoc(collection(db, 'moments'), {
        authorId: user.uid,
        username: profile?.username || 'Anonymous',
        avatarUrl: profile?.avatarUrl || null,
        verified: !!profile?.verified,
        media: uploaded,
        caption: caption.trim() || null,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      if (caption.trim()) {
        try {
          await notifyMentions({
            from: { uid: user.uid, username: profile?.username, avatarUrl: profile?.avatarUrl },
            text: caption,
            title: 'New moment posted',
            url: `/moments/${docRef.id}`,
          });
        } catch {}
      }
      setCaption("");
      setMedia([]);
      toast({ title: 'Moment shared', description: 'Your moment is live.' });
      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const applyMention = (username: string) => {
    const u = mention.users.find(u => u.username === username);
    if (!u) return;
    const replaced = mention.select(u);
    if (replaced != null) setCaption(replaced);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold">Create Moment</h2>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={submitting || media.length === 0}
            className="px-6 py-2 rounded-full font-medium"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sharing...
              </div>
            ) : (
              "Share"
            )}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {media.length === 0 ? (
            // Upload area
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <PhotoIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Upload photos</h3>
                  <p className="text-muted-foreground text-sm">
                    Drag and drop images here, or click to browse
                  </p>
                </div>
                <Button variant="outline" className="rounded-full">
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Select from computer
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPick}
                className="hidden"
              />
            </div>
          ) : (
            // Preview and caption area
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Media preview */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
                <div className="grid grid-cols-2 gap-3">
                  {media.map((m, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100 dark:bg-gray-800">
                      <img 
                        src={m.preview} 
                        alt="preview" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeMedia(i)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      {m.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <PhotoIcon className="h-4 w-4 mr-2" />
                  Add More Photos
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPick}
                  className="hidden"
                />
              </div>

              {/* Caption area */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Caption</label>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Write a caption... Use @ to mention someone"
                      className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                    />
                    <div className="absolute bottom-3 right-3">
                      <AtSymbolIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  {mention.open && mention.users.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-64 overflow-auto py-2">
                      {mention.users.map(u => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => applyMention(u.username)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                        >
                          <img 
                            src={u.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${u.username}`} 
                            className="h-8 w-8 rounded-full object-cover" 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate">@{u.username}</span>
                              {u.verified && <CheckBadgeIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                            </div>
                            {/* displayName was removed from MentionUser; if needed later extend interface */}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Character count */}
                <div className="text-xs text-muted-foreground text-right">
                  {caption.length}/2200
                </div>

                {/* Preview */}
                {caption && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Preview</h4>
                    <div className="text-sm">
                      <MentionText text={caption} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}