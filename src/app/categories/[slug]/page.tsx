"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { getCategory } from '@/lib/categories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuestionCard from '@/components/questions/QuestionCard';
import { BlogCard } from '@/components/blog/BlogCard';

export default function CategoryDetailPage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string;
  const cat = useMemo(() => getCategory(slug), [slug]);

  const [posts, setPosts] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const db = getFirestore(app);
        const postSnap = await getDocs(query(collection(db, 'posts'), where('category', '==', slug), orderBy('createdAt', 'desc'), limit(30)));
        const qSnap = await getDocs(query(collection(db, 'questions'), where('category', '==', slug), orderBy('createdAt', 'desc'), limit(30)));
        setPosts(postSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]);
        setQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [slug]);

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          {cat ? (
            <span className="inline-flex items-center gap-2">{cat.emoji} {cat.label}</span>
          ) : (
            'Category'
          )}
        </h1>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold mb-4">Latest Posts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {loading && !posts.length ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : posts.length ? (
              posts.map((p) => <BlogCard key={p.id} blog={p as any} />)
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No posts yet.</CardContent>
              </Card>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-4">Latest Questions</h2>
          <div className="space-y-4">
            {loading && !questions.length ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : questions.length ? (
              questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  id={q.id}
                  slug={q.slug || q.id}
                  title={q.title}
                  content={q.content}
                  tags={q.tags}
                  category={slug}
                  image={q.image || q.imageUrl}
                  views={(q as any).views || 0}
                  answers={(q as any).answers || 0}
                  createdAt={(q as any).createdAt}
                  author={{ username: q.author?.username, avatarUrl: q.author?.avatarUrl, verified: q.author?.verified }}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No questions yet.</CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
