import type { Metadata } from 'next';
import { MomentComposer } from '@/components/moments/MomentComposer';

export const metadata: Metadata = {
  title: 'New Moment • Manthan',
  description: 'Share a new moment.'
};

export default function NewMomentPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="fluid-h2 font-semibold mb-4">Share a Moment</h1>
      <MomentComposer />
    </div>
  );
}
