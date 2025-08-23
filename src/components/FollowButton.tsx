"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { awardFollowerBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";

export default function FollowButton({ authorId }: { authorId: string }) {
  const [user] = useAuthState(auth);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!user || !authorId) return;

      const currentUserRef = doc(db, "users", user.uid);
      const currentUserSnap = await getDoc(currentUserRef);
      const data = currentUserSnap.data();

      setIsFollowing(data?.following?.includes(authorId));
      setLoading(false);
    };

    checkFollowing();
  }, [user, authorId]);

  const toggleFollow = async () => {
    if (!user || user.uid === authorId) return;

    const userRef = doc(db, "users", user.uid);
    const authorRef = doc(db, "users", authorId);

    // Always fetch latest arrays after update
    if (isFollowing) {
      await updateDoc(userRef, {
        following: arrayRemove(authorId),
      });
      await updateDoc(authorRef, {
        followers: arrayRemove(user.uid),
      });
      // Fetch updated arrays
      const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);
      const userData = userSnap.data();
      const authorData = authorSnap.data();
      await updateDoc(userRef, {
        "stats.following": Array.isArray(userData?.following) ? userData.following.length : 0,
      });
      await updateDoc(authorRef, {
        "stats.followers": Array.isArray(authorData?.followers) ? authorData.followers.length : 0,
      });
      try {
        await recomputeVerificationFromSnapshot(authorRef);
      } catch {}
    } else {
      await updateDoc(userRef, {
        following: arrayUnion(authorId),
      });
      await updateDoc(authorRef, {
        followers: arrayUnion(user.uid),
      });
      // Fetch updated arrays
      const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);
      const userData = userSnap.data();
      const authorData = authorSnap.data();
      await updateDoc(userRef, {
        "stats.following": Array.isArray(userData?.following) ? userData.following.length : 0,
      });
      await updateDoc(authorRef, {
        "stats.followers": Array.isArray(authorData?.followers) ? authorData.followers.length : 0,
      });
      // Award follower milestones badges
      try {
        await awardFollowerBadges({ userRef: authorRef, currentBadges: authorData?.badges || [], nextFollowerCount: Array.isArray(authorData?.followers) ? authorData.followers.length : 0 });
        await recomputeVerificationFromSnapshot(authorRef);
      } catch (e) {
        console.warn("follower badge update failed", e);
      }
    }

    setIsFollowing(!isFollowing);
  };

  if (!user || user.uid === authorId) return null;

  return (
    <Button onClick={toggleFollow} disabled={loading}>
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}
