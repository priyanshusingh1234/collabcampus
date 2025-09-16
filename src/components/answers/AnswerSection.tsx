"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify"; // For sanitizing legacy rich HTML answers
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
  setDoc,
  deleteDoc,
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
// Removed tag suggestions for answers
import { MentionText } from "@/components/ui/MentionText";
import { ArrowUpIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
// Removed rich text editor; answers will use a plain textarea

interface Answer {
  id: string;
  text: string;
  createdAt?: any;
  upvotes?: number;
  accepted?: boolean;
  hasUpvoted?: boolean;
  author: {
    uid: string;
    username: string;
    avatarUrl?: string;
    verified?: boolean;
  };
}

export default function AnswerSection({ questionId, questionTitle }: { questionId: string; questionTitle?: string }) {
  const auth = getAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [qAuthorUid, setQAuthorUid] = useState<string | null>(null);
  const [qAuthorUsername, setQAuthorUsername] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

            let hasUpvoted = false;
            if (currentUser) {
              const voteRef = doc(
                db,
                "questions",
                questionId,
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
              text: answerData.text,
              upvotes: answerData.upvotes || 0,
              createdAt: answerData.createdAt,
              accepted: !!answerData.accepted,
              hasUpvoted,
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
  }, [questionId, currentUser]);

  async function submitAnswer() {
    if (!replyText.trim() || !currentUser || isSubmitting) return;
    
    setIsSubmitting(true);

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
        setIsSubmitting(false);
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
        text: replyText.trim(),
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
        { ...newAnswer, id: docRef.id, hasUpvoted: false } as Answer,
      ]);
      setReplyText("");

      // Removed: Tag suggestions for answers

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
          text: replyText,
          title: `New answer on: ${qData?.title || "your question"}`,
          url: slug ? `/questions/${slug}` : `/questions/${questionId}`,
        });
      } catch (e) {
        // non-fatal
        console.warn("notifyMentions(answer) failed", e);
      }

      toast({
        title: "Answer posted",
        description: "Your answer has been successfully posted.",
      });
    } catch (err) {
      console.error("Error posting answer:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to post your answer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
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
        if (userRef) {
          const uSnap = await getDocs(query(collection(db, "users"), where("uid", "==", current.author.uid)));
          const uData = uSnap.docs[0]?.data() as any;
          const curRep = Number(uData?.stats?.reputation || 0);
          await updateDoc(userRef, { "stats.reputation": Math.max(0, curRep - 15) });
        }
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

      toast({
        title: alreadyAccepted ? "Answer unaccepted" : "Answer accepted",
        description: alreadyAccepted 
          ? "This answer is no longer marked as accepted." 
          : "This answer is now marked as the solution.",
      });
    } catch (e) {
      console.error("Failed to toggle accept:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update answer status. Please try again.",
      });
    }
  }

  async function upvoteAnswer(answerId: string) {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to upvote answers.",
      });
      return;
    }

    try {
      const answerRef = doc(db, "questions", questionId, "answers", answerId);
      const voteRef = doc(answerRef, "votes", currentUser.uid);

      const voteSnap = await getDoc(voteRef);
      const isUpvoted = voteSnap.exists();

      if (isUpvoted) {
        await deleteDoc(voteRef);
        await updateDoc(answerRef, { upvotes: increment(-1) });
        
        setAnswers((prev) =>
          prev.map((ans) =>
            ans.id === answerId
              ? { 
                  ...ans, 
                  upvotes: (ans.upvotes || 0) - 1,
                  hasUpvoted: false
                }
              : ans
          )
        );
      } else {
        await setDoc(voteRef, { uid: currentUser.uid });
        await updateDoc(answerRef, { upvotes: increment(1) });
        
        setAnswers((prev) =>
          prev.map((ans) =>
            ans.id === answerId
              ? { 
                  ...ans, 
                  upvotes: (ans.upvotes || 0) + 1,
                  hasUpvoted: true
                }
              : ans
          )
        );
      }
    } catch (err) {
      console.error("Failed to upvote:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to register your vote. Please try again.",
      });
    }
  }

  // Safe date formatter to avoid 'Invalid Date'
  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Unknown date';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString();
    } catch {
      return 'Unknown date';
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Answers</h2>
        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
      </div>
      
      {[1, 2].map(i => (
        <div key={i} className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded ml-auto"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Answers</h2>
        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium px-3 py-1 rounded-full">
          {answers.length}
        </span>
      </div>

      {answers.length > 0 ? (
        <div className="space-y-6">
          {answers.map((ans) => (
            <div key={ans.id} className={`p-6 rounded-xl shadow-sm border bg-white dark:bg-gray-900 dark:border-gray-700 ${ans.accepted ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/20' : 'border-gray-200'}`}>
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={ans.author.avatarUrl} alt={ans.author.username} />
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {ans.author.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/user/${ans.author.username}`} className="font-medium hover:underline inline-flex items-center gap-1 text-gray-900 dark:text-white">
                      {ans.author.username}
                      {ans.author?.verified && <VerifiedTick size={14} />}
                    </Link>
                    
                    {ans.accepted && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        <CheckBadgeIcon className="h-3.5 w-3.5" /> Accepted
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    {ans.createdAt ? formatDate(ans.createdAt.toDate ? ans.createdAt.toDate().toISOString() : ans.createdAt) : 'Unknown date'}
                  </p>
                </div>
                
                {currentUser && qAuthorUid === currentUser.uid && (
                  <Button 
                    size="sm" 
                    variant={ans.accepted ? "secondary" : "outline"} 
                    className="ml-auto"
                    onClick={() => toggleAccept(ans.id)}
                  >
                    {ans.accepted ? "Unaccept" : "Accept Answer"}
                  </Button>
                )}
              </div>
              
              <div className="prose prose-gray dark:prose-invert max-w-none mb-4">
                {(() => {
                  const raw = ans.text || "";
                  const looksLikeHtml = /<[^>]+>/.test(raw);
                  if (!looksLikeHtml) return <MentionText text={raw} />;
                  let clean = "";
                  try {
                    clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
                  } catch {
                    return <MentionText text={raw} />;
                  }
                  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
                })()}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => upvoteAnswer(ans.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    ans.hasUpvoted 
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  } transition-colors`}
                >
                  <ArrowUpIcon className="h-5 w-5" />
                  <span className="font-medium">{ans.upvotes || 0}</span>
                  <span className="sr-only">Upvotes</span>
                </button>
                
                {ans.accepted && (
                  <div className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1">
                    <CheckBadgeIcon className="h-4 w-4" /> This answer solved the problem
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No answers yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">Be the first to share your knowledge and help solve this problem!</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Answer</h3>
        
        {currentUser ? (
          <div className="space-y-4">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your answer here..."
              className="min-h-[160px]"
            />
            
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Make sure your answer is clear, detailed, and helpful to others.
              </p>
              
              <Button 
                onClick={submitAnswer} 
                disabled={!replyText.trim() || isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Posting...
                  </>
                ) : "Post Answer"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Sign in to answer this question.</p>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}