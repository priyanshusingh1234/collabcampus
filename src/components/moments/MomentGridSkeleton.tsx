import React from 'react';

export function MomentGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
            className="aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 relative"
        >
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.35),transparent_60%)] dark:bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-60">
            <div className="h-3 w-16 rounded bg-white/50 dark:bg-white/10" />
            <div className="h-3 w-6 rounded bg-white/40 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default MomentGridSkeleton;
