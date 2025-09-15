import type { Metadata } from 'next';
import { MomentClient } from '@/components/moments/MomentClient';
import SeoClient from '@/components/SeoClient';

export const metadata: Metadata = {
  title: 'Moment • Manthan'
};

export default function MomentDetailPage({ params }: { params: { id: string } }) {
  // We can't synchronously access the moment data here (client component loads it),
  // but we can set a reasonable canonical and fallback title. The MomentClient can also render its own SeoClient when data is loaded.
  return (
    <>
      <SeoClient title={`Moment #${params.id}`} url={`/moments/${params.id}`} type="article" />
      <MomentClient id={params.id} />
    </>
  );
}
