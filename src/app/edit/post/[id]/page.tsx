"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, where, query, getDocs } from "firebase/firestore";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";
import { ADMIN_EMAILS } from "@/lib/verification";

const TiptapEditor = dynamic(() => import("@/components/ui/tiptap").then(m => m.TiptapEditor), { ssr: false });

export default function EditPostPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const isOwner = useMemo(() => (!!post && !!user && post.uid === user.uid), [post, user]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Determine admin: allow-list or verifiedByAdmin flag in user doc
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return setIsAdmin(false);
      const allow = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
      if (allow) return setIsAdmin(true);
      try {
        const s = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
        const d = s.docs[0]?.data() as any;
        setIsAdmin(!!d?.verifiedByAdmin);
      } catch {
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, [user]);

  useEffect(() => {
    async function load() {
      try {
        const ref = doc(db, "posts", String(id));
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setPost(null);
          return;
        }
        const data = snap.data();
        setPost({ id: snap.id, ...data });
        setTitle((data as any).title || "");
        setContent((data as any).content || "");
        const t = Array.isArray((data as any).tags) ? (data as any).tags.join(", ") : ((data as any).tags || "");
        setTags(t);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function save() {
    if (!post) return;
    if (!isOwner && !isAdmin) return;
    setSaving(true);
    try {
      const ref = doc(db, "posts", String(id));
      const tagArray = (tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const payload: any = {
        title: title.trim(),
        content: content,
        tags: tagArray,
        updatedAt: serverTimestamp(),
      };
      if (isAdmin) {
        // Record admin attribution for this edit
        payload.editedBy = {
          uid: user?.uid,
          username: user?.displayName || null,
          email: user?.email || null,
          at: serverTimestamp(),
          role: 'admin',
        };
      }
      await updateDoc(ref, payload);
      const slug = (post as any).slug || post.id;
      router.push(`/blog/${slug}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <div className="container max-w-2xl py-6 lg:py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-3xl">Edit Post</CardTitle>
            <CardDescription>Update your post title, content, and tags.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : !post ? (
              <div className="py-10 text-center text-sm text-red-600">Post not found.</div>
            ) : !isOwner && !isAdmin ? (
              <div className="rounded-md border p-4 bg-amber-50 text-amber-900 text-sm">You can only edit your own post.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Content</label>
                  <TiptapEditor value={content} onChange={setContent} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tags</label>
                  <Input value={tags} placeholder="comma, separated, tags" onChange={(e) => setTags(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                  <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  );
}
