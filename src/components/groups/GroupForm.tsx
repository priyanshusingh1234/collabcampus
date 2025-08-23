'use client';

import { useState } from 'react';
import { createGroup } from '@/lib/groups';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function GroupForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user] = useAuthState(auth);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to create a group.');
      return;
    }

    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setLoading(true);
    try {
      const groupId = await createGroup({
        name,
        description,
        imageUrl: '',
        createdBy: user.uid,
        members: [user.uid],
        admins: [user.uid],
      });

      router.push(`/groups/${groupId}`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to create group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto mt-6">
      <h2 className="text-2xl font-bold">Create a New Group</h2>

      {error && <p className="text-red-600">{error}</p>}

      <div>
        <label className="block mb-1 font-medium">Group Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter group name"
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">Description</label>
        <textarea
          className="w-full border px-3 py-2 rounded"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this group about?"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        disabled={loading}
      >
        {loading ? 'Creating...' : 'Create Group'}
      </button>
    </form>
  );
}
