"use client";
import Image from "next/image";
import Link from "next/link";
import { MentionText } from "@/components/ui/MentionText";
import { CheckBadgeIcon, HeartIcon, ChatBubbleLeftIcon, BookmarkIcon, EllipsisHorizontalIcon, ArrowPathRoundedSquareIcon, TrashIcon } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline, BookmarkIcon as BookmarkOutline, ChatBubbleLeftIcon as ChatOutline } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, collection, query, where, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export interface MomentDoc {
  id: string;
  authorId: string;
  username: string;
  avatarUrl?: string;
  verified?: boolean;
  caption?: string;
  createdAt?: any;
  media: Array<{ url: string; width?: number; height?: number; type?: string }>;
  likesCount?: number;
  commentsCount?: number;
  // comments live in subcollection: moments/{id}/comments with fields:
  // { authorId, username, avatarUrl, text, createdAt, mentions?: string[] }
}

export function MomentCard({ m }: { m: MomentDoc }) {
  const first = m.media?.[0];
  const auth = getAuth();
  const user = auth.currentUser;
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(m.likesCount || 0);
  const [busyLike, setBusyLike] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Load initial like + favorite state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        // Check like doc
        const likeRef = doc(db, 'moments', m.id, 'likes', user.uid);
        const likeSnap = await getDoc(likeRef);
        if (!cancelled) setIsLiked(likeSnap.exists());
      } catch {}
      try {
        // Fetch current user profile to see favorites list
        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        const profile = snap.docs[0]?.data();
        if (profile?.favoriteMoments && Array.isArray(profile.favoriteMoments) && profile.favoriteMoments.includes(m.id)) {
          if (!cancelled) setIsSaved(true);
        }
        if (!cancelled) setIsOwner(m.authorId === user.uid || !!profile?.isAdmin);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user, m.id]);

  async function handleLike() {
    if (!user) { toast({ title: 'Sign in required', description: 'Please sign in to like moments.' }); return; }
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
    } catch (e) {
      // rollback
      setIsLiked(!optimistic);
      setLikesCount(c => c + (optimistic ? -1 : 1));
      toast({ variant: 'destructive', title: 'Unable to update like' });
    } finally { setBusyLike(false); }
  }

  async function handleDeleteMoment() {
    if (!user) { toast({ title: 'Sign in required' }); return; }
    if (!isOwner) { toast({ variant: 'destructive', title: 'Not allowed' }); return; }
    if (!confirm('Delete this moment permanently?')) return;
    setDeleting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/moments/${encodeURIComponent(m.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to delete');
      toast({ title: 'Moment deleted' });
      // Optionally, emit an event or rely on feed snapshot to disappear
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e?.message });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!user) { toast({ title: 'Sign in required', description: 'Please sign in to save favorites.' }); return; }
    if (busySave) return;
    setBusySave(true);
    const qUser = query(collection(db, 'users'), where('uid', '==', user.uid));
    try {
      const snap = await getDocs(qUser);
      if (snap.empty) throw new Error('Profile missing');
      const userRef = doc(db, 'users', snap.docs[0].id);
      const newState = !isSaved;
      setIsSaved(newState);
      if (newState) {
        await updateDoc(userRef, { favoriteMoments: arrayUnion(m.id) });
        toast({ title: 'Added to favorites' });
      } else {
        await updateDoc(userRef, { favoriteMoments: arrayRemove(m.id) });
        toast({ title: 'Removed from favorites' });
      }
    } catch (e) {
      setIsSaved(s => !s); // rollback
      toast({ variant: 'destructive', title: 'Unable to update favorites' });
    } finally { setBusySave(false); }
  }
  
  const formatDate = (date: any) => {
    if (!date) return '';
    
    const postDate = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    
    return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        <Link href={`/user/${m.username}`} className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            <img
              src={m.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${m.username}`}
              className="h-10 w-10 rounded-full object-cover bg-gray-200 dark:bg-gray-700 relative z-10 border-2 border-white dark:border-gray-800"
              alt={m.username}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium flex items-center gap-1.5 group-hover:underline">
              {m.username}
              {m.verified && <CheckBadgeIcon className="h-4 w-4 text-blue-500" />}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(m.createdAt)}
            </span>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {isOwner && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-600" onClick={handleDeleteMoment} disabled={deleting} title="Delete moment">
              <TrashIcon className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Media */}
      {first && (
        <Link href={`/moments/${m.id}`} className="relative bg-black aspect-square w-full block overflow-hidden group">
          <img 
            src={first.url} 
            alt={m.caption || 'moment'} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
        </Link>
      )}

      {/* Actions */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-9 w-9 rounded-full ${isLiked ? 'text-rose-500' : 'text-foreground'}`}
            onClick={handleLike}
          >
            {isLiked ? (
              <HeartIcon className="h-5 w-5" />
            ) : (
              <HeartOutline className="h-5 w-5" />
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full"
            asChild
          >
            <Link href={`/moments/${m.id}#comments`}>
              <ChatOutline className="h-5 w-5" />
            </Link>
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full"
          >
            <ArrowPathRoundedSquareIcon className="h-5 w-5" />
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-9 w-9 rounded-full ${isSaved ? 'text-blue-500' : 'text-foreground'}`}
          onClick={handleSave}
        >
          {isSaved ? (
            <BookmarkIcon className="h-5 w-5" />
          ) : (
            <BookmarkOutline className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Likes count */}
      {likesCount > 0 && (
        <div className="px-3 pb-1">
          <p className="text-sm font-medium">
            {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        </div>
      )}

      {/* Caption */}
      {m.caption && (
        <div className="px-3 py-1.5">
          <div className="text-sm leading-snug break-words">
            <Link href={`/user/${m.username}`} className="font-medium mr-2 hover:underline">
              {m.username}
            </Link>
            <MentionText text={m.caption} />
          </div>
        </div>
      )}

      {/* Comment preview & input removed per request */}
    </div>
  );
}