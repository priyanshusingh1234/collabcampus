
'use client';
// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
};

import Image from 'next/image';
const itemVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  transition: { duration: 0.48 },
  },
};





import { useEffect, useRef, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { app } from '@/lib/firebase';
import GuestLanding from '@/components/home/nonloggedin';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlogCard } from '@/components/blog/BlogCard';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import TopQuestions from '@/components/questions/TopQuestions';
import TopCommunities from '@/components/community/community';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Users,
  Star,
  ChevronRight,
} from 'lucide-react';
import { VerifiedTick } from '@/components/ui/VerifiedTick';
import dynamic from 'next/dynamic';
const AskAIWidget = dynamic(() => import('@/components/ai/AskAIWidget'), { ssr: false });
import { format } from 'date-fns';
import { CATEGORIES, getCategory, toCategorySlug } from '@/lib/categories';

export default function Home() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [topQuestions, setTopQuestions] = useState<any[]>([]);
  const [topAuthors, setTopAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  // Personalized feed state
  type FeedItem = {
    id: string;
    type: 'post' | 'question';
    title: string;
    slug?: string;
    content?: string;
    username?: string;
    avatarUrl?: string;
    image?: string;
    imageUrl?: string;
    createdAt?: any;
  author?: { verified?: boolean };
  };
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedUnsubs = useRef<(() => void)[]>([]);
  const profileByUsernameRef = useRef<Record<string, { avatarUrl: string; verified?: boolean }>>({});
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [trendingCats, setTrendingCats] = useState<Array<{ slug: string; count: number }>>([]);

  // Basic sanitizer for previews
  const sanitize = (html: string) =>
    (html || '')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/ on\w+="[^"]*"/gi, '')
      .replace(/ on\w+='[^']*'/gi, '');

  // Auth State
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
  setIsSignedIn(!!user);
  setUid(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, []);

  // Trending categories: aggregate last N posts and questions
  useEffect(() => {
    const run = async () => {
      try {
        const db = getFirestore(app);
        const [postSnap, qSnap] = await Promise.all([
          getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(300))),
          getDocs(query(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(300))),
        ]);

        const counts = new Map<string, number>();
        const bump = (slug?: string) => {
          if (!slug) return;
          counts.set(slug, (counts.get(slug) || 0) + 1);
        };

        postSnap.forEach((d) => {
          const x: any = d.data();
          const firstTag = Array.isArray(x?.tags) ? (x.tags[0] || '') : '';
          const slug = (x?.category as string) || toCategorySlug((firstTag || '').toString().toLowerCase());
          bump(slug);
        });
        qSnap.forEach((d) => {
          const x: any = d.data();
          const firstTag = Array.isArray(x?.tags) ? (x.tags[0] || '') : '';
          const slug = (x?.category as string) || toCategorySlug((firstTag || '').toString().toLowerCase());
          bump(slug);
        });

        const top = Array.from(counts.entries())
          .map(([slug, count]) => ({ slug, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        setTrendingCats(top);
      } catch (e) {
        console.warn('trending categories fetch failed', e);
        setTrendingCats([]);
      }
    };
    run();
  }, []);

  // Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const db = getFirestore(app);

        // Blogs
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        const postSnapshots = await getDocs(postsQuery);
        const posts: any[] = postSnapshots.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        // Top Questions
        const questionsQuery = query(
          collection(db, 'questions'),
          orderBy('upvotes', 'desc'),
          limit(3)
        );
        const questionSnapshots = await getDocs(questionsQuery);
        const questions = questionSnapshots.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Top Authors
        const authorsQuery = query(
          collection(db, 'users'),
          orderBy('stats.followers', 'desc'),
          limit(5)
        );
        const authorSnapshots = await getDocs(authorsQuery);
        const authors = authorSnapshots.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Enrich Blogs with Profile
  const usernames = Array.from(new Set(posts.map((p) => (p as any).username)));
  const userProfiles: Record<string, { avatarUrl: string | null; username: string; verified?: boolean }> = {};
        if (usernames.length) {
          const usersQuery = query(
            collection(db, 'users'),
            where('username', 'in', usernames)
          );
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach((doc) => {
            const data = doc.data();
            userProfiles[data.username] = {
              avatarUrl: data.avatarUrl || null,
              username: data.username,
              verified: !!data.verified,
            };
          });
        }
        const enrichedPosts = posts.map((post) => {
          const tagsArr = Array.isArray((post as any)?.tags) ? (post as any).tags : [];
          const firstTag = (tagsArr[0] || '').toString().toLowerCase();
          const category = (post as any).category || (firstTag ? toCategorySlug(firstTag) : undefined);
          return {
            ...post,
            category,
            author: userProfiles[(post as any).username] || { username: (post as any).username, avatarUrl: null, verified: false },
          };
        });

        setBlogs(enrichedPosts);
        setTopQuestions(questions);
        setTopAuthors(authors);
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Personalized feed wiring
  useEffect(() => {
    // cleanup previous listeners
    feedUnsubs.current.forEach((fn) => fn());
  feedUnsubs.current = [];
  setFeedItems([]);
  setVisibleCount(6);
    if (!uid) return;

  const db = getFirestore(app);
    let canceled = false;
    const run = async () => {
      setFeedLoading(true);
      try {
        const meSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        const me = meSnap.docs[0]?.data() as any;
        const following: string[] = Array.isArray(me?.following) ? me.following : [];
        if (!following.length || canceled) return;

        // Convert to usernames if following contains UIDs
        let usernames = [...following];
        const seemsId = following.some((v) => /[A-Za-z0-9]{16,}/.test(v));
        if (seemsId) {
          const chunks: string[][] = [];
          for (let i = 0; i < following.length; i += 10) chunks.push(following.slice(i, i + 10));
          const nameSet = new Set<string>();
          for (const c of chunks) {
            const snap = await getDocs(query(collection(db, 'users'), where('uid', 'in', c)));
            snap.forEach((d) => {
              const u = d.data() as any;
              if (u?.username) nameSet.add(u.username);
            });
          }
          usernames = Array.from(nameSet);
        }

        if (!usernames.length || canceled) return;

        // Preload profiles for avatarUrl by username (chunked)
  profileByUsernameRef.current = {} as any;
        const userChunks: string[][] = [];
        for (let i = 0; i < usernames.length; i += 10) userChunks.push(usernames.slice(i, i + 10));
        for (const c of userChunks) {
          const snap = await getDocs(query(collection(db, 'users'), where('username', 'in', c)));
          snap.forEach((d) => {
            const u = d.data() as any;
            const uname = u?.username as string;
            if (uname) profileByUsernameRef.current[uname] = { avatarUrl: u?.avatarUrl || '', verified: !!u?.verified };
          });
        }

        const chunks: string[][] = [];
        for (let i = 0; i < usernames.length; i += 10) chunks.push(usernames.slice(i, i + 10));

        // Posts subscription
    const postUnsubs = chunks.map((c) => {
          const q = query(
            collection(db, 'posts'),
            where('username', 'in', c),
      limit(60)
          );
          return onSnapshot(q, (snap) => {
      const next: FeedItem[] = snap.docs.map((d) => {
              const x = d.data() as any;
              return {
                id: d.id,
                type: 'post',
                title: x.title,
                slug: x.slug,
                content: x.content,
    username: x.username,
  avatarUrl: (profileByUsernameRef.current[x.username]?.avatarUrl) || x.author?.avatarUrl || x.avatarUrl || '',
  author: { verified: profileByUsernameRef.current[x.username]?.verified || x.author?.verified },
                image: x.image,
                imageUrl: x.imageUrl,
                createdAt: x.createdAt,
              };
            });
            setFeedItems((prev) => mergeSortFeed(prev, next));
          });
        });

        // Questions subscription
    const questionUnsubs = chunks.map((c) => {
          const q = query(
            collection(db, 'questions'),
            where('author.username', 'in', c),
      limit(60)
          );
          return onSnapshot(q, (snap) => {
            const next: FeedItem[] = snap.docs.map((d) => {
              const x = d.data() as any;
              const uname = x.author?.username as string | undefined;
              return {
                id: d.id,
                type: 'question',
                title: x.title,
                slug: x.slug,
                content: x.content,
                username: x.author?.username,
                avatarUrl: (uname && profileByUsernameRef.current[uname]?.avatarUrl) || x.author?.avatarUrl || '',
                author: { verified: (uname && profileByUsernameRef.current[uname]?.verified) || x.author?.verified },
                image: x.image,
                imageUrl: x.imageUrl,
                createdAt: x.createdAt,
              };
            });
            setFeedItems((prev) => mergeSortFeed(prev, next));
          });
        });

        feedUnsubs.current = [...postUnsubs, ...questionUnsubs];
      } finally {
        if (!canceled) setFeedLoading(false);
      }
    };

    run();
    return () => {
      canceled = true;
      feedUnsubs.current.forEach((fn) => fn());
      feedUnsubs.current = [];
    };
  }, [uid]);

  // Infinite scroll observer for feed
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + 9, feedItems.length || c + 9));
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedItems.length]);

  function mergeSortFeed(prev: FeedItem[], incoming: FeedItem[]) {
    const map = new Map(prev.map((p) => [`${p.type}-${p.id}`, p] as const));
    for (const it of incoming) map.set(`${it.type}-${it.id}`, it);
    const arr = Array.from(map.values());
    return arr.sort((a, b) => {
      const ta = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? new Date(a.createdAt || 0).getTime();
      const tb = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-white via-indigo-50 to-indigo-200 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 transition-colors duration-500">
      <main className="flex-grow">
        {!isSignedIn ? (
          <GuestLanding />
        ) : (
          <>
            <div className="container mx-auto px-4 md:px-6 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-4 xl:gap-12 gap-8">
              
              {/* MAIN CONTENT AREA */}
              
              <div className="lg:col-span-3 space-y-12">
                {/* Trending Categories */}
                <section id="trending-categories">
                  <div className="flex items-center justify-between mb-7">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                      <span>Trending Categories</span>
                    </h2>
                    <Button variant="ghost" asChild className="text-indigo-700 dark:text-indigo-300 group">
                      <Link href="/categories" className="inline-flex items-center gap-2 group-hover:underline group-hover:translate-x-1 transition">
                        View all <ChevronRight />
                      </Link>
                    </Button>
                  </div>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-3 sm:grid-cols-3 md:grid-cols-4"
                  >
                    {(trendingCats.length ? trendingCats : CATEGORIES.slice(0, 8).map(c => ({ slug: c.slug, count: 0 })) ).map((c) => {
                      const meta = getCategory(c.slug);
                      const label = meta?.label || c.slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
                      const emoji = meta?.emoji || '🔥';
                      return (
                        <motion.div key={c.slug} variants={itemVariants}>
                          <Link href={`/categories/${c.slug}`} className="block rounded-xl border bg-white/70 dark:bg-gray-900/60 p-4 hover:shadow-md transition group">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{emoji}</span>
                              <span className="font-medium group-hover:underline">{label}</span>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </section>
                {/* Your Feed */}
                <section id="your-feed">
                  <div className="flex items-center justify-between mb-7">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your Feed</h2>
                    <Button variant="ghost" asChild className="text-indigo-700 dark:text-indigo-300 group">
                      <Link href="/me/feed" className="inline-flex items-center gap-2 group-hover:underline group-hover:translate-x-1 transition">
                        View all <ChevronRight />
                      </Link>
                    </Button>
                  </div>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {feedLoading && !feedItems.length
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <motion.div key={i} variants={itemVariants}>
                            <Skeleton className="h-60 rounded-xl shadow-md" />
                          </motion.div>
                        ))
                      : feedItems.slice(0, visibleCount).map((it) => {
                          const cover = (it as any).image || (it as any).imageUrl || '';
                          const href = it.type === 'post' ? `/blog/${it.slug || it.id}` : `/questions/${it.slug || it.id}`;
                          const safeHTML = sanitize((it.content || '').slice(0, 220)) + ((it.content || '').length > 0 ? '…' : '');
                          return (
                            <motion.article key={`${it.type}-${it.id}`} variants={itemVariants} className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
                              {cover && (
                                <Link href={href} className="block">
                                  <Image src={cover} alt={it.title} width={600} height={320} className="h-40 w-full object-cover" />
                                </Link>
                              )}
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <Badge variant={it.type === 'post' ? 'default' : 'secondary'}>
                                    {it.type === 'post' ? 'Post' : 'Question'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {it.createdAt ? format(((it.createdAt as any)?.toDate?.() || (it.createdAt as any)) as Date, 'MMM d, yyyy') : ''}
                                  </span>
                                </div>
                                <h3 className="font-semibold leading-snug line-clamp-2">
                                  <Link href={href} className="hover:underline">{it.title}</Link>
                                </h3>
                                <div className="text-sm text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: safeHTML }} />
                                <div className="flex items-center gap-2 pt-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={it.avatarUrl || ''} alt={it.username || ''} />
                                    <AvatarFallback>{(it.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <Link href={`/user/${it.username || 'unknown'}`} className="text-sm hover:underline inline-flex items-center gap-1">
                                    {it.username || 'Unknown'}
                                    {(it as any).author?.verified && <VerifiedTick size={14} />}
                                  </Link>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })}
                  </motion.div>
                  {/* Infinite scroll sentinel and fallback button */}
                  <div ref={sentinelRef} className="h-6" />
                  {visibleCount < feedItems.length && (
                    <div className="flex justify-center mt-4">
                      <Button variant="outline" onClick={() => setVisibleCount((c) => Math.min(c + 9, feedItems.length))}>Load more</Button>
                    </div>
                  )}
                </section>

                {/* Blogs */}
                <section id="featured-articles">
                  
                  <div className="flex items-center justify-between mb-7">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                      <BookOpen className="w-7 h-7 text-indigo-400" />
                      Featured Articles
                    </h2>
                    <Button variant="ghost" asChild className="text-indigo-700 dark:text-indigo-300 group">
                      <Link href="/blogs" className="inline-flex items-center gap-2 group-hover:underline group-hover:translate-x-1 transition">
                        View all <ChevronRight />
                      </Link>
                    </Button>
                  </div>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {loading
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <motion.div key={i} variants={itemVariants}>
                            <Skeleton className="h-60 rounded-xl shadow-md" />
                          </motion.div>
                        ))
                      : blogs.map((blog) => (
                          <motion.div key={blog.id} variants={itemVariants}>
                            <BlogCard blog={blog} />
                          </motion.div>
                        ))}
                  </motion.div>
                </section>
                

                {/* Top Questions */}
                <motion.section
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-12"
                >
                  <motion.div variants={itemVariants}>
                    <div className="flex items-center gap-3 mb-7">
                      <MessageSquare className="text-green-400" />
                      <h2 className="text-2xl md:text-2xl font-semibold tracking-tight">
                        Trending Questions
                      </h2>
                    </div>
                  </motion.div>
                  <TopQuestions />
                </motion.section>
              </div>

              {/* SIDEBAR */}
              <div className="lg:col-span-1 space-y-7">
                {/* Top Authors */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className=""
                >
                  <Card className="rounded-2xl shadow-lg border-0 bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-900/70">
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <Star className="text-yellow-500" />
                          <span className="text-lg font-bold">Top Authors</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-1">
                      {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 animate-pulse py-2"
                            >
                              <Skeleton className="w-11 h-11 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-12" />
                              </div>
                            </div>
                          ))
                        : topAuthors.map((author) => (
                            <Link
                              key={author.id}
                              href={`/user/${author.username}`}
                              className="flex items-center gap-4 mb-3 py-2 hover:bg-indigo-50 dark:hover:bg-gray-800 rounded-xl transition group"
                            >
                              <Avatar className="w-11 h-11 border-2 border-indigo-200 dark:border-gray-700 group-hover:scale-105 transition">
                                {author.avatarUrl ? (
                                  <AvatarImage
                                    src={author.avatarUrl}
                                    alt={author.username}
                                  />
                                ) : (
                                  <AvatarFallback>
                                    {author.username[0].toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                                  {author.displayName || author.username}
                                  {author?.verified && <VerifiedTick size={14} />}
                                </span>
                                <span className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{author?.stats?.followers ?? (Array.isArray(author?.followers) ? author.followers.length : 0)} followers</span>
                              </div>
                            </Link>
                          ))}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top Communities */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <TopCommunities />
                </motion.div>
                
                {/* Quick Links */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Card className="bg-slate-50 dark:bg-[#14141a] border-0 rounded-2xl shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        📎 Quick Links
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 mt-2">
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start font-medium group"
                      >
                        <Link href="/ask-question" className="flex items-center gap-2 group-hover:text-indigo-600 text-gray-800 dark:text-gray-200 transition">
                          <MessageSquare /> Ask a Question
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start font-medium group"
                      >
                        <Link href="/write-article" className="flex items-center gap-2 group-hover:text-indigo-700 text-gray-800 dark:text-gray-200 transition">
                          <BookOpen /> Write Article
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start font-medium group"
                      >
                        <Link href="/groups" className="flex items-center gap-2 group-hover:text-indigo-700 text-gray-800 dark:text-gray-200 transition">
                          <Users /> Browse Communities
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </main>
  <AskAIWidget />
  </div>
  );
}