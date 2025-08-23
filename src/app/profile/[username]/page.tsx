"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as Icons from "lucide-react";
import { isPremium } from "@/lib/premium";
import { useAuth } from "@/components/auth/AuthProvider";

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentAuthUser } = useAuth();
  const usernameParam = decodeURIComponent(params.username as string);

  const [loading, setLoading] = useState(true);
  const [profileDocId, setProfileDocId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerKey, setBannerKey] = useState<string>("");
  const [bannerImageUrl, setBannerImageUrl] = useState<string>("");
  const [bannerImageFileId, setBannerImageFileId] = useState<string>("");
  const [bannerImageFilePath, setBannerImageFilePath] = useState<string>("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [cookiePremium] = useState(false);
  const [drafts, setDrafts] = useState<Array<{ id: string; contentHtml: string; createdAt?: any; updatedAt?: any }>>([]);

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, "users"), where("username", "==", usernameParam));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setProfile(null);
          setProfileDocId(null);
          return;
        }
        const docData = snapshot.docs[0];
        const data = docData.data();
    setProfileDocId(docData.id);
        setProfile(data);
    setDisplayName(data.displayName || "");
        setBio(data.bio || "");
  setAvatarUrl(data.avatarUrl || "");
  setBannerKey((data as any).bannerKey || "");
  setBannerImageUrl((data as any).bannerImageUrl || "");
  setBannerImageFileId((data as any).bannerImageFileId || "");
  setBannerImageFilePath((data as any).bannerImageFilePath || "");
  setLinks(Array.isArray(data.links) ? data.links.filter((l: any) => l && (l.url || l.label)) : []);
      } catch (e) {
        console.error("Failed to load profile", e);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [usernameParam]);

  const isOwner = useMemo(() => {
    if (!profile || !currentAuthUser) return false;
    return currentAuthUser.uid === profile.uid;
  }, [currentAuthUser, profile]);
  const premium = isPremium(profile);

  // Subscribe to user's drafts when viewing own profile
  useEffect(() => {
    if (!isOwner || !currentAuthUser?.uid) return;
    const col = collection(db, "users", currentAuthUser.uid, "drafts");
    const q = query(col, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setDrafts(rows);
    });
    return () => unsub();
  }, [isOwner, currentAuthUser?.uid]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileDocId) return;
    if (!isOwner) {
      toast.error("You can only edit your own profile.");
      return;
    }
    try {
      setSaving(true);
      // Validate links
      const cleanedLinks = (links || [])
        .map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() }))
        .filter((l) => l.label && l.url)
        .slice(0, 5);
  // Premium paused: allow saving current bannerKey as-is
  const bannerToSave = (bannerKey || "").trim();
      await updateDoc(doc(db, "users", profileDocId), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
        bannerKey: bannerToSave,
        links: cleanedLinks,
        updatedAt: serverTimestamp(),
      });
  // keep banner selection
      toast.success("Profile updated");
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!profileDocId || !profile) return;
    if (!isOwner) {
      toast.error("You can only edit your own profile.");
      return;
    }
    // Basic validations
    const MAX_MB = 5;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_MB}MB`);
      return;
    }

    const toastId = toast.loading("Uploading avatar...");
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fileName", `avatar-${profile.username}-${Date.now()}`);
      form.append("folder", "avatars");

      const res = await fetch("/api/imagekit/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Upload failed");
      }

      const oldFileId = (profile as any).avatarFileId as string | undefined;

      // Update Firestore with new avatar
      await updateDoc(doc(db, "users", profileDocId), {
        avatarUrl: data.url,
        avatarFileId: data.fileId,
        avatarFilePath: data.filePath,
        updatedAt: serverTimestamp(),
      });

      setAvatarUrl(data.url);
  setProfile((prev: any) => prev ? ({ ...prev, avatarUrl: data.url, avatarFileId: data.fileId, avatarFilePath: data.filePath }) : prev);

      // Best-effort: delete previous avatar if exists
      if (oldFileId && oldFileId !== data.fileId) {
        try {
          await fetch("/api/imagekit/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: oldFileId }),
          });
        } catch (err) {
          console.warn("Old avatar delete failed", err);
        }
      }

      toast.success("Avatar updated", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Avatar upload failed", { id: toastId });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleBannerUpload(file: File) {
  // Premium paused: allow custom banner upload
    if (!profileDocId || !profile) return;
    if (!isOwner) {
      toast.error("You can only edit your own profile.");
      return;
    }
    const MAX_MB = 5;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_MB}MB`);
      return;
    }

    const toastId = toast.loading("Uploading banner...");
    setBannerUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fileName", `banner-${profile.username}-${Date.now()}`);
      form.append("folder", "banners");

      const res = await fetch("/api/imagekit/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Upload failed");
      }

      const oldFileId = (profile as any).bannerImageFileId || bannerImageFileId || undefined;

      // Persist banner fields immediately
      await updateDoc(doc(db, "users", profileDocId), {
        bannerKey: "custom",
        bannerImageUrl: data.url,
        bannerImageFileId: data.fileId,
        bannerImageFilePath: data.filePath,
        updatedAt: serverTimestamp(),
      });
      setBannerKey("custom");
      setBannerImageUrl(data.url);
      setBannerImageFileId(data.fileId);
      setBannerImageFilePath(data.filePath);
      setProfile((prev: any) => prev ? ({ ...prev, bannerKey: "custom", bannerImageUrl: data.url, bannerImageFileId: data.fileId, bannerImageFilePath: data.filePath }) : prev);

      // Delete previous custom banner if different
      if (oldFileId && oldFileId !== data.fileId) {
        try {
          await fetch("/api/imagekit/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: oldFileId }),
          });
        } catch (err) {
          console.warn("Old banner delete failed", err);
        }
      }

      toast.success("Banner uploaded", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Banner upload failed", { id: toastId });
    } finally {
      setBannerUploading(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    }
  }

  async function removeCustomBanner() {
    if (!profileDocId) return;
    const oldFileId = bannerImageFileId || (profile as any)?.bannerImageFileId;
    try {
      if (oldFileId) {
        await fetch("/api/imagekit/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: oldFileId }),
        });
      }
    } catch (e) {
      console.warn("Banner delete failed", e);
    }
    await updateDoc(doc(db, "users", profileDocId), {
      bannerImageUrl: "",
      bannerImageFileId: "",
      bannerImageFilePath: "",
      updatedAt: serverTimestamp(),
    });
    setBannerImageUrl("");
    setBannerImageFileId("");
    setBannerImageFilePath("");
  }

  async function handleSelectBanner(key: string) {
    if (!isOwner || saving) return;
  // Premium paused: allow selection
    // If switching away from custom, delete the old custom file
    if (bannerKey === "custom" && key !== "custom" && (bannerImageFileId || (profile as any)?.bannerImageFileId)) {
      await removeCustomBanner();
    }
    setBannerKey(key);
    // Persist selection (without blocking on save)
    if (profileDocId) {
      try {
        await updateDoc(doc(db, "users", profileDocId), {
          bannerKey: key,
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Icons.Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container max-w-3xl py-10 text-center">
        <div className="text-red-500 flex flex-col items-center gap-4">
          <Icons.UserX className="h-12 w-12" />
          <h1 className="text-2xl font-bold">User not found</h1>
          <Button variant="outline" onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Edit Profile</h1>
        <div className="flex gap-2">
          <Link href={`/user/${encodeURIComponent(profile.username || "")}`}>
            <Button variant="outline">View public profile</Button>
          </Link>
          <Link href="/me/content">
            <Button variant="secondary">Go to Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <Avatar className="h-28 w-28 border-4 border-primary/20">
            <AvatarImage src={avatarUrl || profile.avatarUrl || ""} />
            <AvatarFallback>{profile.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          {isOwner && (
            <div className="absolute -bottom-2 -right-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-full shadow-md h-10 w-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Change avatar"
              >
                {avatarUploading ? (
                  <Icons.Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icons.Upload className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </div>
          )}
        </div>
        <p className="text-muted-foreground mt-2">@{profile.username}</p>
      </div>

      {!isOwner && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          You are viewing someone else's profile. Fields are read-only.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Premium Banner (Selection) */}
        <div className="grid gap-2">
          <Label>Profile Banner</Label>
          <div className="text-xs text-muted-foreground -mt-1">Animated banners appear on your public profile header.</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "", label: "None", className: "bg-muted" },
              { key: "gradients", label: "Gradients", className: "banner-gradients" },
              { key: "stripes", label: "Stripes", className: "banner-stripes" },
              { key: "blobs", label: "Blobs", className: "banner-blobs" },
              { key: "shine", label: "Shine", className: "banner-shine" },
              { key: "popdots", label: "Pop Dots", className: "banner-popdots" },
              { key: "waves", label: "Waves", className: "banner-waves" },
              { key: "sparkles", label: "Sparkles", className: "banner-sparkles" },
              { key: "clouds", label: "Clouds", className: "banner-clouds" },
            ].map((opt) => (
              <button
                key={opt.key || "none"}
                type="button"
                className={`relative h-20 rounded-lg border overflow-hidden ${opt.className} ${bannerKey === opt.key ? "ring-2 ring-indigo-500" : ""}`}
                onClick={() => handleSelectBanner(opt.key)}
                disabled={!isOwner || saving}
                title={opt.label}
              >
                <span className="absolute bottom-1 left-1 right-1 text-[11px] px-2 py-0.5 rounded bg-black/40 text-white backdrop-blur-sm">{opt.label}</span>
                {bannerKey === opt.key && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 text-[10px] rounded-full bg-white text-indigo-600 font-bold">✓</span>
                )}
              </button>
            ))}
            {/* Custom banner tile */}
            <button
              type="button"
              className={`relative h-20 rounded-lg border overflow-hidden ${bannerKey === 'custom' ? 'ring-2 ring-indigo-500' : ''}`}
              onClick={() => bannerFileInputRef.current?.click()}
              disabled={!isOwner || saving || bannerUploading}
              title="Custom"
            >
              {bannerImageUrl ? (
                <img src={bannerImageUrl} alt="Custom banner" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Upload</div>
              )}
              <span className="absolute bottom-1 left-1 right-1 text-[11px] px-2 py-0.5 rounded bg-black/40 text-white backdrop-blur-sm">Custom</span>
            </button>
          </div>
          {/* */}
          {/* Hidden input for banner upload */}
          <input
            ref={bannerFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBannerUpload(f);
            }}
          />
          {bannerImageUrl && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => handleSelectBanner('custom')} disabled={!isOwner || saving}>Use custom</Button>
              <Button type="button" variant="destructive" size="sm" onClick={removeCustomBanner} disabled={!isOwner || saving || bannerUploading}>Remove custom file</Button>
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!isOwner || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            placeholder="A short bio about you"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={!isOwner || saving}
            rows={5}
          />
        </div>

        <div className="grid gap-2">
          <Label>Links (up to 5)</Label>
          <div className="space-y-2">
            {links.map((link, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <Input
                  placeholder="Label (e.g., Website)"
                  value={link.label}
                  onChange={(e) => setLinks((prev) => prev.map((l, i) => i === idx ? { ...l, label: e.target.value } : l))}
                  disabled={!isOwner || saving}
                  className="md:col-span-2"
                />
                <Input
                  placeholder="https://..."
                  value={link.url}
                  onChange={(e) => setLinks((prev) => prev.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                  disabled={!isOwner || saving}
                  className="md:col-span-3"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={!isOwner || saving}
                >Remove</Button>
              </div>
            ))}
            {links.length < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}
                disabled={!isOwner || saving}
                className="w-fit"
              >Add link</Button>
            )}
            <p className="text-xs text-muted-foreground">Add up to 5 links. Use full URLs starting with https://</p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            placeholder="https://..."
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={!isOwner || saving}
          />
          <p className="text-xs text-muted-foreground">Paste a public image URL.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!isOwner || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Link href="/me/content">
            <Button type="button" variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </form>

      {isOwner && (
        <div className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Drafts</h2>
            <div className="text-sm text-muted-foreground">{drafts.length} saved</div>
          </div>
          {drafts.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md p-4">No drafts yet. Use the Save Draft button in the editor.</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {drafts.map((d) => {
                const text = (d.contentHtml || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
                const preview = text.slice(0, 140) + (text.length > 140 ? "…" : "");
                const ts: any = d.updatedAt || d.createdAt;
                const when = ts?.toDate ? ts.toDate().toLocaleString() : "";
                return (
                  <li key={d.id} className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{preview || "(empty draft)"}</div>
                      <div className="text-xs text-muted-foreground">{when}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem("draft", d.contentHtml || "");
                            }
                          } catch {}
                          router.push("/ask");
                        }}
                      >Resume in Ask</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          try {
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem("draft", d.contentHtml || "");
                            }
                          } catch {}
                          router.push("/new-post");
                        }}
                      >Resume in Post</Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={async () => {
                          if (!currentAuthUser?.uid) return;
                          if (!confirm("Delete this draft?")) return;
                          await deleteDoc(doc(db, "users", currentAuthUser.uid, "drafts", d.id));
                        }}
                        aria-label="Delete draft"
                      >
                        <Icons.Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
