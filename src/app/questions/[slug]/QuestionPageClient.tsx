"use client";

import React, { useEffect } from "react";
import { updateDoc, increment, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { resolveUserDocId } from "@/lib/utils";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { MentionText } from "@/components/ui/MentionText";
import { ReactionBar } from "@/components/ui/ReactionBar";
import AnswerSection from "@/components/answers/AnswerSection";

interface Question {
  id: string;
  title: string;
  content: string;
  image?: string;
  createdAt: string | null;
  author: { username?: string };
  views?: number;
}

export default function QuestionPageClient({ question }: { question: Question }) {
  const [qAuthorUid, setQAuthorUid] = React.useState<string | null>(null);
  const [qAuthorUsername, setQAuthorUsername] = React.useState<string | null>(null);
  const [answerCount, setAnswerCount] = React.useState<number>(0);

  const currentUser = getAuth().currentUser;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const qRef = doc(db, "questions", question.id);
        await updateDoc(qRef, { views: increment(1) });
        const qSnap = await getDoc(qRef);
        const qData = qSnap.data() as any;
        let authorUid: string | null = qData?.author?.id || qData?.uid || qData?.author?.uid || null;
        let authorUsername: string | null = qData?.author?.username || null;
        if (!authorUid && authorUsername) {
          try {
            const { getDocs, collection, query, where } = await import('firebase/firestore');
            const uSnap = await getDocs(query(collection(db, 'users'), where('username', '==', authorUsername)));
            if (!uSnap.empty) authorUid = (uSnap.docs[0].data() as any)?.uid || authorUid;
          } catch {}
        }
        if (active) {
          setQAuthorUid(authorUid);
          setQAuthorUsername(authorUsername);
        }
        // Metrics/backfill
        try {
          if (authorUid) {
            const needUid = !qData?.uid;
            const needAuthorId = !(qData?.author && qData.author.id);
            if (needUid || needAuthorId) {
              await updateDoc(qRef, {
                ...(needUid ? { uid: authorUid } : {}),
                ...(needAuthorId ? { 'author.id': authorUid } : {}),
              } as any);
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateKey = today.toISOString().slice(0, 10);
            const ts = today.getTime();
            const userDocId = (await resolveUserDocId(authorUid)) || authorUid;
            const viewDocRef = doc(db, 'users', userDocId, 'viewsDaily', dateKey);
            await setDoc(viewDocRef, { ts, total: increment(1), questions: increment(1) }, { merge: true });
          }
        } catch (e) {
          console.warn('viewsDaily metric update failed', e);
        }
        // Answer count (lightweight)
        try {
          const { getDocs, collection } = await import('firebase/firestore');
          const snap = await getDocs(collection(db, 'questions', question.id, 'answers'));
          if (active) setAnswerCount(snap.size);
        } catch {}
      } catch (e) {
        console.error('Failed to load question metadata', e);
      }
    })();
    return () => { active = false; };
  }, [question.id]);

  // All answer CRUD handled inside AnswerSection now.

  // Loading skeleton removed; AnswerSection handles its own loading state.

  // Safe date formatter to avoid 'Invalid Date'
  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Unknown date';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString();
  };

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      {/* 🟦 Question */}
      <section className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Edited by admin banner */}
        {(question as any)?.editedBy?.role === 'admin' && (
          <div className="mb-4 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-3 py-2 rounded-lg">
            Edited by {((question as any).editedBy.username ? (
              <Link href={`/user/${(question as any).editedBy.username}`} className="underline font-medium">{(question as any).editedBy.username}</Link>
            ) : 'Admin')} { (question as any).editedBy.at ? `on ${new Date(((question as any).editedBy.at?.toDate ? (question as any).editedBy.at.toDate() : (question as any).editedBy.at)).toLocaleDateString()}` : '' }
          </div>
        )}
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4"><MentionText text={question.title} /></h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none mb-6">
          <div dangerouslySetInnerHTML={{ __html: question.content }} />
        </div>
        
        {question.image && (
          <div className="my-6">
            <img
              src={question.image}
              alt="Question"
              className="rounded-lg border shadow-sm max-w-full h-auto mx-auto"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1">
            Asked by{" "}
            {question.author?.username ? (
              <Link
                href={`/user/${question.author.username}`}
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                {question.author.username}
                {(question as any).author?.verified && <VerifiedTick size={14} />}
              </Link>
            ) : (
              <span className="italic">Unknown user</span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span>•</span>
            <span>{question.views ?? 0} views</span>
            <span>•</span>
            <span>{answerCount} answers</span>
            <span>•</span>
            <span>{formatDate(question.createdAt)}</span>
          </div>
        </div>

        {/* Reactions on the question */}
        <div className="mt-6">
          <ReactionBar collection="questions" id={question.id} />
        </div>
      </section>

      {/* 🟦 Answers */}
      <AnswerSection questionId={question.id} />
    </div>
  );
}