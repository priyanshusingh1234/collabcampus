"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notifyMentions } from "@/lib/notifications";
import { awardCommentBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { Textarea } from "@/components/ui/textarea";
import { MentionText } from "@/components/ui/MentionText";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: any;
  author: {
    uid: string;
    username: string;
    avatarUrl: string;
  };
}

interface CommentNodeProps {
  comment: Comment;
  depth?: number;
  onReply: (parentId: string, content: string) => void;
  replyMap: Record<string, string>;
  showReplyInput: Record<string, boolean>;
  setReplyMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setShowReplyInput: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  comments: Comment[];
}

const CommentNode = memo(({
  comment,
  depth = 0,
  onReply,
  replyMap,
  showReplyInput,
  setReplyMap,
  setShowReplyInput,
  comments
}: CommentNodeProps) => {
  const children = useMemo(() => 
    comments.filter((c) => c.parentId === comment.id), 
    [comments, comment.id]
  );
  const isNested = depth > 0;

  const handleReplyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyMap((prev) => ({
      ...prev,
      [comment.id]: e.target.value,
    }));
  }, [comment.id, setReplyMap]);

  const toggleReplyInput = useCallback(() => {
    setShowReplyInput((prev) => ({
      ...prev,
      [comment.id]: !prev[comment.id],
    }));
  }, [comment.id, setShowReplyInput]);

  const closeReplyInput = useCallback(() => {
    setShowReplyInput((prev) => ({ ...prev, [comment.id]: false }));
  }, [comment.id, setShowReplyInput]);

  return (
    <div className={`${isNested ? 'ml-8 mt-4' : 'mt-6'} relative`}>
      {/* Vertical line for nested comments */}
      {isNested && (
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
      )}
      
      <div className="flex items-start gap-3">
        <Avatar className={`${isNested ? 'w-6 h-6 mt-1' : 'w-8 h-8'}`}>
          <AvatarImage src={comment.author.avatarUrl} />
          <AvatarFallback>
            {comment.author.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/user/${comment.author.username}`} className="text-sm font-medium hover:underline inline-flex items-center gap-1">
              {comment.author.username}
              {(comment as any).author?.verified && <VerifiedTick size={14} />}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {comment.createdAt?.toDate().toLocaleDateString()}
            </span>
          </div>
          
          <p className="text-sm mt-1"><MentionText text={comment.content} /></p>
          
          <button
            onClick={toggleReplyInput}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-1"
          >
            Reply
          </button>
          
          {showReplyInput[comment.id] && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyMap[comment.id] || ''}
                onChange={handleReplyChange}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={closeReplyInput}
                >
                  Cancel
                </Button>
                {/* If not logged in, clicking prompts sign in */}
                <AuthAwareReplyButton
                  canSubmit={!!replyMap[comment.id]?.trim()}
                  onSubmit={() => onReply(comment.id, replyMap[comment.id] || '')}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Render nested replies */}
      {children.length > 0 && (
        <div className="space-y-4">
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              depth={depth + 1}
              onReply={onReply}
              replyMap={replyMap}
              showReplyInput={showReplyInput}
              setReplyMap={setReplyMap}
              setShowReplyInput={setShowReplyInput}
              comments={comments}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CommentNode.displayName = 'CommentNode';

function AuthAwareReplyButton({ canSubmit, onSubmit }: { canSubmit: boolean; onSubmit: () => void }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <Link href="/auth/sign-in">
        <Button size="sm" disabled={!canSubmit}>Sign in to reply</Button>
      </Link>
    );
  }
  return (
    <Button size="sm" onClick={onSubmit} disabled={!canSubmit}>Reply</Button>
  );
}

export default function CommentSection({ postId, slug }: { postId: string; slug?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({});

  // 🔁 Load Firestore user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.uid) {
        const q = query(collection(db, "users"), where("uid", "==", user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setCurrentUser(snapshot.docs[0].data());
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // 🔁 Load comments
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments(list);
    });

    return () => unsubscribe();
  }, [postId]);

  // 📝 Submit reply handler
  const handleReply = useCallback(async (parentId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    if (currentUser?.blocked) {
      toast({
        variant: "destructive",
        title: "Account blocked",
        description: "You cannot reply at this time.",
      });
      return;
    }

    await addDoc(collection(db, "comments"), {
      postId,
      parentId,
      content: content.trim(),
      createdAt: serverTimestamp(),
      author: {
        uid: user?.uid,
        username: currentUser.username,
  avatarUrl: currentUser.avatarUrl || "",
  verified: !!currentUser.verified,
      },
    });

    // Increment comments stat and award badges
    try {
      const userRef = doc(db, "users", user?.uid as string);
      const snap = await getDoc(userRef);
      const data = snap.data() as any;
      const nextComments = (data?.stats?.comments || 0) + 1;
      await updateDoc(userRef, { "stats.comments": nextComments });
  await awardCommentBadges({ userRef, currentBadges: data?.badges || [], nextCommentCount: nextComments });
  await recomputeVerificationFromSnapshot(userRef);
    } catch (e) {
      console.warn("comment stat/badge update failed", e);
    }

    // Notify mentions in reply
    await notifyMentions({
      from: { uid: user?.uid as string, username: currentUser.username, avatarUrl: currentUser.avatarUrl || undefined },
      text: content,
      title: `New reply on a post you follow` ,
      url: slug ? `/blog/${slug}` : `/blog/${postId}`,
    });

    setReplyMap((prev) => ({ ...prev, [parentId]: "" }));
    setShowReplyInput((prev) => ({ ...prev, [parentId]: false }));
  }, [currentUser, postId, user?.uid]);

  // 📝 Submit main comment
  const handlePostComment = useCallback(async () => {
    if (!currentUser || !newComment.trim()) return;
    if (currentUser?.blocked) {
      toast({
        variant: "destructive",
        title: "Account blocked",
        description: "You cannot comment at this time.",
      });
      return;
    }

    await addDoc(collection(db, "comments"), {
      postId,
      content: newComment.trim(),
      createdAt: serverTimestamp(),
      author: {
        uid: user?.uid,
        username: currentUser.username,
  avatarUrl: currentUser.avatarUrl || "",
  verified: !!currentUser.verified,
      },
    });

    // Increment comments stat and award badges
    try {
      const userRef = doc(db, "users", user?.uid as string);
      const snap = await getDoc(userRef);
      const data = snap.data() as any;
      const nextComments = (data?.stats?.comments || 0) + 1;
      await updateDoc(userRef, { "stats.comments": nextComments });
  await awardCommentBadges({ userRef, currentBadges: data?.badges || [], nextCommentCount: nextComments });
  await recomputeVerificationFromSnapshot(userRef);
    } catch (e) {
      console.warn("comment stat/badge update failed", e);
    }

    setNewComment("");

    // Notify mentions in top-level comment
    await notifyMentions({
      from: { uid: user?.uid as string, username: currentUser.username, avatarUrl: currentUser.avatarUrl || undefined },
      text: newComment,
      title: `New comment on a post you follow`,
      url: slug ? `/blog/${slug}` : `/blog/${postId}`,
    });
  }, [currentUser, newComment, postId, slug, user?.uid]);

  const handleNewCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
  }, []);

  const topLevelComments = useMemo(() => 
    comments.filter((comment) => !comment.parentId), 
    [comments]
  );

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-6">Responses ({comments.length})</h3>

      {user ? (
        <div className="flex gap-3 mb-8">
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser?.avatarUrl} />
            <AvatarFallback>
              {currentUser?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="What are your thoughts?"
              value={newComment}
              onChange={handleNewCommentChange}
              className="min-h-[100px]"
            />
            <div className="flex justify-end">
              <AuthAwarePostButton canSubmit={!!newComment.trim()} onSubmit={handlePostComment} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-md border p-4 bg-muted/30 text-sm">
          Please <Link href="/auth/sign-in" className="underline">sign in</Link> to comment.
        </div>
      )}

      <div className="space-y-6">
        {topLevelComments.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            onReply={handleReply}
            replyMap={replyMap}
            showReplyInput={showReplyInput}
            setReplyMap={setReplyMap}
            setShowReplyInput={setShowReplyInput}
            comments={comments}
          />
        ))}
          
        {comments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No responses yet. Be the first to respond.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthAwarePostButton({ canSubmit, onSubmit }: { canSubmit: boolean; onSubmit: () => void }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <Link href="/auth/sign-in">
        <Button className="px-4" disabled={!canSubmit}>Sign in to comment</Button>
      </Link>
    );
  }
  return (
    <Button className="px-4" onClick={onSubmit} disabled={!canSubmit}>Respond</Button>
  );
}