'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface GroupBasic {
  id: string;
  name: string;
  imageUrl?: string;
  members: string[];
}

export default function TopCommunities() {
  const [groups, setGroups] = useState<GroupBasic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const groupCollection = collection(db, 'groups');
        const groupSnapshot = await getDocs(groupCollection);
        let groupList: GroupBasic[] = groupSnapshot.docs.map((doc) => {
          const data = doc.data() as Partial<GroupBasic>;
          return {
            id: doc.id,
            name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Unknown',
            imageUrl: data.imageUrl ?? '',
            members: Array.isArray(data.members) ? data.members : [],
          };
        });
        // Sort by number of members, descending:
        groupList = groupList.sort((a, b) => (b.members.length || 0) - (a.members.length || 0));
        setGroups(groupList.slice(0, 6));
      } catch (err) {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-base text-gray-500 animate-pulse">Loading top communities...</div>
    );
  }

  if (!groups.length) {
    return (
      <div className="p-8 text-center text-gray-500 text-base">No popular communities yet.</div>
    );
  }

  return (
    <div className="w-full min-w-[250px] rounded-xl border bg-background p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">Top Communities</h2>
      <ul className="flex flex-col gap-2 min-w-0">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/60 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-10 h-10 shrink-0">
                {group.imageUrl ? (
                  <AvatarImage src={group.imageUrl} alt={group.name} />
                ) : (
                  <AvatarFallback>
                    {group.name?.charAt(0)?.toUpperCase() ?? 'G'}
                  </AvatarFallback>
                )}
              </Avatar>
              <span
                className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base max-w-[160px]"
                title={group.name}
              >
                {group.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              <Users className="w-4 h-4" />
              <span>{group.members.length}</span>
              <Link href={`/groups/${group.id}`} tabIndex={0} aria-label={`Go to ${group.name} group`}>
                <ArrowUpRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
