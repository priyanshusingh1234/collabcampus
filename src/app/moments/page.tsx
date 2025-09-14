import type { Metadata } from 'next';
import { MomentFeed } from '@/components/moments/MomentFeed';

export const metadata: Metadata = {
  title: 'Moments • Manthan',
  description: 'Share and explore visual snapshots from the community.'
};

export default function MomentsPage() {
  return (
    <div className="px-3 sm:px-4 md:px-6 py-6">
      <h1 className="fluid-h1 font-semibold mb-4">Moments</h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-xl">A lightweight visual feed of campus life. Share images and tag friends using @mentions.</p>
      <MomentFeed />
    </div>
  );
}
