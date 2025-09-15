'use client';

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  setDoc,
} from 'firebase/firestore';
// Avoid notFound() inside client; we render a friendly message instead.
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import SeoClient from '@/components/SeoClient';
import Head from 'next/head';
import { Heart, Eye, Share2, Link as LinkIcon, Clock, Bookmark } from 'lucide-react';
import CommentSection from '@/components/comments/CommentSection';
import React from 'react';
import { awardFollowerBadges } from '@/lib/achievements';
import { recomputeVerificationFromSnapshot } from '@/lib/verification';
import { VerifiedTick } from '@/components/ui/VerifiedTick';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import { AiSummary } from '@/components/blog/AiSummary';
import { getCategory } from '@/lib/categories';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { resolveUserDocId } from '@/lib/utils';

export default function BlogPage({ params }: { params: { slug: string } }) {
  // Local premium helper (avoids build issue with external import path in this large client file)
  // localIsPremium: runtime check; absent fields => false
  const localIsPremium = (u: any) => !!(u && (u.isPremium === true || u?.subscription?.status === 'active'));
  const { slug } = params;

  const [blog, setBlog] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyOk, setCopyOk] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);

  const db = getFirestore(app);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      try {
        const slugStr = String(slug);
        const postSnap = await getDocs(
          query(collection(db, 'posts'), where('slug', '==', slugStr))
        );

        let postDoc: any = null;
        if (postSnap.empty) {
          // Fallback: support old links using doc id instead of slug
          try {
            const byId = await getDoc(doc(db, 'posts', slugStr));
            if (byId.exists()) {
              postDoc = byId;
            } else {
              return; // not found
            }
          } catch {
            return; // query failure treated as not found
          }
        } else {
          postDoc = postSnap.docs[0];
        }

        const data = postDoc.data();
        const postRef = doc(db, 'posts', postDoc.id);

        // Increment views (best-effort)
        try {
          await updateDoc(postRef, { views: increment(1) });
        } catch (e) {
          console.warn('views increment failed', e);
        }

        // Increment per-author daily view metric (best-effort)
        try {
          const authorUid: string | undefined = (data as any)?.uid;
          if (authorUid) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
            const ts = today.getTime();
            const userDocId = (await resolveUserDocId(authorUid)) || authorUid;
            const viewDocRef = doc(db, 'users', userDocId, 'viewsDaily', dateKey);
            await setDoc(viewDocRef, { ts, total: increment(1), posts: increment(1) }, { merge: true });
          }
        } catch (e) {
          console.warn('viewsDaily metric update failed', e);
        }

        setBlog({ ...data, id: postDoc.id });

        // Resolve author with guards to avoid where(undefined)
        let resolvedAuthor: any = null;
        try {
          if (data?.username) {
            const userSnap = await getDocs(
              query(collection(db, 'users'), where('username', '==', String(data.username)))
            );
            if (!userSnap.empty) {
              const authorDoc = userSnap.docs[0];
              const authorData = authorDoc.data();
              resolvedAuthor = { ...authorData, id: authorDoc.id };
            }
          }
          if (!resolvedAuthor && (data as any)?.uid) {
            const byUid = await getDocs(
              query(collection(db, 'users'), where('uid', '==', String((data as any).uid)))
            );
            if (!byUid.empty) {
              const authorDoc = byUid.docs[0];
              const authorData = authorDoc.data();
              resolvedAuthor = { ...authorData, id: authorDoc.id };
            }
          }
        } catch (e) {
          console.warn('author lookup failed', e);
        }
        if (!resolvedAuthor) {
          const embedded: any = (data as any)?.author || {};
          resolvedAuthor = {
            id: embedded.id || (data as any)?.uid || null,
            username: embedded.username || (data as any)?.username || 'Unknown',
            avatarUrl: embedded.avatarUrl || '',
            verified: !!embedded.verified,
            bio: embedded.bio || '',
            stats: embedded.stats || {},
          };
        }
        setAuthor(resolvedAuthor);

        // Auth-dependent statuses (best-effort)
        if (user) {
          try {
            const currentUserSnap = await getDocs(
              query(collection(db, 'users'), where('uid', '==', user.uid))
            );
            const currentUserDoc = currentUserSnap.docs[0];
            const following = currentUserDoc?.data()?.following || [];
            if (resolvedAuthor?.username) setIsFollowing(following.includes(resolvedAuthor.username));
          } catch (e) {
            console.warn('current user follow lookup failed', e);
          }
          try {
            const likedBy = Array.isArray((data as any)?.likedBy) ? (data as any).likedBy : [];
            setHasLiked(likedBy.includes(user.uid));
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load post:', e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [slug]);

  // Ensure the browser tab shows the post title even if server metadata is generic
  useEffect(() => {
    if (blog?.title) {
      document.title = `${blog.title} | CollabCampus`;
    }
  }, [blog?.title]);

  // Load saved status from localStorage
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem('savedPosts');
      if (!raw) return setIsSaved(false);
      const arr = JSON.parse(raw) as Array<{ slug: string }>;
      setIsSaved(arr.some((x) => x.slug === slug));
    } catch {}
  }, [slug]);

  function toggleSave() {
    try {
      const raw = localStorage.getItem('savedPosts');
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((x) => x.slug === slug);
      if (idx >= 0) {
        arr.splice(idx, 1);
        setIsSaved(false);
      } else {
        arr.unshift({
          slug,
          title: blog?.title,
          username: blog?.username,
          image: blog?.image || blog?.imageUrl || null,
          savedAt: Date.now(),
        });
        setIsSaved(true);
      }
      localStorage.setItem('savedPosts', JSON.stringify(arr.slice(0, 200)));
    } catch {}
  }

  async function toggleFollow() {
    if (!authUser || !author) return;

    const currentUserSnap = await getDocs(
      query(collection(db, 'users'), where('uid', '==', authUser.uid))
    );
    const currentUserDoc = currentUserSnap.docs[0];
    const currentUserRef = doc(db, 'users', currentUserDoc.id);
    const authorRef = doc(db, 'users', author.id);

    try {
      if (isFollowing) {
        await updateDoc(currentUserRef, { following: arrayRemove(author.username) });
        await updateDoc(authorRef, { followers: arrayRemove(authUser.displayName || authUser.email) });
        setIsFollowing(false);
      } else {
        await updateDoc(currentUserRef, { following: arrayUnion(author.username) });
        await updateDoc(authorRef, { followers: arrayUnion(authUser.displayName || authUser.email) });
        setIsFollowing(true);
      }

      // Sync numeric stats to match arrays and award badges for author
      const [freshCurrSnap, freshAuthorSnap] = await Promise.all([getDocs(query(collection(db, 'users'), where('uid', '==', authUser.uid))), getDocs(query(collection(db, 'users'), where('username', '==', author.username)))]);
      const freshCurrDoc = freshCurrSnap.docs[0];
      const freshAuthorDoc = freshAuthorSnap.docs[0];
      const freshCurr = freshCurrDoc?.data() || {};
      const freshAuthor = freshAuthorDoc?.data() || {};
      await Promise.all([
        updateDoc(currentUserRef, {
          'stats.following': Array.isArray(freshCurr?.following) ? freshCurr.following.length : 0,
        }),
        updateDoc(authorRef, {
          'stats.followers': Array.isArray(freshAuthor?.followers) ? freshAuthor.followers.length : 0,
        }),
      ]);
      try {
        await awardFollowerBadges({ userRef: authorRef, currentBadges: freshAuthor?.badges || [], nextFollowerCount: Array.isArray(freshAuthor?.followers) ? freshAuthor.followers.length : 0 });
        await recomputeVerificationFromSnapshot(authorRef);
      } catch (e) {
        console.warn('follower badge/verify update failed', e);
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  }

  async function toggleLike() {
    if (!authUser || !blog?.id) return;
    const postRef = doc(db, 'posts', blog.id);

    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(authUser.uid),
          likes: increment(-1),
        });
        setHasLiked(false);
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(authUser.uid),
          likes: increment(1),
        });
        setHasLiked(true);
      }

      setBlog((prev: any) => ({
        ...prev,
        likes: (prev.likes || 0) + (hasLiked ? -1 : 1),
      }));
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  }

  function getReadingStats(html: string | undefined) {
    if (!html) return { words: 0, minutes: 0 };
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    const minutes = Math.max(1, Math.round(words / 200));
    return { words, minutes };
  }

  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return setProgress(0);
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight - window.innerHeight;
      // amount scrolled from top of document to top of article + current offset inside article
      const scrolled = Math.min(Math.max(window.scrollY - (window.scrollY + rect.top), 0), total);
      const pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      setProgress(pct);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [blog?.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch {}
  }

  // Prepare enhanced HTML with a drop-cap on first paragraph (must be declared before any early return)
  const enhancedHtml = useMemo(() => {
    const html = String(blog?.content || '');
    if (!html) return html;
    const idx = html.indexOf('<p');
    if (idx === -1) return html;
    const end = html.indexOf('>', idx);
    if (end === -1) return html;
    const firstPTag = html.slice(idx, end + 1);
    let newPTag = '';
    if (/class\s*=/.test(firstPTag)) {
      newPTag = firstPTag.replace(/class\s*=\s*"([^"]*)"/, 'class="$1 drop-cap"');
    } else {
      newPTag = firstPTag.replace('<p', '<p class="drop-cap"');
    }
    return html.replace(firstPTag, newPTag);
  }, [blog?.content]);

  // Tags row (category + tags array if present)
  const tags: string[] = useMemo(() => {
    const arr: string[] = [];
    try {
      if (Array.isArray((blog as any)?.tags)) arr.push(...(blog as any).tags.filter(Boolean));
      if (blog?.category) arr.unshift(String(blog.category));
    } catch {}
    return Array.from(new Set(arr.map(String)));
  }, [blog?.category, (blog as any)?.tags]);

  if (loading) return <div className="p-8 text-xl">Loading...</div>;
  if (!blog) return <div className="p-8 text-xl">Post not found.</div>;

  const avatarUrl =
  (author?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${blog.username}`);
  const publishedDate = blog.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString();

  const { minutes } = getReadingStats(blog?.content);

  // enhancedHtml is prepared above

  return (
    <>
      {/* SEO for blog article */}
      {blog && (
        <SeoClient
          title={blog.title}
          description={(blog.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}
          url={typeof window !== 'undefined' ? window.location.href : `/blog/${slug}`}
          image={blog.image || blog.imageUrl || null}
          type="article"
          publishedTime={blog.createdAt?.toDate?.()?.toISOString?.() || undefined}
          authorName={author?.username || blog.username}
        />
      )}
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-40 bg-transparent">
        <div
          className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Head>
        <title>{blog.title} | CollabCampus</title>
        <meta name="description" content={blog.content.slice(0, 150)} />
      </Head>

      <Script id="structured-data" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: blog.title,
          description: blog.content.slice(0, 160),
          image: blog.image || '',
          datePublished: publishedDate,
          author: {
            '@type': 'Person',
            name: blog.username,
            url: `https://ghoops.me/user/${blog.username}`,
          },
          publisher: {
            '@type': 'Organization',
            name: 'Ghoops',
            logo: {
              '@type': 'ImageObject',
              url: 'https://ghoops.me/logo.png',
            },
          },
        })}
      </Script>

      <div className="w-full min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-10">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
            <main>
              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
                {blog.title}
              </h1>
              {/* Tags */}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((t, i) => (
                    <Link
                      key={i}
                      href={`/categories/${t}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs hover:underline"
                    >
                      #{getCategory(t)?.label || t}
                    </Link>
                  ))}
                </div>
              )}
          {blog?.editedBy?.role === 'admin' && (
            <div className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
              Edited by{' '}
              {blog.editedBy.username ? (
                <Link href={`/user/${blog.editedBy.username}`} className="underline">
                  {blog.editedBy.username}
                </Link>
              ) : (
                <span>Admin</span>
              )}
              {blog.editedBy.at && (
                <span>{` on ${new Date((blog.editedBy.at?.toDate ? blog.editedBy.at.toDate() : blog.editedBy.at)).toLocaleDateString()}`}</span>
              )}
            </div>
          )}

          {/* Byline */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <img src={avatarUrl} alt={blog.username} className="w-9 h-9 rounded-full border bg-white" />
              <Link href={`/user/${blog.username}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                {blog.username}
                {author?.verified && <VerifiedTick size={14} />}
              </Link>
              {author && localIsPremium(author) && (
                <PremiumBadge href="/pricing" />
              )}
            </div>
            <span>· {blog.createdAt ? format(blog.createdAt.toDate?.() || blog.createdAt, 'dd MMM yyyy') : ''}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" />{minutes} min read</span>
            <span className="inline-flex items-center gap-1" title="Total views"><Eye className="w-4 h-4" />{blog.views || 0}</span>
            {blog.category && (
              <Link href={`/categories/${blog.category}`} className="inline-flex items-center gap-2 ml-2 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:underline">
                <span>{getCategory(blog.category)?.label || blog.category}</span>
              </Link>
            )}
          </div>

          {/* Cover */}
          {(() => {
            const cover: string | undefined = blog.image || blog.imageUrl;
            if (!cover) return null;
            let hostOk = false;
            let isImageKit = false;
            try {
              const h = new URL(cover).hostname;
              hostOk = ["ik.imagekit.io", "placehold.co", "api.dicebear.com"].includes(h);
              isImageKit = h === "ik.imagekit.io";
            } catch {}
            const commonProps = {
              alt: blog.title || 'Cover image',
              className: 'w-full rounded-xl object-cover',
            } as const;
            return (
              <div className="w-full mt-8">
                {hostOk ? (
                  <Image src={cover} width={1280} height={720} priority unoptimized={isImageKit} {...commonProps} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} {...commonProps} />
                )}
              </div>
            );
          })()}

          {/* AI Summary */}
          <div className="my-8">
            <AiSummary blogPostContent={blog.content || ''} />
          </div>

          {/* Content */}
          <article
            ref={articleRef as any}
            className="prose-medium dark:prose-invert prose-headings:scroll-mt-20 prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: enhancedHtml }}
          />

          {/* Actions (mobile) */}
          <div className="mt-10 flex flex-wrap items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={toggleSave}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition border ${
                isSaved
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:border-amber-200'
              }`}
              aria-label={isSaved ? 'Unsave' : 'Save for later'}
              title={isSaved ? 'Remove from saved' : 'Save for later'}
           >
              <Bookmark className="w-4 h-4" />
              <span className="font-semibold">{isSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={toggleLike}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition border ${
                hasLiked ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:border-red-200'
              }`}
              aria-label={hasLiked ? 'Remove like' : 'Like this post'}
            >
              <Heart className="w-5 h-5" fill={hasLiked ? 'red' : 'none'} />
              <span className="font-semibold">{blog.likes || 0}</span>
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
              aria-label="Copy link"
            >
              <LinkIcon className="w-4 h-4" /> {copyOk ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
              aria-label="Share on Twitter"
            >
              <Share2 className="w-4 h-4" /> Tweet
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
              aria-label="Share on LinkedIn"
            >
              <Share2 className="w-4 h-4" /> Share
            </a>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(blog.title + ' ' + (typeof window !== 'undefined' ? window.location.href : ''))}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
              aria-label="Share on WhatsApp"
            >
              <Share2 className="w-4 h-4" /> WhatsApp
            </a>
          </div>

          {/* Reactions */}
          {blog.id && (
            <div className="mt-6">
              <ReactionBar collection="posts" id={blog.id} />
            </div>
          )}

          {/* Comments */}
          <section className="pt-10 mt-10 border-t border-indigo-100/60 dark:border-gray-800">
            <CommentSection postId={blog.id} slug={slug} />
          </section>
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:block sticky top-24 h-fit space-y-6">
          {/* Author card */}
          <div className="rounded-xl border border-indigo-100/60 dark:border-gray-800 p-5 bg-white/80 dark:bg-gray-900/50">
            <div className="flex items-start gap-4">
              {avatarUrl.endsWith('.svg') ? (
                <img src={avatarUrl} alt={blog.username} className="w-14 h-14 rounded-full border bg-white" />
              ) : (
                <Image src={avatarUrl} alt={blog.username} width={56} height={56} className="w-14 h-14 rounded-full border bg-white" />
              )}
              <div className="min-w-0">
                <Link href={`/user/${blog.username}`} className="font-semibold hover:underline inline-flex items-center gap-1">
                  {blog.username} {author?.verified && <VerifiedTick size={14} />}
                </Link>
                {author?.bio && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{author.bio}</p>}
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="mr-3">Followers: {author?.stats?.followers ?? 0}</span>
                  <span>Posts: {author?.stats?.posts ?? 0}</span>
                </div>
                {authUser?.displayName !== author?.username && (
                  <Button onClick={toggleFollow} className="mt-3" variant={isFollowing ? 'outline' : 'default'}>
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Share & actions */}
          <div className="rounded-xl border border-indigo-100/60 dark:border-gray-800 p-5 bg-white/80 dark:bg-gray-900/50 space-y-3">
            <div className="text-sm font-semibold">Actions</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleSave}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition border ${
                  isSaved
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:border-amber-200'
                }`}
                aria-label={isSaved ? 'Unsave' : 'Save for later'}
                title={isSaved ? 'Remove from saved' : 'Save for later'}
              >
                <Bookmark className="w-4 h-4" />
                <span className="font-semibold">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={toggleLike}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition border ${
                  hasLiked ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:border-red-200'
                }`}
                aria-label={hasLiked ? 'Remove like' : 'Like this post'}
              >
                <Heart className="w-5 h-5" fill={hasLiked ? 'red' : 'none'} />
                <span className="font-semibold">{blog.likes || 0}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
                aria-label="Copy link"
              >
                <LinkIcon className="w-4 h-4" /> {copyOk ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
                aria-label="Share on Twitter"
              >
                <Share2 className="w-4 h-4" /> Tweet
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
                aria-label="Share on LinkedIn"
              >
                <Share2 className="w-4 h-4" /> Share
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(blog.title + ' ' + (typeof window !== 'undefined' ? window.location.href : ''))}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border hover:border-indigo-200"
                aria-label="Share on WhatsApp"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-indigo-100/60 dark:border-gray-800 p-5 bg-white/80 dark:bg-gray-900/50 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {minutes} min read</span>
              <span className="inline-flex items-center gap-1" title="Total views"><Eye className="w-4 h-4" /> {blog.views || 0}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
      </div>
    </>
  );
}
