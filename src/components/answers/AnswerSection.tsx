"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  increment,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { notifyMentions } from "@/lib/notifications";
import { awardAnswerBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { getSuggestedTags } from "@/app/actions";
import { MentionText } from "@/components/ui/MentionText";

interface Answer {
  id: string;
  text: string;
  createdAt?: any;
  upvotes?: number;
  accepted?: boolean;
  author: {
    uid: string;
    username: string;
    avatarUrl?: string;
    verified?: boolean;
  };
}

export default function AnswerSection({ questionId }: { questionId: string }) {
  const auth = getAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [qAuthorUid, setQAuthorUid] = useState<string | null>(null);
  const [qAuthorUsername, setQAuthorUsername] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAnswers() {
      try {
  // Load question to know author and slug
  const qDocRef = doc(db, "questions", questionId);
  const qSnap = await getDoc(qDocRef);
  const qData = qSnap.data() as any;
  setQAuthorUid(qData?.author?.id || null);
  setQAuthorUsername(qData?.author?.username || null);

        const answersRef = collection(db, "questions", questionId, "answers");
        const answerSnapshot = await getDocs(answersRef);

        const allAnswers = await Promise.all(
          answerSnapshot.docs.map(async (docSnap) => {
            const answerData = docSnap.data();
            if (!answerData.author?.uid) return null;

            const userQuery = query(
              collection(db, "users"),
              where("uid", "==", answerData.author.uid)
            );
            const userSnap = await getDocs(userQuery);
            const user = userSnap.docs[0]?.data();

      return {
              id: docSnap.id,
              text: answerData.text,
              upvotes: answerData.upvotes || 0,
              createdAt: answerData.createdAt,
      accepted: !!answerData.accepted,
              author: {
                uid: answerData.author.uid,
                username: user?.username || "Anonymous",
                avatarUrl:
                  user?.avatarUrl ||
                  `https://api.dicebear.com/8.x/initials/svg?seed=${user?.username || "U"}`,
        verified: !!user?.verified,
              },
            } as Answer;
          })
        );

    const list = (allAnswers.filter(Boolean) as Answer[]).sort((a, b) => (Number(!!b.accepted) - Number(!!a.accepted)) || ((b.upvotes || 0) - (a.upvotes || 0)));
    setAnswers(list);
      } catch (err) {
        console.error("Failed to load answers:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAnswers();
  }, [questionId]);

  async function submitAnswer() {
    if (!reply.trim() || !currentUser) return;

    // Fetch user profile to check blocked status
    try {
      const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
      const userDoc = userSnap.docs[0]?.data() as any;
      if (userDoc?.blocked) {
        toast({
          variant: "destructive",
          title: "Account blocked",
          description: "You cannot post answers at this time.",
        });
        return;
      }
    } catch {}

  try {
      const userQuery = query(
        collection(db, "users"),
        where("uid", "==", currentUser.uid)
      );
      const userSnap = await getDocs(userQuery);
      const user = userSnap.docs[0]?.data();

    const newAnswer = {
        text: reply,
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
  accepted: false,
      };

  const docRef = await addDoc(
        collection(db, "questions", questionId, "answers"),
        newAnswer
      );

      setAnswers((prev) => [
  ...prev,
  { ...newAnswer, id: docRef.id } as Answer,
      ]);
      setReply("");

      // AI tag suggestion and optional merge into question.tags
      try {
        const qSnap = await getDoc(doc(db, "questions", questionId));
        const qData = qSnap.data() as any;
        const baseTitle = qData?.title || '';
  const suggestion = await getSuggestedTags({ text: `${baseTitle}\n\n${reply}`, kind: 'answer', maxTags: 5 });
        if (suggestion.tags && suggestion.tags.length > 0) {
          const confirmMerge = typeof window !== 'undefined' ? window.confirm(`Suggest tags for this thread: ${suggestion.tags.join(', ')}\n\nAdd to question tags?`) : false;
          if (confirmMerge) {
            const existing = Array.isArray(qData?.tags) ? qData.tags : [];
            const merged = Array.from(new Set([...(existing as string[]), ...suggestion.tags]));
            try {
              await updateDoc(doc(db, "questions", questionId), { tags: merged });
            } catch {}
          }
        }
      } catch (e) {
        // non-fatal
        console.warn('Tag suggestion for answer failed', e);
      }

      // Increment user's answers count and award achievements
      try {
        const userDocRefQuery = query(collection(db, "users"), where("uid", "==", currentUser.uid));
        const userDocRefSnap = await getDocs(userDocRefQuery);
        const userDoc = userDocRefSnap.docs[0];
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

      // Notify mentions in the answer text
      try {
        // get question slug for deep link
        const qSnap = await getDoc(doc(db, "questions", questionId));
        const qData = qSnap.data() as any;
        const slug = qData?.slug as string | undefined;
        await notifyMentions({
          from: { uid: currentUser.uid, username: user?.username, avatarUrl: user?.avatarUrl },
          text: reply,
          title: `New answer on: ${qData?.title || "your question"}`,
          url: slug ? `/questions/${slug}` : `/questions/${questionId}`,
        });
      } catch (e) {
        // non-fatal
        console.warn("notifyMentions(answer) failed", e);
      }
    } catch (err) {
      console.error("Error posting answer:", err);
    }
  }

  // Helper: resolve a user docRef by uid
  async function getUserDocRefByUid(uid: string) {
    const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
    const d = snap.docs[0];
    return d ? doc(db, "users", d.id) : null;
  }

  // Toggle accept/unaccept for a given answer; only question author can perform
  async function toggleAccept(answerId: string) {
    if (!currentUser || !qAuthorUid) return;
    const isOwner = currentUser.uid === qAuthorUid;
    if (!isOwner) return;

    const qRef = doc(db, "questions", questionId);
    const ansRef = doc(db, "questions", questionId, "answers", answerId);
    // Determine current acceptance
    const current = answers.find(a => a.id === answerId);
    if (!current) return;
    const alreadyAccepted = !!current.accepted;

    // If accepting a new one, unaccept any previously accepted
    let prevAccepted: Answer | undefined = answers.find(a => a.accepted && a.id !== answerId);

    try {
      if (alreadyAccepted) {
        await updateDoc(ansRef, { accepted: false });
        // Remove points from answerer
        const userRef = await getUserDocRefByUid(current.author.uid);
        if (userRef) await updateDoc(userRef, { "stats.reputation": ((current as any).stats?.reputation || 0) + 0 }); // keep idempotent, or optionally decrement
      } else {
        if (prevAccepted) {
          const prevRef = doc(db, "questions", questionId, "answers", prevAccepted.id);
          await updateDoc(prevRef, { accepted: false });
          // Optionally reverse points of previous accepted answerer
          const prevUserRef = await getUserDocRefByUid(prevAccepted.author.uid);
          if (prevUserRef) {
            // subtract 15
            const prevUserSnap = await getDocs(query(collection(db, "users"), where("uid", "==", prevAccepted.author.uid)));
            const prevUserDoc = prevUserSnap.docs[0]?.data() as any;
            const prevReputation = Number(prevUserDoc?.stats?.reputation || 0);
            await updateDoc(prevUserRef, { "stats.reputation": Math.max(0, prevReputation - 15) });
          }
        }

        await updateDoc(ansRef, { accepted: true });
        // Award points to the answer author
        const userRef = await getUserDocRefByUid(current.author.uid);
        if (userRef) {
          // fetch to get current reputation
          const uSnap = await getDocs(query(collection(db, "users"), where("uid", "==", current.author.uid)));
          const uData = uSnap.docs[0]?.data() as any;
          const curRep = Number(uData?.stats?.reputation || 0);
          await updateDoc(userRef, { "stats.reputation": curRep + 15 });
        }
        // Optionally write acceptedAnswerId on question for quick lookup
        try { await updateDoc(qRef, { acceptedAnswerId: answerId }); } catch {}
      }

      // Update local state, sorting accepted to top
      setAnswers(prev => {
        const next = prev.map(a => a.id === answerId ? { ...a, accepted: !alreadyAccepted } : (prevAccepted && a.id === prevAccepted.id ? { ...a, accepted: false } : a));
        return next.sort((a, b) => (Number(!!b.accepted) - Number(!!a.accepted)) || ((b.upvotes || 0) - (a.upvotes || 0)));
      });
    } catch (e) {
      console.error("Failed to toggle accept:", e);
    }
  }

  async function getQuestionAuthorMatchByUsername() {
    // Fallback: compare current user's username to question author's username
    if (!currentUser || !qAuthorUsername) return false;
    const snap = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
    const data = snap.docs[0]?.data() as any;
    return data?.username && data.username === qAuthorUsername;
  }

  async function upvoteAnswer(answerId: string) {
    try {
      const answerRef = doc(db, "questions", questionId, "answers", answerId);
      await updateDoc(answerRef, {
        upvotes: increment(1),
      });

      setAnswers((prev) =>
        prev.map((ans) =>
          ans.id === answerId
            ? { ...ans, upvotes: (ans.upvotes || 0) + 1 }
            : ans
        )
      );
    } catch (err) {
      console.error("Failed to upvote:", err);
    }
  }

  if (loading)
    return <p className="text-muted-foreground">Loading answers...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Answers</h2>

      {answers.length > 0 ? (
        <ul className="space-y-4">
          {answers.map((ans) => (
            <li
              key={ans.id}
              className="p-4 border rounded bg-muted/30 shadow-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={ans.author.avatarUrl} />
                  <AvatarFallback>
                    {ans.author.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Link href={`/user/${ans.author.username}`} className="font-medium hover:underline flex items-center gap-1">
                  {ans.author.username}
                  {/** Verified tick if author is verified */}
                  {(ans as any).author?.verified && <VerifiedTick size={14} />}
                </Link>
                {ans.accepted && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs">
                    ✓ Accepted
                  </span>
                )}
                {/* Accept button for question owner */}
                {currentUser && qAuthorUid === currentUser.uid && (
                  <Button size="sm" variant={ans.accepted ? "secondary" : "outline"} className="ml-auto" onClick={() => toggleAccept(ans.id)}>
                    {ans.accepted ? "Unaccept" : "Accept"}
                  </Button>
                )}
              </div>

              <p className="mb-3 text-gray-900"><MentionText text={ans.text} /></p>

              {/* ✅ Upvote Debug Button */}
              <div className="flex items-center gap-2 text-sm bg-yellow-100 border border-yellow-400 p-2 rounded">
                <span className="text-xs text-gray-600">⬆️ Upvote button:</span>
                <button
                  onClick={() => upvoteAnswer(ans.id)}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  ⬆️ {ans.upvotes ?? 0}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          No answers yet. Be the first to reply!
        </p>
      )}

      {currentUser ? (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-2">Your Answer</h3>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your answer..."
          />
          <Button onClick={submitAnswer} className="mt-2">
            Submit Answer
          </Button>
        </div>
      ) : (
        <div className="border-t pt-6">
          <p className="text-sm text-muted-foreground">Please sign in to post an answer.</p>
          <Link className="inline-block mt-2" href="/auth/sign-in"><Button>Sign in</Button></Link>
        </div>
      )}
    </div>
  );
}
