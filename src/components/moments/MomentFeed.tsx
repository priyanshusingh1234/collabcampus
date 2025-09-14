"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MomentCard, MomentDoc } from "./MomentCard";
import MomentGridCard from './MomentGridCard';
import MomentGridSkeleton from './MomentGridSkeleton';
// Composer moved to dedicated /moments/new page
import { getAuth } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";

export function MomentFeed() {
  const [moments, setMoments] = useState<MomentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const auth = getAuth();

  async function load() {
    setRefreshing(true);
    try {
      const ref = collection(db, 'moments');
      const q = query(ref, orderBy('createdAt', 'desc'), limit(25));
      const snap = await getDocs(q);
      const list: MomentDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMoments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { 
    load(); 
    
    // Real-time updates
    const ref = collection(db, 'moments');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(25));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: MomentDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMoments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-safe px-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Moments
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={load} 
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Share your thoughts and discoveries with the community
        </p>
      </div>

      {/* Create Button (composer moved to /moments/new) */}
      {auth.currentUser && (
        <div className="flex justify-end">
          <Button asChild variant="secondary" size="sm">
            <a href="/moments/new">Create Moment</a>
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && <MomentGridSkeleton count={12} />}

      {/* Empty State */}
      {!loading && moments.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed">
          <div className="text-muted-foreground mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No moments yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to share a moment with the community!</p>
          {auth.currentUser ? (
            <p className="text-sm text-muted-foreground">Click the compose button above to get started</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sign in to share your first moment</p>
          )}
        </div>
      )}

      {/* Moments List */}
      {!loading && moments.length > 0 && (
        <>
          <div className="text-sm text-muted-foreground px-2">
            {moments.length} {moments.length === 1 ? 'moment' : 'moments'}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {moments.map(m => (
              <MomentGridCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}

      {/* Load More (optional) */}
      {moments.length >= 25 && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={load} disabled={refreshing}>
            {refreshing ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}