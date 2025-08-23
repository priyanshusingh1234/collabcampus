'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc,
  getDoc,
  collection,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, Users, Shield, LogOut, Trash2, UserX, UserPlus } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

export default function GroupInfoPage() {
  const { groupId } = useParams();
  const gid = Array.isArray(groupId) ? groupId[0] : (groupId as string);
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [groupData, setGroupData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    admins: [] as string[],
    members: [] as string[],
  });
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);

  useEffect(() => {
  const fetchGroupAndMembers = async () => {
      try {
  const groupRef = doc(db, 'groups', gid);
        const groupSnap = await getDoc(groupRef);

        if (groupSnap.exists()) {
          const data = groupSnap.data();

          setGroupData({
            name: data.name || 'Unnamed Group',
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            admins: data.admins || [],
            members: data.members || [],
          });

          const createdBy = data.createdBy || null;
          setOwnerId(createdBy);

          if (currentUser) {
            const isMemberCheck = data.members?.includes(currentUser.uid) ?? false;
            setIsMember(isMemberCheck);
            const isAdminOrOwnerCheck =
              currentUser.uid === createdBy || (data.admins?.includes(currentUser.uid) ?? false);
            setIsAdminOrOwner(isAdminOrOwnerCheck);
          } else {
            // Not signed in, redirect to sign in
            router.push('/auth/signin');
            return;
          }

          const memberIds: string[] = data.members || [];
          const memberData: UserProfile[] = [];

          for (const uid of memberIds) {
            const userRef = doc(collection(db, 'users'), uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              memberData.push({
                id: uid,
                name: userData.username || 'Unknown',
                avatarUrl: userData.avatarUrl || '',
                isAdmin: (data.admins || []).includes(uid),
              });
            }
          }

          setMembers(memberData);
        } else {
          router.push('/groups');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch group info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupAndMembers();
  }, [gid, currentUser]);

  const joinGroup = async () => {
  if (!gid || !currentUser) return;
    setLoading(true);
    try {
  const groupRef = doc(db, 'groups', gid);
      await updateDoc(groupRef, {
        members: arrayUnion(currentUser.uid),
      });
      
      setIsMember(true);
      setGroupData(prev => ({
        ...prev,
        members: [...prev.members, currentUser.uid]
      }));
      
      setMembers(prev => [
        ...prev,
        {
          id: currentUser.uid,
          name: currentUser.displayName || 'You',
          avatarUrl: currentUser.photoURL || '',
          isAdmin: false
        }
      ]);
    } catch (err) {
      console.error('Failed to join group:', err);
      alert('Failed to join group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const makeAdmin = async (uid: string) => {
  if (!gid) return;
    setActionLoadingUserId(uid);
    try {
  const groupRef = doc(db, 'groups', gid);
      await updateDoc(groupRef, {
        admins: arrayUnion(uid),
      });

      setMembers(prev =>
        prev.map((m) =>
          m.id === uid ? { ...m, isAdmin: true } : m
        )
      );

      setGroupData(prev => ({
        ...prev,
        admins: [...prev.admins, uid],
      }));
    } catch (err) {
      console.error('Failed to make admin:', err);
      alert('Failed to make admin. Try again.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const dismissAdmin = async (uid: string) => {
  if (!gid || uid === ownerId) return;
    setActionLoadingUserId(uid);
    try {
  const groupRef = doc(db, 'groups', gid);
      await updateDoc(groupRef, {
        admins: arrayRemove(uid),
      });

      setMembers(prev =>
        prev.map((m) =>
          m.id === uid ? { ...m, isAdmin: false } : m
        )
      );

      setGroupData(prev => ({
        ...prev,
        admins: prev.admins.filter((id) => id !== uid),
      }));
    } catch (err) {
      console.error('Failed to dismiss admin:', err);
      alert('Failed to dismiss admin. Try again.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const kickUser = async (uid: string) => {
    if (!gid || !currentUser) return;
    if (uid === ownerId) return;

    const currentIsOwner = currentUser.uid === ownerId;
    const currentIsAdmin = groupData.admins.includes(currentUser.uid);
    const targetIsAdmin = groupData.admins.includes(uid);

    if (!currentIsOwner) {
      if (!currentIsAdmin || targetIsAdmin) return;
    }

    setActionLoadingUserId(uid);
    try {
  const groupRef = doc(db, 'groups', gid);
      await updateDoc(groupRef, {
        members: arrayRemove(uid),
        ...(targetIsAdmin && { admins: arrayRemove(uid) }),
      });

      setMembers(prev => prev.filter((m) => m.id !== uid));
      setGroupData(prev => ({
        ...prev,
        members: prev.members.filter((id) => id !== uid),
        admins: prev.admins.filter((id) => id !== uid),
      }));
    } catch (err) {
      console.error('Failed to kick user:', err);
      alert('Failed to kick user. Try again.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const leaveGroup = async () => {
  if (!currentUser || !gid || currentUser.uid === ownerId) return;
    setLoading(true);
    try {
  const groupRef = doc(db, 'groups', gid);
      await updateDoc(groupRef, {
        members: arrayRemove(currentUser.uid),
        admins: arrayRemove(currentUser.uid),
      });

      router.push('/groups');
    } catch (err) {
      console.error('Failed to leave group:', err);
      alert('Failed to leave group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async () => {
  if (!currentUser || !gid || currentUser.uid !== ownerId) return;
    if (!confirm('Are you sure you want to delete this group?')) return;

    setLoading(true);
    try {
  const groupRef = doc(db, 'groups', gid);
      await deleteDoc(groupRef);
      router.push('/groups');
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <Loader2 className="animate-spin h-8 w-8 text-gray-500" />
      </div>
    );
  }

  // If not a member, show only a minimal join prompt or redirect
  if (!loading && currentUser && !isMember) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Join this group to view info</h2>
        <p className="text-muted-foreground mb-4">You need to be a member to access group details.</p>
  <Button onClick={() => router.push(`/groups/${gid}`)}>Go to Group</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 flex items-center shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="mr-4 rounded-full p-1 hover:bg-green-700 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold">Group Information</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Group Header */}
        <div className="bg-white p-6 flex flex-col items-center border-b border-gray-200 shadow-sm">
          <Avatar className="h-32 w-32 mb-4 border-4 border-white shadow-md">
            <AvatarImage src={groupData.imageUrl} />
            <AvatarFallback className="bg-green-100 text-green-800 text-4xl font-bold">
              {groupData.name[0]}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold text-center text-gray-800">{groupData.name}</h2>
          <p className="text-gray-500 text-center mt-2">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        {/* Group Description */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium mb-2">DESCRIPTION</h3>
          <p className="text-gray-800 text-sm leading-relaxed">
            {groupData.description || 'This group has no description yet.'}
          </p>
        </div>

        {/* Join Button for non-members */}
        {!isMember && currentUser && (
          <div className="px-6 py-4">
            <Button 
              className="w-full py-6 text-lg font-bold"
              onClick={joinGroup}
              disabled={loading}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Join Group
            </Button>
          </div>
        )}

        {/* Members Section - Only show if member */}
        {isMember && (
          <div className="bg-white px-6 py-4 mt-4">
            <div className="flex items-center text-gray-500 mb-3">
              <Users size={18} className="mr-2" />
              <span className="text-sm font-medium">
                MEMBERS ({members.length})
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {members.map((member) => {
                const isCurrentUser = currentUser?.uid === member.id;
                const isOwner = member.id === ownerId;
                const canMakeAdmin = isAdminOrOwner && !member.isAdmin && !isOwner;
                const canDismissAdmin = isAdminOrOwner && member.isAdmin && !isOwner;
                const canKick = isAdminOrOwner && !isOwner && !isCurrentUser;
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback className="bg-gray-100">
                          {member.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-800">
                          {member.name}
                          {isCurrentUser && (
                            <span className="ml-2 text-gray-500 text-sm">(You)</span>
                          )}
                        </p>
                        {member.isAdmin && (
                          <div className="flex items-center text-xs mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full ${
                              isOwner 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {isOwner ? 'Owner' : 'Admin'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions for admins/owner */}
                    {isAdminOrOwner && !isOwner && !isCurrentUser && (
                      <div className="flex gap-2">
                        {!member.isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => makeAdmin(member.id)}
                            disabled={loading || actionLoadingUserId === member.id}
                          >
                            {actionLoadingUserId === member.id ? (
                              <Loader2 className="animate-spin h-3 w-3 mr-1" />
                            ) : (
                              <Shield className="h-3 w-3 mr-1" />
                            )}
                            Make Admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7 px-2"
                            onClick={() => dismissAdmin(member.id)}
                            disabled={loading || actionLoadingUserId === member.id}
                          >
                            {actionLoadingUserId === member.id ? (
                              <Loader2 className="animate-spin h-3 w-3 mr-1" />
                            ) : (
                              <Shield className="h-3 w-3 mr-1" />
                            )}
                            Remove Admin
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2 text-red-600 hover:bg-red-50"
                          onClick={() => kickUser(member.id)}
                          disabled={loading || actionLoadingUserId === member.id}
                          title="Remove from group"
                        >
                          {actionLoadingUserId === member.id ? (
                            <Loader2 className="animate-spin h-3 w-3" />
                          ) : (
                            <UserX className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Danger Zone - Only show for members */}
        {isMember && (
          <div className="bg-white px-6 py-4 mt-6 border border-red-100 rounded-lg mx-4">
            <h3 className="font-medium text-red-600 mb-3">DANGER ZONE</h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={leaveGroup}
                disabled={loading}
              >
                <LogOut size={16} />
                Leave Group
              </Button>

              {currentUser?.uid === ownerId && (
                <Button
                  variant="destructive"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={deleteGroup}
                  disabled={loading}
                >
                  <Trash2 size={16} />
                  Delete Group
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}