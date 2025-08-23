"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  increment,
  serverTimestamp,
  addDoc,
  doc,
  query,
  where,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { resolveUserDocId } from "@/lib/utils";
import { notifyMentions } from "@/lib/notifications";
import { awardAnswerBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowUpIcon } from "@heroicons/react/24/solid";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { MentionText } from "@/components/ui/MentionText";
import { ReactionBar } from "@/components/ui/ReactionBar";

interface Question {
  id: string;
  title: string;
  content: string;
  image?: string;
  createdAt: string | null;
  author: { username?: string };
  views?: number;
}

interface Answer {
  id: string;
  text: string;
  createdAt?: any;
  author: {
    uid: string;
    username: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  upvotes?: number;
  hasUpvoted?: boolean;
  accepted?: boolean;
}

export default function QuestionPageClient({ question }: { question: Question }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reply, setReply] = useState("");
  const [replyHtml, setReplyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [qAuthorUid, setQAuthorUid] = useState<string | null>(null);
  const [qAuthorUsername, setQAuthorUsername] = useState<string | null>(null);

  const currentUser = getAuth().currentUser;

  // ⏫ Load answers and increment view count
  useEffect(() => {
    const fetchAnswers = async () => {
      try {
  const qRef = doc(db, "questions", question.id);
  await updateDoc(qRef, { views: increment(1) });
  // Load question author identity
  const qSnap = await getDoc(qRef);
  const qData = qSnap.data() as any;
  let authorUid: string | null = qData?.author?.id || qData?.uid || qData?.author?.uid || null;
  let authorUsername: string | null = qData?.author?.username || null;

  // Fallback: look up uid by username if still missing
  if (!authorUid && authorUsername) {
    try {
      const uSnap = await getDocs(query(collection(db, 'users'), where('username', '==', authorUsername)));
      if (!uSnap.empty) {
        const u = uSnap.docs[0]?.data() as any;
        authorUid = u?.uid || null;
      }
    } catch (e) {
      console.warn('author uid lookup by username failed', e);
    }
  }

  setQAuthorUid(authorUid);
  setQAuthorUsername(authorUsername);

  // Increment per-author daily view metric
  try {
    if (authorUid) {
      // Backfill uid/author.id into the question for reliable analytics queries
      try {
        const needUid = !qData?.uid;
        const needAuthorId = !(qData?.author && qData.author.id);
        if (needUid || needAuthorId) {
          await updateDoc(qRef, {
            ...(needUid ? { uid: authorUid } : {}),
            ...(needAuthorId ? { 'author.id': authorUid } : {}),
          } as any);
        }
      } catch (e) {
        console.warn('question uid backfill failed', e);
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

        const answersRef = collection(db, "questions", question.id, "answers");
        const snapshot = await getDocs(answersRef);

        const answerList: Answer[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let user: any = null;
            const auid: string | undefined = data?.author?.uid;
            if (auid) {
              try {
                const userQuery = query(collection(db, "users"), where("uid", "==", auid));
                const userSnap = await getDocs(userQuery);
                user = userSnap.docs[0]?.data() || null;
              } catch (e) {
                console.warn("load answer user failed", e);
              }
            }

            const upvotes = data.upvotes || 0;

            let hasUpvoted = false;
            if (currentUser) {
              const voteRef = doc(
                db,
                "questions",
                question.id,
                "answers",
                docSnap.id,
                "votes",
                currentUser.uid
              );
              const voteSnap = await getDoc(voteRef);
              hasUpvoted = voteSnap.exists();
            }

            return {
              id: docSnap.id,
              text: data.text,
              createdAt: data.createdAt,
              upvotes,
              hasUpvoted,
              author: {
                uid: data?.author?.uid || "",
                username: user?.username || data?.author?.username || "Anonymous",
                avatarUrl:
                  user?.avatarUrl ||
                  `https://api.dicebear.com/8.x/initials/svg?seed=${(user?.username || data?.author?.username || "U")}`,
                verified: !!(user?.verified || data?.author?.verified),
              },
              accepted: !!data.accepted,
            };
          })
        );

        const sorted = answerList.sort((a, b) => (Number(!!b.accepted) - Number(!!a.accepted)) || ((b.upvotes || 0) - (a.upvotes || 0)));
        setAnswers(sorted);
      } catch (err) {
        console.error("❌ Failed to load answers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();
  }, [question.id]);

  // ✍️ Submit new answer
  const submitAnswer = async () => {
  if (!replyHtml.trim() || !currentUser) return;

    try {
      const userQuery = query(collection(db, "users"), where("uid", "==", currentUser.uid));
      const userSnap = await getDocs(userQuery);
      const user = userSnap.docs[0]?.data();

  const newAnswer = {
    text: replyHtml.trim(),
        createdAt: serverTimestamp(),
        upvotes: 0,
        author: {
          uid: currentUser.uid,
          username: user?.username || "Anonymous",
          avatarUrl:
            user?.avatarUrl ||
            `https://api.dicebear.com/8.x/initials/svg?seed=${user?.username || "U"}`,
      verified: !!user?.verified,
        },
      };

      const ref = collection(db, "questions", question.id, "answers");
      const docRef = await addDoc(ref, newAnswer);

    setAnswers((prev) => [
        ...prev,
        {
      ...newAnswer,
          id: docRef.id,
          hasUpvoted: false,
        } as Answer,
      ]);
    setReply("");
    setReplyHtml("");

      // Increment user's answers count and award achievements
      try {
        const userDoc = userSnap.docs[0];
        if (userDoc) {
          const userRef = doc(db, "users", userDoc.id);
          const prevAnswers = Number((user || {}).stats?.answers || 0);
          const nextAnswers = prevAnswers + 1;
          await updateDoc(userRef, { "stats.answers": nextAnswers });
          await awardAnswerBadges({
            userRef,
            currentBadges: (user || {}).badges || [],
            nextAnswerCount: nextAnswers,
          });
          await recomputeVerificationFromSnapshot(userRef);
        }
      } catch (e) {
        console.warn("answers stat/badges update failed", e);
      }

      // Notify mentions from the answer text
      try {
        await notifyMentions({
          from: { uid: currentUser.uid, username: user?.username, avatarUrl: user?.avatarUrl },
          text: reply,
          title: `New answer on: ${question.title}`,
          url: `/questions/${(question as any).slug || question.id}`,
        });
      } catch (e) {
        console.warn("notifyMentions(answer) failed", e);
      }
    } catch (err) {
      console.error("❌ Error posting answer:", err);
    }
  };

  // Helper to get a user docRef by uid
  const getUserDocRefByUid = async (uid?: string | null) => {
    if (!uid) return null;
    const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
    const d = snap.docs[0];
    return d ? doc(db, "users", d.id) : null;
  };

  // Accept/unaccept toggle; only question author can call
  const toggleAccept = async (answerId: string) => {
    if (!currentUser) return;
    // Check ownership by uid or username fallback
  const isOwner = !!qAuthorUid && currentUser.uid === qAuthorUid;
    if (!isOwner) return;

    const ansRef = doc(db, "questions", question.id, "answers", answerId);
    const current = answers.find(a => a.id === answerId);
    if (!current) return;
    const already = !!current.accepted;
    const prevAccepted = answers.find(a => a.accepted && a.id !== answerId);

    try {
      if (already) {
        await updateDoc(ansRef, { accepted: false });
        // Decrement points from this answerer
        const userRef = await getUserDocRefByUid(current.author.uid);
        if (userRef) {
          const snap = await getDocs(query(collection(db, "users"), where("uid", "==", current.author.uid!)));
          const u = snap.docs[0]?.data() as any;
          const curRep = Number(u?.stats?.reputation || 0);
          await updateDoc(userRef, { "stats.reputation": Math.max(0, curRep - 15) });
        }
      } else {
        if (prevAccepted) {
          const prevRef = doc(db, "questions", question.id, "answers", prevAccepted.id);
          await updateDoc(prevRef, { accepted: false });
          const prevUserRef = await getUserDocRefByUid(prevAccepted.author.uid);
          if (prevUserRef) {
            const prevSnap = await getDocs(query(collection(db, "users"), where("uid", "==", prevAccepted.author.uid!)));
            const prev = prevSnap.docs[0]?.data() as any;
            const rep = Number(prev?.stats?.reputation || 0);
            await updateDoc(prevUserRef, { "stats.reputation": Math.max(0, rep - 15) });
          }
        }
        await updateDoc(ansRef, { accepted: true });
        // Award points
        const userRef = await getUserDocRefByUid(current.author.uid);
        if (userRef) {
          const snap = await getDocs(query(collection(db, "users"), where("uid", "==", current.author.uid!)));
          const u = snap.docs[0]?.data() as any;
          const curRep = Number(u?.stats?.reputation || 0);
          await updateDoc(userRef, { "stats.reputation": curRep + 15 });
        }
        try { await updateDoc(doc(db, "questions", question.id), { acceptedAnswerId: answerId }); } catch {}
      }

      setAnswers(prev => {
        const next = prev.map(a => a.id === answerId ? { ...a, accepted: !already } : (prevAccepted && a.id === prevAccepted.id ? { ...a, accepted: false } : a));
        return next.sort((a, b) => (Number(!!b.accepted) - Number(!!a.accepted)) || ((b.upvotes || 0) - (a.upvotes || 0)));
      });
    } catch (e) {
      console.error("Failed to toggle accept:", e);
    }
  };

  // ⬆️ Handle Upvote Toggle
  const handleUpvote = async (answerId: string) => {
    if (!currentUser) return;

    const answerRef = doc(db, "questions", question.id, "answers", answerId);
    const voteRef = doc(answerRef, "votes", currentUser.uid);

    const voteSnap = await getDoc(voteRef);
    const isUpvoted = voteSnap.exists();

    try {
      if (isUpvoted) {
        await deleteDoc(voteRef);
        await updateDoc(answerRef, { upvotes: increment(-1) });
      } else {
        await setDoc(voteRef, { uid: currentUser.uid });
        await updateDoc(answerRef, { upvotes: increment(1) });
      }

      setAnswers((prev) =>
        prev.map((ans) =>
          ans.id === answerId
            ? {
                ...ans,
                upvotes: (ans.upvotes || 0) + (isUpvoted ? -1 : 1),
                hasUpvoted: !isUpvoted,
              }
            : ans
        )
      );
    } catch (err) {
      console.error("❌ Failed to toggle upvote:", err);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="container max-w-3xl py-10 space-y-8">
      {/* 🟦 Question */}
      <section>
        {/* Edited by admin banner */}
        {(question as any)?.editedBy?.role === 'admin' && (
          <div className="mb-3 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
            Edited by {((question as any).editedBy.username ? (
              <Link href={`/user/${(question as any).editedBy.username}`} className="underline">{(question as any).editedBy.username}</Link>
            ) : 'Admin')} { (question as any).editedBy.at ? `on ${new Date(((question as any).editedBy.at?.toDate ? (question as any).editedBy.at.toDate() : (question as any).editedBy.at)).toLocaleDateString()}` : '' }
          </div>
        )}
        <h1 className="text-3xl font-bold"><MentionText text={question.title} /></h1>
        {(question as any)?.editedBy?.role === 'admin' && (
          <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
            Edited by{' '}
            {((question as any).editedBy?.username) ? (
              <Link href={`/user/${(question as any).editedBy.username}`} className="underline">
                {(question as any).editedBy.username}
              </Link>
            ) : (
              <span>Admin</span>
            )}
            {((question as any).editedBy?.at?.toDate) && (
              <span>
                {` on ${new Date((question as any).editedBy.at.toDate()).toLocaleDateString()}`}
              </span>
            )}
          </p>
        )}
        <div
          className="text-muted-foreground mt-2"
          dangerouslySetInnerHTML={{ __html: question.content }} // Render HTML content
        />
        
        {question.image && (
          <img
            src={question.image}
            alt="Question"
            className="mt-4 rounded-lg border shadow max-w-full"
          />
        )}

  <p className="text-sm text-muted-foreground mt-2">
          Asked by{" "}
          {question.author?.username ? (
            <Link
              href={`/user/${question.author.username}`}
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              {question.author.username}
              {(question as any).author?.verified && <VerifiedTick size={14} />}
            </Link>
          ) : (
            <span className="italic">Unknown user</span>
          )}{" "}
          | {question.views ?? 0} views | {answers.length} answers |{" "}
          {question.createdAt
            ? new Date(question.createdAt).toLocaleDateString()
            : "Unknown date"}
        </p>

        {/* Reactions on the question */}
        <div className="mt-4">
          <ReactionBar collection="questions" id={question.id} />
        </div>
      </section>

      {/* 🟦 Answer List */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Answers</h2>

        {answers.length > 0 ? (
          <ul className="space-y-4">
            {answers.map((ans) => (
              <li key={ans.id} className="p-4 border rounded bg-muted">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={ans.author.avatarUrl} alt={ans.author.username} />
                    <AvatarFallback>
                      {ans.author.username?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Link href={`/user/${ans.author.username}`} className="font-medium hover:underline inline-flex items-center gap-1">
                    {ans.author.username}
                    {(ans as any).author?.verified && <VerifiedTick size={14} />}
                  </Link>
                  {ans.accepted && (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs">
                      ✓ Accepted
                    </span>
                  )}
                  {currentUser && qAuthorUid === currentUser.uid && (
                    <Button size="sm" variant={ans.accepted ? "secondary" : "outline"} className="ml-auto" onClick={() => toggleAccept(ans.id)}>
                      {ans.accepted ? "Unaccept" : "Accept"}
                    </Button>
                  )}
                </div>
                <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: ans.text }} />
                <button
                  onClick={() => handleUpvote(ans.id)}
                  className={`flex items-center gap-1 text-sm ${
                    ans.hasUpvoted ? "text-blue-600" : "text-gray-500"
                  } hover:underline`}
                >
                  <ArrowUpIcon className="h-4 w-4" />
                  {ans.upvotes || 0} Upvote{ans.upvotes === 1 ? "" : "s"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No answers yet. Be the first to reply!</p>
        )}
      </section>

      {/* 🟦 Answer Input */}
      <section>
        {currentUser ? (
          <div className="space-y-2">
            <RichTextEditor
              value={replyHtml}
              onChange={setReplyHtml}
              placeholder="Write your answer..."
            />
            <Button onClick={submitAnswer} disabled={!replyHtml.trim()}>
              Submit Answer
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Sign in to answer this question.</p>
        )}
      </section>
    </div>
  );
}
