"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ADMIN_EMAILS } from "@/lib/verification";
import { Edit, Trash2, ShieldBan, RefreshCw, Search } from "lucide-react";

type Item = any;

function formatDate(d: any) {
  try {
    const date = typeof d?.toDate === "function" ? d.toDate() : d ? new Date(d) : null;
    return date ? date.toLocaleDateString() + " " + date.toLocaleTimeString() : "";
  } catch {
    return "";
  }
}

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
function chunk<T>(arr: T[], size: number) { const out: T[][] = []; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i, i+size)); return out; }

export default function AdminModerationPage() {
  const [user, loading] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<Item[]>([]);
  const [questions, setQuestions] = useState<Item[]>([]);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ action: "delete-post"|"delete-question"|"block"|"unblock"; id: string; uid?: string }|null>(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [blockReason, setBlockReason] = useState<string>("Spam or scam");

  // Load admin gate + content
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
      const data = snap.docs[0]?.data() as any;
      const allowed = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase()) || !!data?.verifiedByAdmin;
      setIsAdmin(!!allowed);
      if (allowed) {
        const postSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)));
        const qSnap = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "desc"), limit(50)));
        const ps = postSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const qs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPosts(ps);
        setQuestions(qs);

        // Prime blocked map for visible authors (batch by 10 due to Firestore 'in' limit)
        const uids = uniq([
          ...ps.map((p: any) => p?.author?.id || p?.author?.uid || p?.uid).filter(Boolean),
          ...qs.map((q: any) => q?.author?.id || q?.author?.uid || q?.uid).filter(Boolean),
        ]) as string[];
        for (const group of chunk(uids, 10)) {
          if (!group || group.length === 0) continue;
          const s = await getDocs(query(collection(db, "users"), where("uid", "in", group)));
          setBlocked(prev => ({
            ...prev,
            ...Object.fromEntries(s.docs.map(d => [ (d.data() as any).uid, !!(d.data() as any).blocked ])),
          }));
        }
      }
    })();
  }, [loading, user]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(p => `${p.title} ${p.slug}`.toLowerCase().includes(q));
  }, [posts, search]);
  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(p => `${p.title} ${p.slug}`.toLowerCase().includes(q));
  }, [questions, search]);

  async function toggleBlock(uid: string, value: boolean, reason?: string) {
    setBusy(`block-${uid}`);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
      const userDoc = snap.docs[0];
      if (userDoc) {
        const payload: any = {
          blocked: value,
          blockedAt: value ? new Date() : null,
          blockedReason: value ? (reason || "Violation of community guidelines") : null,
          blockedBy: value
            ? {
                uid: user?.uid || null,
                email: user?.email || null,
                username: user?.displayName || null,
              }
            : null,
        };
        await updateDoc(doc(db, "users", userDoc.id), payload);
        setBlocked(prev => ({ ...prev, [uid]: value }));
      }
    } finally {
      setBusy(null);
    }
  }

  async function removePost(id: string) {
    setBusy(`post-${id}`);
    try {
      const postRef = doc(db, "posts", id);
      // Best-effort: delete associated image if stored in ImageKit
      try {
        const snap = await getDoc(postRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          const fileId = data?.imageFileId;
          if (fileId) {
            await fetch('/api/imagekit/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId }),
            }).catch(() => null);
          }
        }
      } catch {}

      // Cascade: delete comments for this post
      try {
        const commentsSnap = await getDocs(query(collection(db, 'comments'), where('postId', '==', id)));
        if (!commentsSnap.empty) {
          const docs = commentsSnap.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
            // eslint-disable-next-line no-await-in-loop
            await batch.commit();
          }
        }
      } catch (e) {
        console.warn('Failed to cascade-delete comments for post', id, e);
      }

      await deleteDoc(postRef);
      setPosts(prev => prev.filter(p => p.id !== id));
    } finally { setBusy(null); }
  }
  async function removeQuestion(id: string) {
    setBusy(`q-${id}`);
    try {
      const qRef = doc(db, "questions", id);

      // Cascade: delete answers subcollection
      try {
        const ansSnap = await getDocs(collection(db, 'questions', id, 'answers'));
        if (!ansSnap.empty) {
          const docs = ansSnap.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
            // eslint-disable-next-line no-await-in-loop
            await batch.commit();
          }
        }
      } catch (e) {
        console.warn('Failed to cascade-delete answers for question', id, e);
      }

      await deleteDoc(qRef);
      setQuestions(prev => prev.filter(p => p.id !== id));
    } finally { setBusy(null); }
  }

  if (loading) return <div className="container py-10">Loading…</div>;
  if (!user) return <div className="container py-10">Sign in to continue.</div>;
  if (!isAdmin) return <div className="container py-10">Access denied.</div>;

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin Moderation</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or slug" className="pl-8 w-64" />
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Clear
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="posts">Posts ({filteredPosts.length})</TabsTrigger>
          <TabsTrigger value="questions">Questions ({filteredQuestions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          {filteredPosts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No posts found.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((p: any) => {
                const authorUsername = p?.author?.username || p?.username || "unknown";
                const authorAvatar = p?.author?.avatarUrl || p?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(authorUsername || "U")}`;
                const uid = p?.author?.id || p?.author?.uid || p?.uid;
                const isBlocked = uid ? blocked[uid] : false;
                return (
                  <Card key={p.id} className="flex flex-col">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-base line-clamp-1">{p.title}</CardTitle>
                      <div className="text-xs text-muted-foreground line-clamp-1">{p.slug}</div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarImage src={authorAvatar} alt={authorUsername} /><AvatarFallback delayMs={0}>{String(authorUsername || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <Link href={`/user/${authorUsername}`} className="text-sm hover:underline">{authorUsername}</Link>
                        {isBlocked && <Badge variant="destructive" className="ml-2">Blocked</Badge>}
                        <div className="ml-auto text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Link href={`/edit/post/${p.id}`}><Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1"/>Edit</Button></Link>
                        <Button variant="destructive" size="sm" onClick={() => setConfirm({ action: "delete-post", id: p.id })}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
                        <Button variant={isBlocked ? "secondary" : "outline"} size="sm" onClick={() => uid && setConfirm({ action: isBlocked ? "unblock" : "block", id: p.id, uid })}>
                          <ShieldBan className="h-4 w-4 mr-1"/>{isBlocked ? "Unblock" : "Block"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          {filteredQuestions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No questions found.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuestions.map((q: any) => {
                const authorUsername = q?.author?.username || q?.username || "unknown";
                const authorAvatar = q?.author?.avatarUrl || q?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(authorUsername || "U")}`;
                const uid = q?.author?.id || q?.author?.uid || q?.uid;
                const isBlocked = uid ? blocked[uid] : false;
                return (
                  <Card key={q.id} className="flex flex-col">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-base line-clamp-1">{q.title}</CardTitle>
                      <div className="text-xs text-muted-foreground line-clamp-1">{q.slug}</div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarImage src={authorAvatar} alt={authorUsername} /><AvatarFallback delayMs={0}>{String(authorUsername || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <Link href={`/user/${authorUsername}`} className="text-sm hover:underline">{authorUsername}</Link>
                        {isBlocked && <Badge variant="destructive" className="ml-2">Blocked</Badge>}
                        <div className="ml-auto text-xs text-muted-foreground">{formatDate(q.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Link href={`/edit/question/${q.id}`}><Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1"/>Edit</Button></Link>
                        <Button variant="destructive" size="sm" onClick={() => setConfirm({ action: "delete-question", id: q.id })}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
                        <Button variant={isBlocked ? "secondary" : "outline"} size="sm" onClick={() => uid && setConfirm({ action: isBlocked ? "unblock" : "block", id: q.id, uid })}>
                          <ShieldBan className="h-4 w-4 mr-1"/>{isBlocked ? "Unblock" : "Block"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "delete-post" && "Delete this post?"}
              {confirm?.action === "delete-question" && "Delete this question?"}
              {confirm?.action === "block" && "Block this user?"}
              {confirm?.action === "unblock" && "Unblock this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action?.startsWith("delete") ? "This action cannot be undone." : "They won't be able to create content while blocked."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.action === "block" && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Reason</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm bg-background"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              >
                <option>Spam or scam</option>
                <option>Harassment or hate</option>
                <option>Nudity/sexual content</option>
                <option>Misinformation</option>
                <option>Impersonation</option>
                <option>Off-platform abuse</option>
                <option>Other</option>
              </select>
              {blockReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter a short reason"
                  className="w-full border rounded px-2 py-1 text-sm"
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm) return;
                if (confirm.action === "delete-post") await removePost(confirm.id);
                if (confirm.action === "delete-question") await removeQuestion(confirm.id);
                if (confirm.action === "block" && confirm.uid) await toggleBlock(confirm.uid, true, blockReason);
                if (confirm.action === "unblock" && confirm.uid) await toggleBlock(confirm.uid, false);
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
