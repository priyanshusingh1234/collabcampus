import type { Metadata } from 'next';
import { MomentClient } from '@/components/moments/MomentClient';

export const metadata: Metadata = {
  title: 'Moment • Manthan'
};

export default function MomentDetailPage({ params }: { params: { id: string } }) {
  return <MomentClient id={params.id} />;
}
