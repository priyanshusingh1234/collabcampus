"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface SavedPost { slug: string; title: string; username?: string; image?: string | null; savedAt: number; }

export default function SavedPage() {
  const [items, setItems] = useState<SavedPost[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("savedPosts");
      const arr: SavedPost[] = raw ? JSON.parse(raw) : [];
      setItems(arr);
    } catch {}
  }, []);

  if (!items.length) {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-bold mb-2">Saved posts</h1>
        <p className="text-muted-foreground">You haven't saved any posts yet. Save posts from their page and they'll show up here.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Saved posts</h1>
        <button
          className="text-sm text-destructive underline"
          onClick={() => { localStorage.removeItem("savedPosts"); setItems([]); }}
        >Clear all</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Card key={p.slug} className="overflow-hidden">
            {p.image && (
              <div className="aspect-[16/9] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
              </div>
            )}
            <CardContent className="p-4">
              <Link href={`/blog/${p.slug}`} className="font-medium line-clamp-2 hover:underline">{p.title}</Link>
              {p.username && <div className="text-xs text-muted-foreground mt-1">by {p.username}</div>}
              <div className="text-xs text-muted-foreground mt-2">Saved on {new Date(p.savedAt).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
