"use client";

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MomentCard, MomentDoc } from '@/components/moments/MomentCard';
import Link from 'next/link';

export default function UserMomentsPage({ params }: { params: { username: string } }) {
  return <ClientUserMoments username={params.username} />;
}

function ClientUserMoments({ username }: { username: string }) {
  const [moments, setMoments] = useState<MomentDoc[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ref = collection(db, 'moments');
        const q = query(ref, where('username', '==', username), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        if (!active) return;
        setMoments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } finally { setLoading(false); }
    })();
    return () => { active = false; };
  }, [username]);

  if (loading) return <div className='px-4 py-8 text-sm text-muted-foreground'>Loading...</div>;
  if (!moments || moments.length === 0) {
    return (
      <div className='max-w-2xl mx-auto px-4 py-10 text-center space-y-4'>
        <h1 className='text-2xl font-semibold'>@{username}</h1>
        <p className='text-muted-foreground'>No moments yet.</p>
        <Link href='/moments/new' className='text-primary text-sm underline'>Share the first moment</Link>
      </div>
    );
  }

  return (
    <div className='max-w-2xl mx-auto px-4 py-6 space-y-6'>
      <div>
        <h1 className='text-xl font-semibold'>Moments by <span className='text-primary'>@{username}</span></h1>
        <p className='text-xs text-muted-foreground'>{moments.length} {moments.length === 1 ? 'moment' : 'moments'}</p>
      </div>
      <div className='space-y-6'>
        {moments.map(m => <MomentCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}
