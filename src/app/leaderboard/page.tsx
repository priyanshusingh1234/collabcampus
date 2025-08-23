import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { VerifiedTick } from '@/components/ui/VerifiedTick';

export const dynamic = 'force-dynamic';

type LeaderboardUser = {
  id: string;
  username?: string;
  avatarUrl?: string;
  verified?: boolean;
  stats?: { reputation?: number; points?: number };
};

async function getTopUsers() {
  const usersRef = collection(db, 'users');
  // Order by reputation (legacy field) with newer installs optionally using stats.points
  const q = query(usersRef, orderBy('stats.reputation', 'desc'), limit(20));
  let snap = await getDocs(q);
  // Fallback to points if reputation isn't set in this project
  if (snap.empty) {
    const q2 = query(usersRef, orderBy('stats.points', 'desc'), limit(20));
    snap = await getDocs(q2);
  }
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaderboardUser));
}

export default async function LeaderboardPage() {
  const users = await getTopUsers();
  const top3 = users.slice(0, 3) as LeaderboardUser[];
  const rest = users.slice(3) as LeaderboardUser[];

  return (
    <div className="min-h-[70vh]">
      {/* Gradient hero */}
      <div className="bg-gradient-to-br from-fuchsia-500 via-violet-600 to-blue-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center drop-shadow-sm uppercase">Team Leaderboard</h1>
          <p className="mt-2 text-center text-white/90">Top community contributors by reputation</p>

          {/* Top 3 highlights */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {top3.map((user, i) => {
              const score = (user?.stats?.reputation ?? user?.stats?.points ?? 0) as number;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
              const cardTint = i === 0
                ? 'from-amber-300/30 to-amber-500/10'
                : i === 1
                  ? 'from-slate-300/30 to-slate-500/10'
                  : 'from-yellow-200/30 to-yellow-500/10';
              const avatar = user?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.username || 'U')}`;
              return (
                <div key={user.id} className={`relative rounded-2xl p-5 bg-white/15 backdrop-blur-md border border-white/20 shadow-xl`}> 
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cardTint} pointer-events-none`} />
                  <div className="relative flex items-center gap-4">
                    <div className="text-2xl" aria-hidden>{medal}</div>
                    {avatar.endsWith('.svg') ? (
                      <img src={avatar} alt={user?.username || 'User'} className="w-14 h-14 rounded-full ring-2 ring-white/50 bg-white/80" />
                    ) : (
                      <Image src={avatar} alt={user?.username || 'User'} width={56} height={56} className="rounded-full ring-2 ring-white/50 bg-white/80" />
                    )}
                    <div className="min-w-0">
                      {user?.username ? (
                        <Link href={`/user/${user.username}`} className="font-semibold text-lg flex items-center gap-1 truncate">
                          <span className="truncate">{user.username}</span>
                          {user?.verified ? <VerifiedTick size={14} /> : null}
                        </Link>
                      ) : (
                        <div className="font-semibold text-lg flex items-center gap-1 truncate">
                          <span className="truncate">User</span>
                          {user?.verified ? <VerifiedTick size={14} /> : null}
                        </div>
                      )}
                      <div className="text-xs text-white/80">{score} pts</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* List section */}
      <div className="max-w-5xl mx-auto -mt-8 px-4 pb-12">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 p-1 shadow-2xl">
          <div className="rounded-3xl bg-white/75 dark:bg-zinc-900/70 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10">
            {rest.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-zinc-700 dark:text-zinc-300">No more users yet.</div>
            )}
            {rest.map((user, i) => {
              const score = user?.stats?.reputation ?? user?.stats?.points ?? 0;
              const rank = i + 4;
              const avatar = user?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.username || 'U')}`;
              return (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-white/70 dark:bg-white/10 text-indigo-700 dark:text-indigo-300 font-bold grid place-items-center shadow-sm">
                    {rank}
                  </div>
                  {avatar.endsWith('.svg') ? (
                    <img src={avatar} alt={user?.username || 'User'} className="w-9 h-9 rounded-full border border-black/5 dark:border-white/10 bg-white" />
                  ) : (
                    <Image src={avatar} alt={user?.username || 'User'} width={36} height={36} className="rounded-full border border-black/5 dark:border-white/10 bg-white" />
                  )}
                  <div className="flex-1 min-w-0">
                    {user?.username ? (
                      <Link href={`/user/${user.username}`} className="font-medium hover:underline flex items-center gap-1 truncate">
                        <span className="truncate">{user.username}</span>
                        {user?.verified ? <VerifiedTick size={12} /> : null}
                      </Link>
                    ) : (
                      <div className="font-medium flex items-center gap-1 truncate">
                        <span className="truncate">User</span>
                        {user?.verified ? <VerifiedTick size={12} /> : null}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground/80 truncate">Answers: {(user as any)?.stats?.answers ?? 0} • Followers: {(user as any)?.stats?.followers ?? 0}</div>
                  </div>
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{score} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
