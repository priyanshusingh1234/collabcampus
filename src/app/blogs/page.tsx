

"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { BlogCard } from "@/components/blog/BlogCard";
import { db } from "@/lib/firebase";
import { CATEGORIES, getCategory, toCategorySlug } from "@/lib/categories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { isPremium } from '@/lib/premium';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  image: string;
  tags: string[];
  category?: string;
  slug: string;
  createdAt: any;
  author: {
    username: string;
  avatarUrl: string;
  verified?: boolean;
  };
}

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState<number>(9);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Build dynamic category list from loaded blogs (includes auto-generated from tags)
  const categoryOptions = useMemo<{ slug: string; label: string }[]>(() => {
    const seen = new Set<string>();
    // canonical first to keep stable order for known cats
    CATEGORIES.forEach((c) => seen.add(c.slug));
    blogs.forEach((b) => {
      const slug = (b.category || "").toString();
      if (slug) seen.add(slug);
    });
    // Map to list with friendly labels
    return Array.from(seen).map((slug) => ({
      slug,
      label:
        getCategory(slug)?.label || slug.replace(/[-_]/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
    }));
  }, [blogs]);

  useEffect(() => {
  const fetchBlogs = async () => {
      try {
        // Fetch blog posts
        const postsRef = collection(db, "posts");
        const q = query(postsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setBlogs([]);
          return;
        }

        const rawBlogs = snapshot.docs.map((doc) => {
          const data = doc.data();
          const tagsArr = Array.isArray(data.tags) ? data.tags : [];
          const firstTag = (tagsArr[0] || "").toString().toLowerCase();
          const category = (data as any).category || (firstTag ? toCategorySlug(firstTag) : undefined);
          return {
      id: doc.id,
            title: data.title || "Untitled",
            content: data.content || "",
      image: data.image || data.imageUrl || "",
            tags: data.tags || [],
            category,
      slug: data.slug || doc.id,
            username: data.username || "anonymous",
            author: {
              username: data.username || "anonymous",
              avatarUrl: data.author?.avatarUrl || data.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(data.username || 'anonymous')}`,
              verified: !!data.author?.verified,
            },
            createdAt: data.createdAt ?? null,
          };
        });

        // Build a list of unique usernames
        const uniqueUsernames = Array.from(
          new Set(rawBlogs.map((post) => post.username))
        );

        // Fetch user profiles
  const usersRef = collection(db, "users");
  const userSnapshots = await getDocs(usersRef);

  const userMap: Record<string, { avatarUrl: string; verified?: boolean; isPremium?: boolean; plan?: string | null; subscription?: any; role?: string }> = {};

        userSnapshots.forEach((doc) => {
          const data = doc.data() as any;
          if (data?.username) {
            const prem = isPremium(data); // will be false if fields absent
            userMap[data.username] = {
              avatarUrl: data.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${data.username}`,
              verified: !!data.verified,
              isPremium: prem,
              plan: data.plan ?? null,
              subscription: data.subscription ?? null,
              role: data.role ?? undefined,
            };
          }
        });

        // Map user data to blog posts
  const enrichedBlogs: BlogPost[] = rawBlogs.map((post) => {
          const user = userMap[post.username];
      return {
            ...post,
            author: {
        username: post.username,
        avatarUrl: user?.avatarUrl || post.author?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${post.username}`,
        verified: user?.verified ?? post.author?.verified,
              isPremium: user?.isPremium === true,
            },
      image: (post as any).image || (post as any).imageUrl || "",
          };
        });

        setBlogs(enrichedBlogs);
      } catch (err: any) {
        console.error("Error fetching blogs:", err);
        setError("Failed to load posts. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const off = onAuthStateChanged(auth, (u) => setIsSignedIn(!!u));
    return () => off();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + 9, filtered.length));
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [blogs, selectedCat, searchQuery]);

  const filtered = useMemo(() => {
    const pool = selectedCat === "all" ? blogs : blogs.filter((b) => (b.category || "") === selectedCat);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((b) => {
      const title = (b.title || "").toLowerCase();
      const author = (b.author?.username || "").toLowerCase();
      const tags = (b.tags || []).join(" ").toLowerCase();
      return title.includes(q) || author.includes(q) || tags.includes(q);
    });
  }, [blogs, selectedCat, searchQuery]);

  return (
    <div className="container max-w-5xl py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">All Articles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore a wealth of knowledge from our community.</p>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or tags"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(9);
              }}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setVisibleCount(9); }}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((c: { slug: string; label: string }) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground">
          <p>No posts found.</p>
          <p className="text-sm">Try adjusting filters or clearing the search.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, visibleCount)
              .map((blog, idx) => (
                <Fragment key={blog.slug}>
                  {/* CTA after 6 items */}
                  {idx === 6 && !isSignedIn && (
                    <Card className="sm:col-span-2 lg:col-span-1 flex">
                      <CardContent className="p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Enjoying the articles?</h3>
                          <p className="text-muted-foreground mt-1">Join the community to write your own or ask questions.</p>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <Button asChild>
                            <Link href="/auth/sign-up">Sign up</Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href="/new-post">Write a post</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <BlogCard blog={blog} />
                </Fragment>
              ))}
          </div>
          {/* Sentinel */}
          <div ref={sentinelRef} className="h-6" />
          {/* Load more fallback button */}
          {visibleCount < filtered.length && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + 9)}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
