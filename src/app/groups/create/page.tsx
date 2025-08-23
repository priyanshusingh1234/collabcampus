"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import GroupForm from '@/components/groups/GroupForm';

export default function CreateGroupPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="p-6">
      <GroupForm />
    </main>
  );
}
