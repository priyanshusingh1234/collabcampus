"use client";






import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { MessageSquarePlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import QuestionCard from "@/components/questions/QuestionCard";

import { db } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { CATEGORIES, getCategory, toCategorySlug } from "@/lib/categories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState<number>(9);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const categoryOptions = useMemo<{ slug: string; label: string }[]>(() => {
    const seen = new Set<string>();
    CATEGORIES.forEach((c) => seen.add(c.slug));
    questions.forEach((q) => {
      const slug = (q?.category as string) || (Array.isArray(q?.tags) ? toCategorySlug((q.tags[0] || '').toString().toLowerCase()) : undefined);
      if (slug) seen.add(slug);
    });
    return Array.from(seen).map((slug) => ({
      slug,
      label: getCategory(slug)?.label || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
    }));
  }, [questions]);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const querySnapshot = await getDocs(collection(db, "questions"));
        const fetchedQuestions = await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const questionData: any = docSnap.data();
            const answersRef = collection(db, "questions", docSnap.id, "answers");
            const answerCountSnap = await getCountFromServer(answersRef);

            // Enrich with up-to-date author profile (avatar, username, verified)
            let verified = false;
            let avatarUrl = questionData?.author?.avatarUrl || "";
            let username = questionData?.author?.username || "Anonymous";
            try {
              const authorId = questionData?.author?.id;
              if (authorId) {
                const userDoc = await getDoc(doc(db, "users", authorId));
                if (userDoc.exists()) {
                  const u = userDoc.data() as any;
                  verified = !!u?.verified;
                  avatarUrl = u?.avatarUrl || avatarUrl || "";
                  username = u?.username || username;
                }
              }
            } catch {}

            return {
              id: docSnap.id,
              ...questionData,
              author: { username, avatarUrl, verified },
              image: questionData?.image || questionData?.imageUrl || null,
              answers: answerCountSnap.data().count || 0,
            } as any;
          })
        );
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const off = onAuthStateChanged(auth, (u) => setIsSignedIn(!!u));
    return () => off();
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const filtered = selectedCat === 'all' ? questions : questions.filter((q) => {
            const slug = (q?.category as string) || (Array.isArray(q?.tags) ? toCategorySlug((q.tags[0] || '').toString().toLowerCase()) : undefined);
            return slug === selectedCat;
          });
          setVisibleCount((c) => Math.min(c + 9, filtered.length));
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [questions, selectedCat]);

  // Sharing handled inside QuestionCard

  return (
    <div className="container max-w-4xl py-8 lg:py-12">
      <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-end mb-8">
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl font-headline">
            Community Questions
          </h1>
          <p className="text-lg text-muted-foreground">
            Browse questions or ask your own to get help from the community.
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="w-56">
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((c: { slug: string; label: string }) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild className="gap-2">
            <Link href="/ask">
              <MessageSquarePlus className="h-4 w-4" />
              Ask Question
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : questions.length > 0 ? (
        <>
        <div className="space-y-6">
      {(selectedCat === "all" ? questions : questions.filter((q) => {
        const slug = (q?.category as string) || (Array.isArray(q?.tags) ? toCategorySlug((q.tags[0] || '').toString().toLowerCase()) : undefined);
        return slug === selectedCat;
      })).slice(0, visibleCount).map((q, idx) => (
        <Fragment key={q.id}>
          {/* CTA after 6 items */}
          {idx === 6 && !isSignedIn && (
            <Card key={`cta-${idx}`}>
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">New here?</h3>
                  <p className="text-muted-foreground">Sign up and ask your first question or follow categories you like.</p>
                </div>
                <div className="flex gap-3">
                  <Button asChild><Link href="/auth/sign-up">Sign up</Link></Button>
                  <Button variant="outline" asChild><Link href="/categories">Browse categories</Link></Button>
                </div>
              </CardContent>
            </Card>
          )}
      <QuestionCard
              id={q.id}
              slug={q.slug}
              title={q.title}
    content={q.content}
    category={q.category || (Array.isArray(q.tags) ? q.tags[0] : undefined)}
        image={q.image || q.imageUrl}
        views={q.views}
        answers={q.answers}
        createdAt={q.createdAt?.toDate ? q.createdAt.toDate() : q.createdAt}
        author={q.author}
            />
        </Fragment>
          ))}
  </div>
  {/* Sentinel */}
  <div ref={sentinelRef} className="h-6" />
  {visibleCount < (selectedCat === 'all' ? questions.length : questions.filter((q) => {
          const slug = (q?.category as string) || (Array.isArray(q?.tags) ? toCategorySlug((q.tags[0] || '').toString().toLowerCase()) : undefined);
          return slug === selectedCat;
        }).length) && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setVisibleCount((c) => c + 9)}>Load more</Button>
          </div>
  )}
  </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No questions found.</p>
            <Button asChild className="mt-4">
              <Link href="/ask">Be the first to ask a question</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
