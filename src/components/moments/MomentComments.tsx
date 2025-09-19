"use client";
import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { notifyMentions } from '@/lib/notifications';
import { useMentionSuggestions } from '@/hooks/useMentionSuggestions';
import { MentionText } from '@/components/ui/MentionText';

interface CommentDoc {
  id: string;
  authorId: string;
  username: string;
  avatarUrl?: string;
  verified?: boolean;
  text: string;
  createdAt?: any;
}

export function MomentComments({ momentId, author }: { momentId: string; author?: { uid: string; username: string } }) {
  const auth = getAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mention = useMentionSuggestions(text);
  const [profileByUid, setProfileByUid] = useState<Record<string, { username?: string; avatarUrl?: string; verified?: boolean }>>({});

  useEffect(() => {
    const ref = collection(db, 'moments', momentId, 'comments');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setComments(arr);
      // Load missing avatars/usernames for commenters if needed
      const missing = Array.from(
        new Set(
          arr.filter(c => !c.avatarUrl).map(c => c.authorId).filter(Boolean)
        )
      ).filter(uid => !profileByUid[uid]);
      if (missing.length) {
        (async () => {
          try {
            // Firestore 'in' supports up to 10 per chunk
            const chunks: string[][] = [];
            for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));
            const found: Record<string, { username?: string; avatarUrl?: string; verified?: boolean }> = {};
            for (const ids of chunks) {
              const qs = await getDocs(query(collection(db, 'users'), where('uid', 'in', ids)));
              qs.docs.forEach(d => {
                const u = d.data() as any;
                if (u?.uid) found[u.uid] = { username: u.username, avatarUrl: u.avatarUrl, verified: !!u.verified };
              });
            }
            if (Object.keys(found).length) setProfileByUid(prev => ({ ...prev, ...found }));
          } catch {
            // ignore failures; fallback avatars will render
          }
        })();
      }
    });
    return () => unsub();
  }, [momentId, profileByUid]);

  async function ensureProfile(uid: string) {
    try {
      const qs = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
      const d = qs.docs[0]?.data();
      return d as any;
    } catch {
      return null;
    }
  }

  async function handleSubmit() {
    const user = auth.currentUser;
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const profile = await ensureProfile(user.uid);
      const comment = {
        authorId: user.uid,
        username: profile?.username || user.displayName || 'user',
        avatarUrl: profile?.avatarUrl || user.photoURL || null,
        verified: !!profile?.verified,
        text: text.trim(),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'moments', momentId, 'comments'), comment);
      setText("");
      toast({ title: 'Comment added' });
      // Mentions
      if (text.includes('@')) {
        try {
          await notifyMentions({
            from: { uid: user.uid, username: comment.username, avatarUrl: comment.avatarUrl },
            text: comment.text,
            title: 'Mentioned in a moment comment',
            url: `/moments/${momentId}`,
          });
        } catch {}
      }
    } catch (e:any) {
      toast({ variant: 'destructive', title: 'Failed to comment', description: e.message });
    } finally { setSubmitting(false); }
  }

  const applyMention = (username: string) => {
    const u = mention.users.find(u => u.username === username);
    if (!u) return;
    const replaced = mention.select(u);
    if (replaced != null) setText(replaced);
  };

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">Comments ({comments.length})</h2>
      <div className="space-y-4">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet. Be the first to share your thoughts.</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-3 text-sm">
            <img src={c.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${c.username}`} className="h-8 w-8 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.username}</span>
                <span className="text-[10px] text-muted-foreground">{c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleTimeString() : ''}</span>
              </div>
              <div className="leading-snug"><MentionText text={c.text} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment... Use @ to mention"
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[70px]"
        />
        {mention.open && mention.users.length > 0 && (
          <ul className="absolute left-0 top-full mt-1 w-56 rounded-md border bg-popover shadow-lg z-20 max-h-60 overflow-auto py-1 text-xs">
            {mention.users.map(u => (
              <li key={u.uid}>
                <button
                  type="button"
                  onClick={() => applyMention(u.username)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/40 text-left"
                >
                  <img src={u.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${u.username}`} className="h-5 w-5 rounded-full object-cover" />
                  <span className="flex-1 truncate">@{u.username}</span>
                  {u.verified && <span className="text-[9px] text-blue-500 font-medium">VERIFIED</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={submitting || !text.trim()} onClick={handleSubmit}>
          {submitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </div>
  );
}
