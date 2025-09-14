"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeartIcon as HeartSolid, ChatBubbleLeftIcon } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutline, BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, collection, query, where, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { MomentDoc } from './MomentCard';
// Removed Button (not used) to keep bundle lean

interface Props { m: MomentDoc; }

export function MomentGridCard({ m }: Props) {
  const first = m.media?.[0];
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(m.likesCount || 0);
  const [busyLike, setBusyLike] = useState(false);
  const [busySave, setBusySave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const likeRef = doc(db, 'moments', m.id, 'likes', user.uid);
        const likeSnap = await getDoc(likeRef);
        if (!cancelled) setIsLiked(likeSnap.exists());
      } catch {}
      try {
        const qUser = query(collection(db, 'users'), where('uid', '==', user.uid));
        const snap = await getDocs(qUser);
        const profile = snap.docs[0]?.data();
        if (profile?.favoriteMoments?.includes(m.id) && !cancelled) setIsSaved(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user, m.id]);

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { toast({ title: 'Sign in required', description: 'Please sign in to like.' }); return; }
    if (busyLike) return;
    setBusyLike(true);
    const likeRef = doc(db, 'moments', m.id, 'likes', user.uid);
    const momentRef = doc(db, 'moments', m.id);
    const optimistic = !isLiked;
    setIsLiked(optimistic);
    setLikesCount(c => c + (optimistic ? 1 : -1));
    try {
      if (optimistic) {
        await setDoc(likeRef, { uid: user.uid, createdAt: Date.now() });
        await updateDoc(momentRef, { likesCount: increment(1) });
      } else {
        await deleteDoc(likeRef);
        await updateDoc(momentRef, { likesCount: increment(-1) });
      }
    } catch {
      setIsLiked(!optimistic);
      setLikesCount(c => c + (optimistic ? -1 : 1));
      toast({ variant: 'destructive', title: 'Unable to update like' });
    } finally { setBusyLike(false); }
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { toast({ title: 'Sign in required', description: 'Please sign in to save.' }); return; }
    if (busySave) return;
    setBusySave(true);
    try {
      const qUser = query(collection(db, 'users'), where('uid', '==', user.uid));
      const snap = await getDocs(qUser);
      const userRef = doc(db, 'users', snap.docs[0].id);
      const newState = !isSaved;
      setIsSaved(newState);
      if (newState) {
        await updateDoc(userRef, { favoriteMoments: arrayUnion(m.id) });
      } else {
        await updateDoc(userRef, { favoriteMoments: arrayRemove(m.id) });
      }
    } catch {
      setIsSaved(s => !s);
      toast({ variant: 'destructive', title: 'Unable to update favorites' });
    } finally { setBusySave(false); }
  }

  if (!first) return null;

  return (
    <Link
      href={`/moments/${m.id}`}
      className="group relative block w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 aspect-square focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <img
        src={first.url}
        alt={m.caption || `Moment by ${m.username}`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {/* Overlay gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Top bar (avatar + username) */}
      <div className="absolute top-2 left-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <img
          src={m.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${m.username}`}
          alt={m.username}
          className="h-8 w-8 rounded-full object-cover ring-2 ring-white/60 shadow"
          loading="lazy"
        />
        <span className="text-sm font-medium text-white drop-shadow flex items-center gap-1">
          {m.username}
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
        <div className="space-y-1 max-w-[70%]">
          {m.caption && (
            <p className="text-xs font-medium leading-tight text-white/90 line-clamp-2">
              {m.caption}
            </p>
          )}
          {likesCount > 0 && (
            <p className="text-[11px] text-white/70">{likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            aria-label={isLiked ? 'Unlike moment' : 'Like moment'}
            aria-pressed={isLiked}
            className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur bg-black/40 text-white transition-colors hover:bg-black/60 ${isLiked ? 'text-rose-400' : ''}`}
          >
            {isLiked ? <HeartSolid className="h-4 w-4" /> : <HeartOutline className="h-4 w-4" />}
          </button>
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Unsave moment' : 'Save moment'}
            aria-pressed={isSaved}
            className={`h-8 w-8 rounded-full flex items-center justify-center backdrop-blur bg-black/40 text-white transition-colors hover:bg-black/60 ${isSaved ? 'text-blue-400' : ''}`}
          >
            {isSaved ? <BookmarkOutline className="h-4 w-4" /> : <BookmarkOutline className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/moments/${m.id}#comments`); }}
            className="h-8 w-8 rounded-full flex items-center justify-center backdrop-blur bg-black/40 text-white transition-colors hover:bg-black/60"
            aria-label="Open comments"
            type="button"
          >
            <ChatBubbleLeftIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}

export default MomentGridCard;
