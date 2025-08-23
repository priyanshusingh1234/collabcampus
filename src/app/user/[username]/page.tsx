'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  orderBy,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"; // Your Radix-based Dialog
import Link from "next/link";
import { awardFollowerBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { UserBadges } from "@/components/ui/UserBadges";
import ChatDialog from "@/components/chat/ChatDialog";
import { isBlocked as checkBlocked, toggleBlock } from "@/lib/blocks";
import { toast } from "sonner";
import { getConversationId } from "@/lib/chat";
import { subscribePresence, type PresenceDoc } from "@/lib/presence";
import { isPremium } from "@/lib/premium";

export default function PublicUserProfile() {
  const { username } = useParams();
  const [currentUser] = useAuthState(auth);

  const [userData, setUserData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileDocId, setProfileDocId] = useState<string | null>(null);
  const [currProfile, setCurrProfile] = useState<any | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [blockState, setBlockState] = useState<{ byMe: boolean; byOther: boolean }>({ byMe: false, byOther: false });
  const [blockBusy, setBlockBusy] = useState(false);
  const [otherPresence, setOtherPresence] = useState<PresenceDoc | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Follower/following username arrays
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);

  // Detailed user info for modals
  const [followersData, setFollowersData] = useState<any[]>([]);
  const [followingData, setFollowingData] = useState<any[]>([]);

  // Dialog open state
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [rank, setRank] = useState<number | null>(null);

  const db = getFirestore(auth.app);

  useEffect(() => {
    async function fetchProfile() {
  if (!username) return;
      setLoading(true);

      try {
        // Fetch user doc by username
  if (!username) return;
  const userQuery = query(collection(db, "users"), where("username", "==", String(username)));
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
          setUserData(null);
          setPosts([]);
          setFollowers([]);
          setFollowing([]);
          setLoading(false);
          return;
        }

        const userDoc = userSnap.docs[0];
        const profile = userDoc.data();
        setUserData(profile);
        setProfileDocId(userDoc.id);
        setFollowers(profile.followers ?? []);
        setFollowing(profile.following ?? []);

        // Compute leaderboard rank: count users with strictly higher reputation
        try {
          const stats = (profile as any)?.stats || {};
          const myRep = typeof stats.reputation === 'number' ? stats.reputation : (typeof stats.points === 'number' ? stats.points : 0);
          // Query users with rep > myRep; fall back to points when reputation missing
          // Note: Firestore can filter on one field per inequality. We choose reputation primarily.
          let higherCount = 0;
          if (typeof stats.reputation === 'number') {
            const qHigher = query(collection(db, "users"), where("stats.reputation", ">", stats.reputation));
            const agg = await getCountFromServer(qHigher);
            higherCount = agg.data().count || 0;
          } else if (typeof stats.points === 'number') {
            const qHigher = query(collection(db, "users"), where("stats.points", ">", stats.points));
            const agg = await getCountFromServer(qHigher);
            higherCount = agg.data().count || 0;
          }
          setRank(higherCount + 1);
        } catch (e) {
          // ignore ranking failure silently
          setRank(null);
        }

        // Fetch user's posts
        const postsQuery = query(collection(db, "posts"), where("username", "==", username));
        const postsSnap = await getDocs(postsQuery);
        const postsList = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPosts(postsList);

        // Check if current user follows profile user
        if (currentUser) {
          const currUserQuery = query(collection(db, "users"), where("uid", "==", currentUser.uid));
          const currUserSnap = await getDocs(currUserQuery);
          if (!currUserSnap.empty) {
            const currUserInfo = currUserSnap.docs[0].data();
            setCurrProfile({ id: currUserSnap.docs[0].id, ...currUserInfo });
            setIsFollowing(currUserInfo.following?.includes(profile.username));
            // Load block state (both directions)
            try {
              const [byMe, byOther] = await Promise.all([
                checkBlocked(currentUser.uid, profile.uid),
                checkBlocked(profile.uid, currentUser.uid),
              ]);
              setBlockState({ byMe, byOther });
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [username, currentUser, db]);

  // Presence and unread subscription
  useEffect(() => {
    if (!currentUser || !userData) return;
    const convId = getConversationId(currentUser.uid, userData.uid);
    // presence
    const unsubPresence = subscribePresence(userData.uid, (p) => setOtherPresence(p));
    // unread: count messages from other not seen by me
    const msgsRef = collection(db, "conversations", convId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), limit(500));
    const unsubMsgs = onSnapshot(q, async (snap) => {
      const convRef = doc(db, "conversations", convId);
      const convSnap = await getDoc(convRef);
      const lastReadAt = (convSnap.data() as any)?.lastReadAt?.[currentUser.uid];
      const lastReadMillis = lastReadAt?.toMillis ? lastReadAt.toMillis() : 0;
      let count = 0;
      snap.forEach((d) => {
        const m = d.data() as any;
        if (m.senderId === userData.uid && m.createdAt?.toMillis && m.createdAt.toMillis() > lastReadMillis) count++;
      });
      setUnreadCount(count);
    });
    return () => {
      unsubPresence && unsubPresence();
      unsubMsgs && unsubMsgs();
    };
  }, [db, currentUser, userData]);

  // Fetch user data for followers/following lists when modals open
  useEffect(() => {
    async function fetchUsers(usernames: string[], setUserData: React.Dispatch<React.SetStateAction<any[]>>) {
      if (usernames.length === 0) {
        setUserData([]);
        return;
      }
      try {
        const chunkSize = 10; // Firestore limit for 'in' queries
        let fullResults: any[] = [];

        for (let i = 0; i < usernames.length; i += chunkSize) {
          const chunk = usernames.slice(i, i + chunkSize);
          const usersQuery = query(collection(db, "users"), where("username", "in", chunk));
          const snap = await getDocs(usersQuery);
          fullResults = fullResults.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setUserData(fullResults);
      } catch (err) {
        console.error("Error fetching user details:", err);
        setUserData([]);
      }
    }

    if (followersOpen) fetchUsers(followers, setFollowersData);
    if (followingOpen) fetchUsers(following, setFollowingData);
  }, [followersOpen, followingOpen, followers, following, db]);

  async function toggleFollow() {
    if (!currentUser || !userData || !profileDocId) return;
    try {
  const followerLabel = currentUser.displayName ?? currentUser.email ?? currentUser.uid;
      const currUserQuery = query(collection(db, "users"), where("uid", "==", currentUser.uid));
      const currUserSnap = await getDocs(currUserQuery);
      if (currUserSnap.empty) return;

      const currUserDoc = currUserSnap.docs[0];
      const currUserRef = doc(db, "users", currUserDoc.id);
      const profileUserRef = doc(db, "users", profileDocId);

      if (isFollowing) {
        // Unfollow
        await updateDoc(currUserRef, {
          following: arrayRemove(userData.username),
        });
        await updateDoc(profileUserRef, {
          followers: arrayRemove(followerLabel),
        });
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f !== followerLabel));

        // Sync numeric stats to match arrays
        const [freshCurrSnap, freshProfileSnap] = await Promise.all([getDoc(currUserRef), getDoc(profileUserRef)]);
        const freshCurr = freshCurrSnap.data();
        const freshProfile = freshProfileSnap.data();
        await Promise.all([
          updateDoc(currUserRef, {
            "stats.following": Array.isArray(freshCurr?.following) ? freshCurr.following.length : 0,
          }),
          updateDoc(profileUserRef, {
            "stats.followers": Array.isArray(freshProfile?.followers) ? freshProfile.followers.length : 0,
          }),
        ]);
        try {
          await recomputeVerificationFromSnapshot(profileUserRef);
        } catch {}
      } else {
        // Follow
        await updateDoc(currUserRef, {
          following: arrayUnion(userData.username),
        });
        await updateDoc(profileUserRef, {
          followers: arrayUnion(followerLabel),
        });
        setIsFollowing(true);
        setFollowers(prev => [...prev, followerLabel]);

        // Sync numeric stats to match arrays and award badges
        const [freshCurrSnap, freshProfileSnap] = await Promise.all([getDoc(currUserRef), getDoc(profileUserRef)]);
        const freshCurr = freshCurrSnap.data();
        const freshProfile = freshProfileSnap.data();
        const nextFollowerCount = Array.isArray(freshProfile?.followers) ? freshProfile.followers.length : 0;
        await Promise.all([
          updateDoc(currUserRef, {
            "stats.following": Array.isArray(freshCurr?.following) ? freshCurr.following.length : 0,
          }),
          updateDoc(profileUserRef, {
            "stats.followers": nextFollowerCount,
          }),
        ]);
        try {
          await awardFollowerBadges({ userRef: profileUserRef, currentBadges: freshProfile?.badges || [], nextFollowerCount });
          await recomputeVerificationFromSnapshot(profileUserRef);
        } catch (e) {
          console.warn("follower badge/verify update failed", e);
        }
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    }
  }

  const isOwnProfile = Boolean(currentUser?.uid && userData?.uid && currentUser.uid === userData.uid);
  const meBasic = useMemo(() => {
    if (!currentUser) return null;
    const username = currProfile?.username as string | undefined;
    return {
      uid: currentUser.uid,
      username,
      displayName: currentUser.displayName || username,
      avatarUrl: currProfile?.avatarUrl || (currentUser as any).photoURL || undefined,
    };
  }, [currentUser, currProfile]);

  async function onToggleBlock() {
    if (!currentUser || !userData) return;
    try {
      setBlockBusy(true);
      const next = !blockState.byMe;
      await toggleBlock(currentUser.uid, userData.uid, next);
      setBlockState((prev) => ({ ...prev, byMe: next }));
      toast.success(next ? "User blocked" : "User unblocked");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update block state");
    } finally {
      setBlockBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {loading ? (
        <div className="p-10 text-center text-lg">Loading...</div>
      ) : !userData ? (
        <div className="p-10 text-center text-lg">User not found.</div>
      ) : (
        <>
      {/* Profile Header with optional banner (premium only) */}
      <div className="flex flex-col items-center mb-8 w-full">
        {/* Banner with overlapping avatar */}
        <div className="relative w-full mb-16">
          {(() => {
            const key = (userData as any)?.bannerKey as string | undefined;
            const url = (userData as any)?.bannerImageUrl as string | undefined;
            if (!key) return <div className="w-full h-28 sm:h-36 md:h-40 rounded-xl bg-muted" aria-hidden="true" />;
            if (key === 'custom' && url) {
              return (
                <div className="w-full h-28 sm:h-36 md:h-40 rounded-xl overflow-hidden bg-muted" aria-hidden="true">
                  <img src={url} alt="Profile banner" className="w-full h-full object-cover" />
                </div>
              );
            }
            const cls = key === 'gradients' ? 'banner-gradients'
              : key === 'stripes' ? 'banner-stripes'
              : key === 'blobs' ? 'banner-blobs'
              : key === 'shine' ? 'banner-shine'
              : key === 'popdots' ? 'banner-popdots'
              : key === 'waves' ? 'banner-waves'
              : key === 'sparkles' ? 'banner-sparkles'
              : key === 'clouds' ? 'banner-clouds'
              : 'bg-muted';
            return <div className={`w-full h-28 sm:h-36 md:h-40 rounded-xl ${cls}`} aria-hidden="true" />;
          })()}

          {/* Centered avatar overlapping the banner */}
          <div className="absolute left-1/2 -bottom-14 -translate-x-1/2">
            <Avatar className="w-28 h-28 shadow-xl ring-2 ring-indigo-200/60 border-4 border-white dark:border-gray-900">
              <AvatarImage src={userData.avatarUrl} alt={userData.username} />
              <AvatarFallback className="text-3xl font-extrabold">
                {userData.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {userData.displayName || userData.username}
            {userData.verified && <VerifiedTick size={16} />}
          </h1>
          <span className="text-base text-gray-500 dark:text-gray-400">@{userData.username}</span>
          {typeof rank === 'number' && rank > 0 && (
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-gray-800/60">
              Rank #{rank}
            </span>
          )}
          {!isOwnProfile && currentUser && (
            <div className="flex items-center gap-2 ml-2">
              <Button
                onClick={toggleFollow}
                variant={isFollowing ? "outline" : "default"}
                className="px-6 py-2 text-base font-medium rounded-full"
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                onClick={() => {
                  if (userData?.uid) {
                    window.location.href = `/messages?with=${encodeURIComponent(userData.uid)}`;
                  }
                }}
                variant="secondary"
                className="px-6 py-2 text-base font-medium rounded-full"
                disabled={blockState.byMe || blockState.byOther}
                title={blockState.byOther ? "You can't message this user" : blockState.byMe ? "You've blocked this user" : "Message"}
              >
                <span className="relative inline-flex items-center">
                  Message
                  {unreadCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </Button>
              <Button
                onClick={onToggleBlock}
                variant={blockState.byMe ? "destructive" : "outline"}
                className="px-4 py-2 text-base font-medium rounded-full"
                disabled={blockBusy}
              >
                {blockState.byMe ? "Unblock" : "Block"}
              </Button>
            </div>
          )}
        </div>
        {userData.bio && (
          <p className="mt-2 text-gray-700 dark:text-gray-300 max-w-2xl text-center">{userData.bio}</p>
        )}

        {userData.blocked && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 max-w-xl text-center">
            <p className="font-semibold">This account is currently blocked</p>
            <p className="mt-1">
              Reason: <span className="font-medium">{userData.blockedReason || 'Violation of community guidelines'}</span>
            </p>
            {userData.blockedBy && (
              <p className="text-xs text-red-800 mt-1">
                Blocked by {userData.blockedBy.username || userData.blockedBy.email || 'an admin'}
              </p>
            )}
          </div>
        )}

        {Array.isArray((userData as any).links) && (userData as any).links.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {(userData as any).links.map((l: any, i: number) => (
              <a
                key={i}
                href={l?.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm hover:bg-accent"
                title={l?.url}
              >
                🔗 {l?.label || l?.url}
              </a>
            ))}
          </div>
        )}

        {/* Badges */}
        {Array.isArray(userData.badges) && userData.badges.length > 0 && (
          <UserBadges badges={userData.badges.map((b: any) => (typeof b === 'string' ? b : b?.name)).filter(Boolean)} />
        )}

        {/* Stats with clickable followers/following */}
        <div className="flex justify-center gap-12 mt-6 text-center">
          <div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">{posts.length}</span>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 uppercase tracking-wide">
              Posts
            </div>
          </div>

          <div
            tabIndex={0}
            role="button"
            className="cursor-pointer select-none"
            onClick={() => setFollowersOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setFollowersOpen(true)}
            aria-label="Show followers list"
          >
            <span className="font-bold text-lg text-gray-900 dark:text-white">{followers.length}</span>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 uppercase tracking-wide">
              Followers
            </div>
          </div>

          <div
            tabIndex={0}
            role="button"
            className="cursor-pointer select-none"
            onClick={() => setFollowingOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setFollowingOpen(true)}
            aria-label="Show following list"
          >
            <span className="font-bold text-lg text-gray-900 dark:text-white">{following.length}</span>
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 uppercase tracking-wide">
              Following
            </div>
          </div>
        </div>
      </div>

      {meBasic && userData && (
        <ChatDialog
          me={meBasic}
          other={{ uid: userData.uid, username: userData.username, displayName: userData.displayName, avatarUrl: userData.avatarUrl }}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}

      {/* Posts grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-center text-gray-500">No posts yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug || post.id}`}
                className="relative group rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow hover:shadow-lg transition duration-200"
                title={post.title}
                passHref
              >
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title || "Post"}
                    className="object-cover w-full h-48 sm:h-44 md:h-44 group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col w-full h-48 items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-900 text-6xl select-none">
                    📝
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                  <h3 className="text-white text-base font-semibold truncate">
                    {post.title || "[Untitled Post]"}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Followers Dialog */}
      <Dialog open={followersOpen} onOpenChange={setFollowersOpen} aria-label="Followers list">
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed top-[15%] left-1/2 max-w-md w-full -translate-x-1/2 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 max-h-[70vh] overflow-auto">
            <DialogTitle className="text-lg font-bold mb-4">Followers</DialogTitle>
            {followersData.length === 0 ? (
              <p>No followers yet.</p>
            ) : (
              <ul>
                {followersData.map((user) => (
                  <li
                    key={user.id}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-none"
                  >
                    <Link
                      href={`/user/${user.username}`}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Avatar className="w-10 h-10">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.username} />
                        ) : (
                          <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-semibold inline-flex items-center gap-1">{user.displayName || user.username}{user?.verified && <VerifiedTick size={14} />}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <DialogClose asChild>
              <Button className="mt-4 w-full">Close</Button>
            </DialogClose>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Following Dialog */}
      <Dialog open={followingOpen} onOpenChange={setFollowingOpen} aria-label="Following list">
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed top-[15%] left-1/2 max-w-md w-full -translate-x-1/2 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900 max-h-[70vh] overflow-auto">
            <DialogTitle className="text-lg font-bold mb-4">Following</DialogTitle>
            {followingData.length === 0 ? (
              <p>Not following anyone.</p>
            ) : (
              <ul>
                {followingData.map((user) => (
                  <li
                    key={user.id}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-none"
                  >
                    <Link
                      href={`/user/${user.username}`}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Avatar className="w-10 h-10">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.username} />
                        ) : (
                          <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-semibold inline-flex items-center gap-1">{user.displayName || user.username}{user?.verified && <VerifiedTick size={14} />}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <DialogClose asChild>
              <Button className="mt-4 w-full">Close</Button>
            </DialogClose>
          </DialogContent>
        </DialogPortal>
      </Dialog>
        </>
      )}
    </div>
  );
}
