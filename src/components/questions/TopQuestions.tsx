'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, DocumentData, where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import QuestionCard from '@/components/questions/QuestionCard';

interface Question {
  id: string;
  title: string;
  writer: string;
  slug: string;
  views?: number;
  image: string;
  avatarUrl?: string;
  verified?: boolean;
  stats?: {
    answers: number;
  };
  category?: string;
}

export default function TopQuestions() {
  const [topQuestions, setTopQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopQuestions = async () => {
      try {
        const q = query(
          collection(db, 'questions'),
          orderBy('views', 'desc'),
          limit(5)
        );

        const querySnapshot = await getDocs(q);

        const questions: Question[] = await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const data = doc.data() as DocumentData;
            const authorId = data.author?.id;

            let avatarUrl = '';
            let username = 'Anonymous';
            let verified = false;

            // Fetch user info
            if (authorId) {
              const userDoc = await getDocs(
                query(collection(db, 'users'), where('__name__', '==', authorId))
              );
              const userData = userDoc.docs[0]?.data();
              avatarUrl = userData?.avatarUrl || '';
              username = userData?.username || 'Anonymous';
              verified = !!userData?.verified;
            }

            // Fetch answer count from subcollection
            const answersSnapshot = await getDocs(
              collection(db, 'questions', doc.id, 'answers')
            );
            const answerCount = answersSnapshot.size;

            return {
              id: doc.id,
              title: data.title,
              slug: data.slug,
              views: data.views || 0,
              writer: username,
              image: data.image || data.imageUrl || '',
              avatarUrl,
              verified,
              category: data.category || (Array.isArray(data.tags) ? data.tags[0] : undefined),
              stats: {
                answers: answerCount,
              },
            };
          })
        );

        setTopQuestions(questions);
      } catch (error) {
        console.error('Error fetching top questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopQuestions();
  }, []);

  if (loading) {
    return <p className="text-center text-muted-foreground">Loading top questions...</p>;
  }

  if (!topQuestions.length) {
    return <p className="text-center text-muted-foreground">No top questions yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <TrendingUp className="h-5 w-5 text-primary" />
        Top Questions
      </div>

    {topQuestions.map((q) => (
        <QuestionCard
          key={q.id}
          id={q.id}
          slug={q.slug}
          title={q.title}
          image={q.image}
          views={q.views}
          answers={q.stats?.answers}
  category={q.category}
      author={{ username: q.writer, avatarUrl: q.avatarUrl, verified: q.verified }}
        />
      ))}
    </div>
  );
}
