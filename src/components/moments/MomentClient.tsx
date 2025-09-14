"use client";
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MomentCard, MomentDoc } from './MomentCard';
import { MomentComments } from './MomentComments';

export function MomentClient({ id }: { id: string }) {
  const [moment, setMoment] = useState<MomentDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ref = doc(db, 'moments', id);
        const snap = await getDoc(ref);
        if (snap.exists() && mounted) {
          setMoment({ id: snap.id, ...(snap.data() as any) });
        }
      } finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className='px-4 py-8 text-sm text-muted-foreground'>Loading...</div>;
  if (!moment) return <div className='px-4 py-8 text-sm text-muted-foreground'>Moment not found.</div>;
  return (
    <div className='max-w-xl mx-auto px-3 sm:px-4 md:px-6 py-6'>
      <MomentCard m={moment} />
      <MomentComments momentId={moment.id} author={{ uid: moment.authorId, username: moment.username }} />
    </div>
  );
}
