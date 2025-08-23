

'use client';




import { useEffect, useMemo, useState } from 'react';
import { getAllGroups } from '@/lib/groups';
import Link from 'next/link';
import { Group } from '@/app/types/group';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, PlusCircle, Loader2, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function GroupListPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'new' | 'members' | 'name'>('new');
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [user] = useAuthState(auth);

  useEffect(() => {
    async function fetchGroups() {
      const data = await getAllGroups();
      setGroups(data as Group[]);
      setLoading(false);
    }
    fetchGroups();
  }, []);

  // Apply search, filter, sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...groups];
    if (onlyMine && user) {
      list = list.filter(g => Array.isArray(g.members) && g.members.includes(user.uid));
    }
    if (q) {
      list = list.filter(g => (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'members':
        list.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
        break;
      case 'name':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'new':
      default:
        list.sort((a: any, b: any) => {
          const av = (a.createdAt?.toMillis?.() ?? Date.parse(a.createdAt ?? '')) || 0;
          const bv = (b.createdAt?.toMillis?.() ?? Date.parse(b.createdAt ?? '')) || 0;
          return bv - av;
        });
        break;
    }
    return list;
  }, [groups, search, sortBy, onlyMine, user]);

  const visible = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);
  const hasMore = visible.length < filtered.length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Explore Groups
        </h1>
        <Link href="/groups/create">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Create Group
          </Button>
        </Link>
      </div>

      {/* Controls */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search groups by name or description"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                aria-label="Sort groups"
                className="h-10 rounded-md border px-3 text-sm bg-background"
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
              >
                <option value="new">Newest</option>
                <option value="members">Most members</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <Label htmlFor="onlyMine" className="text-sm">My groups</Label>
                <Switch id="onlyMine" checked={onlyMine} onCheckedChange={(v) => { setOnlyMine(!!v); setPage(1); }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching groups</h3>
          <p className="text-gray-500 mb-6">Try adjusting your search or filters.</p>
          <Link href="/groups/create">
            <Button className="px-6 py-3">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((group) => (
            <Link 
              key={group.id} 
              href={`/groups/${group.id}`}
              className="group"
            >
              <div className="border rounded-lg p-5 hover:border-blue-500 transition-colors h-full flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={group.imageUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-green-500 text-white font-bold">
                      {group.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                      {group.name}
                    </h3>
                      <p className="text-sm text-gray-500">
                        {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                      </p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm flex-1">{group.description || 'No description'}</p>
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" className="w-full">
                    View Group
                  </Button>
                </div>
              </div>
            </Link>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button onClick={() => setPage((p) => p + 1)} variant="secondary">Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}