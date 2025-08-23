'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  increment,
  writeBatch,
  limit as qLimit,
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { PlusCircle, Edit, Trash2, HelpCircle, FileText, Link2 } from 'lucide-react';
import { onSnapshot, orderBy } from 'firebase/firestore';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { getQuizzesByUser, deleteQuiz, type Quiz } from '@/lib/quiz';

type ContentItem = {
  id: string;
  title: string;
  content: string;
  image?: string;
  imageFileId?: string;
  slug?: string;
  createdAt?: Timestamp;
};

const formatDate = (timestamp?: Timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  return timestamp.toDate().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// 🧼 Helper to delete from ImageKit
async function deleteImageFromImageKit(fileId: string) {
  try {
    const res = await fetch('/api/imagekit/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error('ImageKit delete failed:', result?.error || result);
    }
  } catch (err) {
    console.error('Error calling image delete API:', err);
  }
}

export default function MyContentDashboard() {
  const [currentUser] = useAuthState(auth);
  const [questions, setQuestions] = useState<ContentItem[]>([]);
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewsSeries, setViewsSeries] = useState<
    { date: string; total: number; posts: number; questions: number }[]
  >([]);
  const [viewMode, setViewMode] = useState<'total' | 'posts' | 'questions'>('total');
  const [activeTab, setActiveTab] = useState<'all' | 'questions' | 'posts'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [density, setDensity] = useState<'cozy' | 'compact'>('cozy');
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);

  // Best-effort sanitizer without adding deps; uses DOMPurify if available, else strips scripts/styles and on* attrs
  function sanitize(html: string): string {
    if (!html) return '';
    try {
      const anyWin = globalThis as any;
      const dp = anyWin?.DOMPurify;
      if (dp && typeof dp.sanitize === 'function') {
        return dp.sanitize(html, { USE_PROFILES: { html: true } });
      }
    } catch {}
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/ on[a-z]+="[^"]*"/gi, '')
      .replace(/ on[a-z]+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  // Try to lazy-load DOMPurify on the client for stronger sanitization
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // @ts-ignore dynamic import optional
        const mod = await import('dompurify').catch(() => null);
        if (mounted && mod) {
          (globalThis as any).DOMPurify = (mod as any).default || mod;
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist filters and preferences
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage : null;
      if (!saved) return;
      const s = saved.getItem('dash.search');
      const sb = saved.getItem('dash.sortBy') as any;
      const tab = saved.getItem('dash.tab') as any;
      const den = saved.getItem('dash.density') as any;
      if (s) setSearch(s);
      if (sb === 'newest' || sb === 'oldest' || sb === 'title') setSortBy(sb);
      if (tab === 'all' || tab === 'questions' || tab === 'posts') setActiveTab(tab);
      if (den === 'cozy' || den === 'compact') setDensity(den);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage : null;
      if (!saved) return;
      saved.setItem('dash.search', search);
      saved.setItem('dash.sortBy', sortBy);
      saved.setItem('dash.tab', activeTab);
      saved.setItem('dash.density', density);
    } catch {}
  }, [search, sortBy, activeTab, density]);

  useEffect(() => {
    async function fetchContent() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const db = getFirestore();
      const username =
        currentUser.displayName || currentUser.email?.split('@')[0] || '';

      try {
        const qSnap = await getDocs(
          query(collection(db, 'questions'), where('author.username', '==', username))
        );
        const userQuestions = qSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ContentItem[];
        setQuestions(userQuestions);

        const pSnap = await getDocs(
          query(collection(db, 'posts'), where('uid', '==', currentUser.uid))
        );
        const userPosts = pSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ContentItem[];
        setPosts(userPosts);

        // Quizzes
        try {
          const qs = await getQuizzesByUser(currentUser.uid, 50);
          setMyQuizzes(qs);
        } catch {}
      } catch (err) {
        console.error('Failed to load content:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();

    // Realtime views series (last 14 days)
    let unsub: (() => void) | null = null;
    if (currentUser?.uid) {
      const db = getFirestore();
      const colRef = collection(db, 'users', currentUser.uid, 'viewsDaily');
      const q = query(colRef, orderBy('ts', 'asc'));
      unsub = onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            date: d.id, // YYYY-MM-DD
            total: Number(data?.total || 0),
            posts: Number(data?.posts || 0),
            questions: Number(data?.questions || 0),
          };
        });
        // Keep last 14 entries; if fewer, pad days with 0s
        const byId: Record<string, { total: number; posts: number; questions: number }> = {};
        rows.forEach((r) => (byId[r.date] = { total: r.total, posts: r.posts, questions: r.questions }));
        const out: { date: string; total: number; posts: number; questions: number }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          const rec = byId[key] || { total: 0, posts: 0, questions: 0 };
          out.push({ date: key.slice(5), ...rec }); // MM-DD label
        }
        setViewsSeries(out);
      });
    }
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser]);

  async function handleDelete(type: 'question' | 'post', id: string) {
    if (
      !confirm(
        'Are you sure you want to delete this? This action cannot be undone.'
      )
    )
      return;

    const db = getFirestore();
    const collectionName = type === 'question' ? 'questions' : 'posts';

    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as ContentItem;
        if (data.imageFileId) {
          await deleteImageFromImageKit(data.imageFileId);
        }
      }

      // Cascade delete related data before deleting the main doc
      try {
        if (type === 'post') {
          // Delete all comments for this post (handles nested via same postId)
          const commentsSnap = await getDocs(
            query(collection(db, 'comments'), where('postId', '==', id))
          );
          if (!commentsSnap.empty) {
            // Chunk into batches of <= 500 writes
            const chunks: any[] = [];
            const docs = commentsSnap.docs;
            for (let i = 0; i < docs.length; i += 450) {
              chunks.push(docs.slice(i, i + 450));
            }
            for (const group of chunks) {
              const batch = writeBatch(db);
              group.forEach((d: any) => batch.delete(d.ref));
              // eslint-disable-next-line no-await-in-loop
              await batch.commit();
            }
          }
        } else if (type === 'question') {
          // Delete all answers under this question
          const answersCol = collection(db, 'questions', id, 'answers');
          const ansSnap = await getDocs(answersCol);
          if (!ansSnap.empty) {
            const chunks: any[] = [];
            const docs = ansSnap.docs;
            for (let i = 0; i < docs.length; i += 450) {
              chunks.push(docs.slice(i, i + 450));
            }
            for (const group of chunks) {
              const batch = writeBatch(db);
              group.forEach((d: any) => batch.delete(d.ref));
              // eslint-disable-next-line no-await-in-loop
              await batch.commit();
            }
          }
        }
      } catch (cascadeErr) {
        console.error('Cascade delete failed (continuing):', cascadeErr);
      }

      await deleteDoc(docRef);

      if (type === 'question') {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      } else {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }

      // Decrement user stats for questions/posts atomically; clamp client-side state only
      try {
        if (currentUser?.uid) {
          const userQuery = await getDocs(
            query(collection(db, 'users'), where('uid', '==', currentUser.uid))
          );
          if (!userQuery.empty) {
            const userDocSnap = userQuery.docs[0];
            const userRef = doc(db, 'users', userDocSnap.id);
            const key = type === 'question' ? 'questions' : 'posts';
            await updateDoc(userRef, { [`stats.${key}`]: increment(-1) });
          }
        }
      } catch (e) {
        console.error('Failed to update user stats after delete:', e);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  async function handleBulkDelete() {
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    if (!ids.length) return;
    // Bulk applies to current tab only
    const tab = activeTab;
    if (tab === 'all') {
      alert('Please select Questions or Posts tab before bulk deleting.');
      return;
    }
    const type = tab === 'questions' ? 'question' : 'post';
    if (!confirm(`Delete ${ids.length} ${type}${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await handleDelete(type, id);
    }
    setSelectedIds({});
  }

  function exportSelected() {
    const ids = new Set(Object.keys(selectedIds).filter((k) => selectedIds[k]));
    if (!ids.size) return;
    const collect = (arr: ContentItem[]) => arr.filter((i) => ids.has(i.id));
    const data = activeTab === 'questions'
      ? collect(questions)
      : activeTab === 'posts'
      ? collect(posts)
      : [...collect(questions), ...collect(posts)];
    const simplified = data.map((d) => ({
      id: d.id,
      type: questions.some((q) => q.id === d.id) ? 'question' : 'post',
      title: d.title,
      slug: d.slug,
      image: d.image,
      createdAt: d.createdAt?.toMillis?.() || null,
      content: d.content,
    }));
    const blob = new Blob([JSON.stringify(simplified, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${activeTab}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function wordCountFromHtml(html: string): number {
    const txt = sanitize(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!txt) return 0;
    return txt.split(' ').length;
  }
  function readingMinutes(words: number): number {
    if (!words) return 0;
    return Math.max(1, Math.round(words / 200));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  }

  function toggleSelectAll(list: ContentItem[], checked: boolean) {
    const upd: Record<string, boolean> = { ...selectedIds };
    list.forEach((it) => {
      upd[it.id] = checked;
    });
    setSelectedIds(upd);
  }

  const normalized = (s?: string) => (s || '').toLowerCase();
  const applySearchSort = useMemo(() => {
    const run = (arr: ContentItem[]) => {
      let out = arr;
      if (search.trim()) {
        const q = normalized(search);
        out = out.filter(
          (it) => normalized(it.title).includes(q) || normalized(it.content).includes(q)
        );
      }
      out = [...out].sort((a, b) => {
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        const ta = (a.createdAt?.toMillis?.() || 0);
        const tb = (b.createdAt?.toMillis?.() || 0);
        return sortBy === 'newest' ? tb - ta : ta - tb;
      });
      return out;
    };
    return {
      questions: run(questions),
      posts: run(posts),
    };
  }, [questions, posts, search, sortBy]);

  const userDisplayName =
    currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const pageTitle = `Content Dashboard - ${userDisplayName}`;
  const pageDescription = `Manage all your questions and blog posts in one place.`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Head>
          <title>Loading Dashboard...</title>
        </Head>
        <p className="text-lg text-gray-600">Loading your dashboard...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container max-w-3xl py-8">
        <Head>
          <title>Login Required</title>
          <meta name="description" content="Please log in to view your content dashboard." />
        </Head>
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Please log in to manage your content.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContentList = (
    items: ContentItem[],
    type: 'question' | 'post'
  ) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 border-2 border-dashed rounded-lg bg-white">
          <p className="text-gray-500 mb-4">
            You haven't created any {type}s yet.
          </p>
          <Link href={type === 'question' ? '/ask' : '/new-post'}>
            <Button variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New {type === 'question' ? 'Question' : 'Post'}
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="hover:shadow-lg transition-shadow duration-300 w-full"
          >
            <div className={`flex items-start ${density === 'compact' ? 'p-3' : 'p-4'} gap-4`}>
              <div className="pt-1">
                <Checkbox
                  checked={!!selectedIds[item.id]}
                  onCheckedChange={(v) => toggleSelect(item.id, Boolean(v))}
                  aria-label="Select item"
                />
              </div>
              {item.image && (
                <div className={`relative ${density === 'compact' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-24 h-24 sm:w-28 sm:h-28'} rounded-md overflow-hidden flex-shrink-0`}>
                  <Image
                    src={item.image}
                    alt={item.title || 'Content image'}
                    fill
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
              )}
              <div className="flex flex-col justify-between h-full flex-grow min-w-0">
                <div>
                  <CardTitle className="text-base sm:text-lg mb-1 line-clamp-2 font-bold">
                    <Link
                      href={
                        type === 'question'
                          ? `/questions/${item.id}`
                          : `/blog/${item.slug || item.id}`
                      }
                      className="hover:text-primary transition-colors"
                    >
                      {item.title || 'Untitled'}
                    </Link>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                    <span>{formatDate(item.createdAt)}</span>
                    <span>•</span>
                    {(() => {
                      const wc = wordCountFromHtml(item.content || '');
                      const mins = readingMinutes(wc);
                      return (
                        <>
                          <span>{wc} words</span>
                          <span>•</span>
                          <span>{mins} min read</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700 relative overflow-hidden" style={{ maxHeight: `${density === 'compact' ? '3.75rem' : '5.5rem'}` }}>
                    <div
                      className="[&_img]:hidden [&_iframe]:hidden"
                      dangerouslySetInnerHTML={{ __html: sanitize(item.content) }}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Copy link"
                    onClick={() => {
                      const url = typeof window !== 'undefined'
                        ? `${window.location.origin}${
                            type === 'question' ? `/questions/${item.id}` : `/blog/${item.slug || item.id}`
                          }`
                        : '';
                      if (url) navigator.clipboard?.writeText(url);
                    }}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Link href={`/edit/${type}/${item.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(type, item.id)}
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Head>

      <main className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Content Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {userDisplayName}!
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/ask">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Question
                </Button>
              </Link>
              <Link href="/new-post">
                <Button variant="secondary">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Post
                </Button>
              </Link>
            </div>
          </header>

          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Views (last 14 days)</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2 mb-3">
                  {([
                    { key: 'total', label: 'All' },
                    { key: 'posts', label: 'Posts' },
                    { key: 'questions', label: 'Questions' },
                  ] as const).map((opt) => (
                    <Button
                      key={opt.key}
                      size="sm"
                      variant={viewMode === opt.key ? 'default' : 'outline'}
                      onClick={() => setViewMode(opt.key)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <ChartContainer
                  config={{
                    views: { label: 'Views', color: 'hsl(221, 83%, 53%)' },
                  }}
                  className="h-64 w-full"
                >
                  <LineChart
                    data={viewsSeries.map((r) => ({ date: r.date, value: r[viewMode] }))}
                    margin={{ left: 6, right: 12, top: 6, bottom: 6 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent nameKey="views" labelKey="date" />} />
                    <Line type="monotone" dataKey="value" stroke="var(--color-views)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </section>

          {/* My Quizzes */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-800">Your Quizzes</h2>
              <Link href="/quiz/create"><Button variant="outline"><PlusCircle className="h-4 w-4 mr-2" /> New Quiz</Button></Link>
            </div>
            {myQuizzes.length === 0 ? (
              <div className="text-sm text-gray-500 border rounded-md p-4">No quizzes yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myQuizzes.map((q) => (
                  <Card key={q.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{q.title}</div>
                        <div className="text-xs text-gray-500">{q.questions?.length || 0} questions</div>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/quiz/play/${q.id}?preview=1`}><Button size="icon" variant="ghost"><FileText className="h-4 w-4" /></Button></Link>
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={async () => {
                          if (!confirm('Delete this quiz?')) return;
                          if (!q.id) return;
                          await deleteQuiz(q.id);
                          setMyQuizzes((prev) => prev.filter((i) => i.id !== q.id));
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Questions
                </CardTitle>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{questions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Posts
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{posts.length}</div>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or content..."
                  className="w-full md:w-80"
                />
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="hidden md:inline">{density === 'compact' ? 'Compact' : 'Cozy'}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setDensity(density === 'compact' ? 'cozy' : 'compact')}>
                    {density === 'compact' ? 'Cozy density' : 'Compact density'}
                  </Button>
                </div>
                <Button variant="outline" onClick={exportSelected} disabled={!Object.values(selectedIds).some(Boolean)}>
                  Export Selected
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={!Object.values(selectedIds).some(Boolean) || activeTab === 'all'}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="posts">Posts</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">Your Questions</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Checkbox
                      checked={applySearchSort.questions.length > 0 && applySearchSort.questions.every((i) => selectedIds[i.id])}
                      onCheckedChange={(v) => toggleSelectAll(applySearchSort.questions, Boolean(v))}
                    />
                    <span>Select all</span>
                  </div>
                </div>
                {renderContentList(applySearchSort.questions, 'question')}
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">Your Posts</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Checkbox
                      checked={applySearchSort.posts.length > 0 && applySearchSort.posts.every((i) => selectedIds[i.id])}
                      onCheckedChange={(v) => toggleSelectAll(applySearchSort.posts, Boolean(v))}
                    />
                    <span>Select all</span>
                  </div>
                </div>
                {renderContentList(applySearchSort.posts, 'post')}
              </TabsContent>

              <TabsContent value="questions">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800">Your Questions</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Checkbox
                      checked={applySearchSort.questions.length > 0 && applySearchSort.questions.every((i) => selectedIds[i.id])}
                      onCheckedChange={(v) => toggleSelectAll(applySearchSort.questions, Boolean(v))}
                    />
                    <span>Select all</span>
                  </div>
                </div>
                {renderContentList(applySearchSort.questions, 'question')}
              </TabsContent>

              <TabsContent value="posts">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800">Your Posts</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Checkbox
                      checked={applySearchSort.posts.length > 0 && applySearchSort.posts.every((i) => selectedIds[i.id])}
                      onCheckedChange={(v) => toggleSelectAll(applySearchSort.posts, Boolean(v))}
                    />
                    <span>Select all</span>
                  </div>
                </div>
                {renderContentList(applySearchSort.posts, 'post')}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>
    </>
  );
}
