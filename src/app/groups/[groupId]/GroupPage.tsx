"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  CheckCircle2, Link as LinkIcon, Pencil, Shield,
  Users, MessageSquare, Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { approveRequest, toggleAdmin, addAnnouncement } from "@/lib/groups";

export default function GroupPage({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Invite URL for sharing/copy (client-side only)
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/groups/${groupId}` : "";

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => setUser(firebaseUser));
    return () => unsubscribe();
  }, []);

  // Fetch group and members info
  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      if (!groupId) {
        setGroup(null);
        setLoading(false);
        return;
      }
      try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (!groupDoc.exists()) {
          setGroup(null);
          setLoading(false);
          return;
        }
        const groupData = groupDoc.data();
        const memberProfiles = await Promise.all(
          (groupData.members || []).map(async (uid: string) => {
            try {
              const userDoc = await getDoc(doc(db, "users", uid));
              const userData = userDoc.exists() ? userDoc.data() : null;
              return {
                id: uid,
                name: userData?.displayName || userData?.username || "Unknown",
                avatarUrl: userData?.avatarUrl || "",
                role:
                  groupData.createdBy === uid
                    ? "owner"
                    : groupData.admins?.includes(uid)
                    ? "admin"
                    : "member",
              };
            } catch {
              return {
                id: uid,
                name: "Unknown",
                avatarUrl: "",
                role:
                  groupData.createdBy === uid
                    ? "owner"
                    : groupData.admins?.includes(uid)
                    ? "admin"
                    : "member",
              };
            }
          })
        );
  setGroup({ ...groupData, id: groupDoc.id });
        setMembers(memberProfiles);
      } catch (error) {
        console.error("Error loading group", error);
        toast({
          variant: "destructive",
          title: "Group load failed",
          description: "Failed to load group info. Try refreshing.",
        });
        setGroup(null);
      } finally {
        setLoading(false);
      }
    }
    fetchGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const you = useMemo(
    () => members.find((m) => m.id === user?.uid),
    [members, user]
  );
  const isMember = !!you;
  const isOwner = you?.role === "owner";
  const isAdminOrOwner = you?.role === "admin" || isOwner;

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!search) return members;
    return members.filter((m) =>
      m.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, members]);

  // Join group handler
  async function handleJoinGroup() {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "Please log in to join this group.",
      });
      router.push("/auth/signin");
      return;
    }
    setJoinLoading(true);
    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid),
      });

      setMembers((prev) => [
        ...prev,
        {
          id: user.uid,
          name: user.displayName || user.email || "You",
          avatarUrl: user.photoURL || "",
          role: "member",
        },
      ]);
      setGroup((prev: any) => ({
        ...prev,
        members: [...prev.members, user.uid],
      }));
      toast({
        title: "Joined group!",
        description: "You have joined this group.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not join",
        description: "Failed to join group. Try again.",
      });
      console.error("Join group error:", error);
    } finally {
      setJoinLoading(false);
    }
  }

  // Clipboard copy handler
  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      toast({ title: "Copied!", description: "Invite link copied to clipboard." });
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Copy failed" });
    }
  }

  // Leave group handler
  const handleLeaveGroup = useCallback(async () => {
    if (!user || !group || !isMember) return;
    if (isOwner) {
      toast({
        variant: "destructive",
        title: "Cannot leave",
        description:
          "You are the group owner. Transfer ownership or delete the group to leave.",
      });
      return;
    }
    setLeaveLoading(true);
    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(user.uid),
        admins: arrayRemove(user.uid),
      });
      setMembers((prev) => prev.filter((m) => m.id !== user.uid));
      setGroup((prev: any) => ({
        ...prev,
        members: prev.members.filter((id: string) => id !== user.uid),
        admins: prev.admins ? prev.admins.filter((id: string) => id !== user.uid) : [],
      }));
      toast({
        title: "Left group",
        description: "You have left this group.",
      });
      router.push("/groups");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not leave group",
        description: error?.message || "An error occurred.",
      });
      console.error("Leave group error:", error);
    } finally {
      setLeaveLoading(false);
    }
  }, [user, group, isOwner, isMember, groupId, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }
  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600">
        Group not found.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Group Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-6 sm:space-y-0 sm:space-x-8">
        <Avatar className="w-36 h-36 shadow-lg flex-shrink-0">
          {group.imageUrl ? (
            <AvatarImage src={group.imageUrl} alt={group.name} />
          ) : (
            <AvatarFallback className="text-6xl font-bold">
              {group.name[0]}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="flex-1 max-w-xl">
          <h1 className="text-4xl font-extrabold leading-tight">{group.name}</h1>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{group.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-gray-500 dark:text-gray-400 text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-5 h-5" />
              <span>
                {members.length} member{members.length !== 1 && "s"}
              </span>
            </div>
            {group.createdAt?.toDate && (
              <div title={group.createdAt.toDate().toLocaleString()}>
                Created: {group.createdAt.toDate().toLocaleDateString()}
              </div>
            )}
          </div>
          {/* Invite link */}
          <div className="mt-4 max-w-md flex items-center gap-2 rounded bg-gray-100 dark:bg-gray-800 p-2">
            <LinkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <input
              type="text"
              readOnly
              className="flex-grow bg-transparent border-none text-ellipsis overflow-hidden whitespace-nowrap focus:outline-none cursor-pointer"
              value={inviteUrl}
              aria-label="Group invite link"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={copyInviteUrl}
              aria-label="Copy invite link"
            >
              {inviteCopied ? "Copied" : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-4">
            {!isMember && (
              <Button
                variant="default"
                onClick={handleJoinGroup}
                disabled={joinLoading || !user}
              >
                {joinLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : "Join Group"}
              </Button>
            )}
            {isMember && (
              <>
                {isMember && (
                  <Button
                    onClick={() => router.push(`/groups/${groupId}/chat`)}
                    className="flex items-center gap-2"
                  >
                    <MessageSquare /> Go to Chat
                  </Button>
                )}
                {isAdminOrOwner && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/groups/${groupId}/edit`)}
                    className="flex items-center gap-2"
                  >
                    <Pencil /> Edit Group
                  </Button>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="flex items-center gap-2"
                >
                  <Link href={`/groups/${groupId}/info`}>
                    <Pencil /> Information
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLeaveGroup}
                  disabled={leaveLoading || isOwner}
                  className="flex items-center gap-2"
                >
                  {leaveLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
                      Leaving...
                    </>
                  ) : (
                    "Leave Group"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Members section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            Members <Users className="w-6 h-6" />
          </h2>
          <input
            type="search"
            placeholder="Search members..."
            className="max-w-xs w-full rounded border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Pending join requests */}
        {Array.isArray(group.requests) && group.requests.length > 0 && isAdminOrOwner && (
          <div className="mb-6 p-4 rounded border">
            <h3 className="font-semibold mb-2">Pending requests</h3>
            <ul className="space-y-2">
              {group.requests.map((uid: string) => (
                <li key={uid} className="flex items-center justify-between">
                  <span className="text-sm">{uid}</span>
                  <Button size="sm" onClick={async () => {
                    await approveRequest(groupId, uid);
                    setGroup((prev: any) => ({ ...prev, requests: prev.requests.filter((x: string) => x !== uid), members: [...prev.members, uid] }));
                    toast({ title: 'Request approved' });
                  }}>Approve</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {filteredMembers.length === 0 ? (
          <p className="text-gray-500">No members found.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-4 p-4 bg-white rounded shadow dark:bg-gray-800"
              >
                <Avatar className="w-12 h-12">
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  ) : (
                    <AvatarFallback>{member.name?.charAt(0) || "?"}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {member.name}
                    {member.id === user?.uid && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    {member.role === "owner" && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-blue-500" aria-label="Owner" />
                        Owner
                      </>
                    )}
                    {member.role === "admin" && (
                      <>
                        <Shield className="w-4 h-4 text-green-500" aria-label="Admin" />
                        Admin
                      </>
                    )}
                    {member.role === "member" && <>Member</>}
                  </span>
                  {/* Prevent self-demotion: don't show admin toggle on your own row */}
                  {isAdminOrOwner && member.role !== 'owner' && member.id !== user?.uid && (
                    <div className="mt-2">
                      <Button size="sm" variant={member.role === 'admin' ? 'outline' : 'secondary'} onClick={async () => {
                        await toggleAdmin(groupId, member.id, member.role !== 'admin');
                        setGroup((prev: any) => ({ ...prev, admins: member.role !== 'admin' ? [...(prev.admins||[]), member.id] : (prev.admins||[]).filter((x: string) => x !== member.id) }));
                        toast({ title: member.role !== 'admin' ? 'Promoted to admin' : 'Demoted to member' });
                      }}>
                        {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Announcements */}
      {isAdminOrOwner && (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-3">Announcements</h2>
          <div className="flex gap-2">
            <input className="flex-1 rounded border px-3 py-2" placeholder="Write an announcement..." value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
            <Button onClick={async () => {
              if (!announcement.trim()) return;
              await addAnnouncement(groupId, announcement.trim(), user?.uid);
              setAnnouncement('');
              toast({ title: 'Announcement posted' });
            }}>Post</Button>
          </div>
          <ul className="mt-4 space-y-2">
            {(group.announcements || []).slice().reverse().map((a: any) => (
              <li key={a.id} className="rounded border p-3 text-sm">
                <div className="opacity-80">{a.message}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
