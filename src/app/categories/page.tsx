"use client";

import Link from 'next/link';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

type Cat = { slug: string; label: string; emoji?: string };

function titleCase(slug: string) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoriesPage() {
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const run = async () => {
      try {
        const snaps = await Promise.all([
          getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(200))),
          getDocs(query(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(200))),
        ]);
        const counts: Record<string, number> = {};
        for (const s of snaps) {
          for (const d of s.docs) {
            const x: any = d.data();
            const c = x?.category as string | undefined;
            if (c && typeof c === 'string') counts[c] = (counts[c] || 0) + 1;
          }
        }
        setCatCounts(counts);
      } catch {}
    };
    run();
  }, []);

  const allCats: (Cat & { count?: number })[] = useMemo(() => {
    const canon = CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, emoji: c.emoji, count: catCounts[c.slug] }));
    const extras = Object.keys(catCounts)
      .filter((s) => !CATEGORIES.some((c) => c.slug === s))
      .map((s) => ({ slug: s, label: getCategory(s)?.label || titleCase(s), emoji: '📈', count: catCounts[s] }));
    return [...canon, ...extras];
  }, [catCounts]);

  const trending = useMemo(() => {
    const withCounts = allCats
      .map((c) => ({ ...c, count: c.count || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0));
    // top 8 trending with at least 1 count; if none, fallback to first 8 canon
    const top = withCounts.filter((c) => (c.count || 0) > 0).slice(0, 8);
    if (top.length > 0) return top;
    return allCats.slice(0, 8);
  }, [allCats]);

  return (
    <div className="container mx-auto px-4 md:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover popular topics from the community</p>
      </div>

      {/* Trending chips */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Trending</h2>
        </div>
        <div className="flex w-full gap-2 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none]" style={{ scrollbarWidth: 'none' }}>
          {trending.map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-accent transition">
                <span className="text-base leading-none">{c.emoji}</span>
                <span className="font-medium">{c.label}</span>
                {typeof c.count === 'number' && c.count > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {c.count}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* All categories grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {allCats.map((c) => (
          <Card key={c.slug} className="group relative overflow-hidden border hover:shadow-sm transition">
            <Link href={`/categories/${c.slug}`} className="block p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none">{c.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="truncate text-base font-semibold group-hover:underline">{c.label}</CardTitle>
                    {typeof (c as any).count === 'number' && (c as any).count > 0 && (
                      <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/70">{(c as any).count} posts</span>
                    )}
                  </div>
                  <CardContent className="p-0 mt-1 text-sm text-muted-foreground">
                    Explore questions and posts about {c.label}.
                  </CardContent>
                </div>
              </div>
            </Link>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 opacity-0 transition-opacity group-hover:opacity-100"/>
          </Card>
        ))}
      </div>
    </div>
  );
}
