'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, X, ChevronLeft } from 'lucide-react';

export default function EditGroupPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [groupData, setGroupData] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroup = async () => {
      if (!groupId || !user) return;

      const docRef = doc(db, 'groups', groupId as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupData(data);
        setNewName(data.name || '');
        setNewDesc(data.description || '');
        setPreviewImage(data.imageUrl || '');

        const isCurrentUserAdmin = data.admins?.includes(user.uid);
        setIsAdmin(isCurrentUserAdmin);

        if (!isCurrentUserAdmin) {
          router.push(`/groups/${groupId}`);
        }
      }
    };

    fetchGroup();
  }, [groupId, user, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewFile(file);
      setPreviewImage(URL.createObjectURL(file));
      setErrorMessage(null);
    }
  };

  const handleUpdate = async () => {
    setErrorMessage(null);
    if (!newName.trim() || !newDesc.trim()) {
      setErrorMessage('Group name and description cannot be empty.');
      return;
    }
    setLoading(true);

    try {
      let imageUrl = groupData.imageUrl;
      let imageFileId = groupData.imageFileId;

      if (newFile) {
        // Delete old image if exists
        if (imageFileId) {
          await fetch('/api/imagekit/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: imageFileId }),
          });
        }

        // Upload new image to 'posts' folder
        const formData = new FormData();
        formData.append('file', newFile);
        formData.append('fileName', `group-${Date.now()}`);
        formData.append('folder', 'posts'); // Always use 'posts'

        const res = await fetch('/api/imagekit/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        imageUrl = data.url;
        imageFileId = data.fileId;
      }

      // Update Firestore
      await updateDoc(doc(db, 'groups', groupId as string), {
        name: newName.trim(),
        description: newDesc.trim(),
        imageUrl,
        imageFileId,
      });

      router.push(`/groups/${groupId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !groupData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <Loader2 className="animate-spin text-gray-500" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only group admins can edit this group.</p>
          <Button 
            onClick={() => router.push(`/groups/${groupId}`)} 
            className="mt-4 bg-green-500 hover:bg-green-600"
          >
            Back to Group
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-green-100 py-8">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg">
        <div className="flex items-center mb-8">
          <button onClick={() => router.back()} className="mr-4 hover:bg-gray-200 rounded-full p-1 transition duration-150">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-2xl font-bold flex-1">Edit Group Info</h1>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div
              className="w-32 h-32 rounded-full bg-gray-100 shadow flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-green-400"
              onClick={() => fileInputRef.current?.click()}
              title="Change group photo"
            >
              {previewImage ? (
                <img src={previewImage} alt="Group" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={56} className="text-gray-300" />
              )}
            </div>
            {previewImage && (
              <button
                onClick={() => {
                  setPreviewImage(null);
                  setNewFile(null);
                  setErrorMessage(null);
                }}
                className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow transition"
                type="button"
                aria-label="Remove selected image"
              >
                <X size={17} />
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          <p className="text-gray-500 mt-2 text-sm">Tap photo to change group icon</p>
        </div>

        {errorMessage && (
          <div className="mb-4 text-center text-red-600 font-medium animate-pulse">
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="text-sm text-gray-600 mb-1 block font-medium">Group Name</label>
            <Input
              className="border-gray-300 focus:border-green-500 focus:ring-green-500 p-3 rounded-lg text-base"
              placeholder="Enter group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={100}
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block font-medium">Description</label>
            <Input
              className="border-gray-300 focus:border-green-500 focus:ring-green-500 p-3 rounded-lg text-base"
              placeholder="Enter group description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={500}
              disabled={loading}
            />
          </div>
        </div>

        <Button 
          onClick={handleUpdate} 
          disabled={loading || !newName.trim() || !newDesc.trim()}
          className="w-full mt-8 bg-green-500 hover:bg-green-600 text-white py-4 text-lg font-semibold transition-all duration-150 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
