"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

import { checkForSpam, getSuggestedTags } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import slugify from "slugify";
import { notifyMentions, notifyFollowersAndFollowingOfActivity } from "@/lib/notifications";
import { awardPostBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";

import dynamic from "next/dynamic";

function EditorSkeleton() {
  return (
    <div className="mt-2 min-h-[200px] rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  );
}

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
import { toCategorySlug, getCategory } from "@/lib/categories";

async function uploadToImageKit(file: File, fileName: string, folder = "posts") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", fileName);
  formData.append("folder", folder);

  const res = await fetch("/api/imagekit/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok || !data?.url || !data?.fileId) {
    throw new Error(data?.error || "Image upload failed");
  }
  return data;
}

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  content: z.string().min(100, "Content must be at least 100 characters."),
  tags: z.string().min(3, "Please add tags."),
});

export function NewPostForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [aiTags, setAiTags] = useState<string[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const toast = useToast().toast;
  const router = useRouter();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", content: "", tags: "" },
  });

  useEffect(() => {
    form.setValue("content", content, { shouldValidate: true });
  }, [content, form]);

  async function handleSuggestTags() {
    const title = form.getValues("title");
    const body = form.getValues("content");
    if (!title || !body) {
      toast({ title: "Add title and content first", description: "We need some text to suggest tags." });
      return;
    }
    setIsSuggesting(true);
    try {
      const res = await getSuggestedTags({ text: `${title}\n\n${body}`, kind: 'post', maxTags: 6 });
      if (res.error) {
        toast({ variant: 'destructive', title: 'Tag suggestion failed', description: res.error });
        setAiTags(null);
      } else {
        setAiTags(res.tags || []);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Tag suggestion failed', description: e?.message || 'Unknown error' });
      setAiTags(null);
    } finally {
      setIsSuggesting(false);
    }
  }

  function applySuggestedTags() {
    if (!aiTags || aiTags.length === 0) return;
    const existing = form.getValues('tags') || '';
    const existingList = existing.split(',').map(t => t.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existingList, ...aiTags]));
    form.setValue('tags', merged.join(', '), { shouldValidate: true, shouldDirty: true });
    toast({ title: 'Tags applied', description: 'Suggested tags added. You can edit them.' });
  }

  async function onSubmit(data: z.infer<typeof schema>) {
    setIsLoading(true);

    try {
      const spamCheck = await checkForSpam(`${data.title}\n\n${data.content}`);
      if (spamCheck.isSpam) {
        toast({ variant: "destructive", title: "Spam Detected", description: `Reason: ${spamCheck.reason}` });
        setIsLoading(false);
        return;
      }

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in");

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      if (!userData) throw new Error("User not found");
      if (userData?.blocked) {
        toast({ variant: "destructive", title: "Account blocked", description: "You cannot create posts at this time." });
        setIsLoading(false);
        return;
      }

      const slug = `${slugify(data.title, { lower: true, strict: true })}-${Date.now()}`;

      let imageUrl = "";
      let imageId = "";

      if (imageFile) {
        const uploadResult = await uploadToImageKit(imageFile, `post-${Date.now()}`);
        imageUrl = uploadResult.url;
        imageId = uploadResult.fileId;
      }

      const firstTag = (data.tags.split(",").map((t) => t.trim()).find(Boolean) || '').toLowerCase();
      const category = getCategory(toCategorySlug(firstTag))?.slug || toCategorySlug(firstTag);

      const postPayload = {
        title: data.title,
        content: data.content,
        tags: data.tags.split(",").map((t) => t.trim()),
        category,
        createdAt: new Date(),
        uid: user.uid,
        username: userData.username || user.displayName || user.email?.split('@')[0] || "unknown",
        author: {
          id: user.uid,
          uid: user.uid,
          username: userData.username || user.displayName || user.email?.split('@')[0] || "unknown",
          avatarUrl: userData.avatarUrl || user.photoURL || "",
        },
        image: imageUrl || null,
        imageFileId: imageId || null,
        slug,
      };

  await addDoc(collection(db, "posts"), postPayload);
      await addDoc(collection(db, "users", user.uid, "posts"), postPayload);
  const nextPosts = (userData.stats?.posts || 0) + 1;
  await updateDoc(userRef, { "stats.posts": increment(1) });
  await awardPostBadges({ userRef, currentBadges: userData.badges || [], nextPostCount: nextPosts });
  await recomputeVerificationFromSnapshot(userRef);

  // Notify mentions in title/content
  const from = { uid: user.uid, username: userData.username || user.displayName || undefined, avatarUrl: userData.avatarUrl || user.photoURL || undefined };
  const url = `/blog/${slug}`;
  await notifyMentions({ from, text: `${data.title}\n\n${data.content}`, title: data.title, url });

  // Notify followers and following about new post
  try {
    await notifyFollowersAndFollowingOfActivity({
      authorUid: user.uid,
      authorUsername: userData.username || user.displayName || undefined,
      authorAvatarUrl: userData.avatarUrl || user.photoURL || undefined,
      title: data.title,
      url,
      kind: 'post',
    });
  } catch (e) {
    console.warn('follower notifications (post) failed', e);
  }

      toast({ title: "Post published", description: "Your post has been successfully published." });

      setImageFile(null);
      setContent("");
      form.reset();
  router.push(`/blog/${slug}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 shadow-md ring-1 ring-black/5 backdrop-blur">
        <div className="p-4 md:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Title</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        placeholder="Untitled"
                        disabled={isLoading}
                        className="w-full bg-transparent outline-none border-0 text-2xl md:text-3xl font-semibold tracking-tight placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={() => (
                  <FormItem>
                    <FormLabel className="sr-only">Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={content}
                        onChange={setContent}
                        readOnly={isLoading}
                        placeholder="Write your post…"
                        variant="simple"
                        className="mt-0"
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.content?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Tags</FormLabel>
                    <FormControl>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input {...field} placeholder="Add tags (comma separated)" disabled={isLoading} />
                        <Button type="button" variant="secondary" onClick={handleSuggestTags} disabled={isLoading || isSuggesting} className="sm:w-auto">
                          {isSuggesting ? 'Suggesting…' : 'Suggest tags'}
                        </Button>
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">First tag becomes the category automatically.</p>
                    {aiTags && aiTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        {aiTags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              const curr = (form.getValues('tags') || '').split(',').map(s => s.trim()).filter(Boolean);
                              if (!curr.includes(t)) {
                                const merged = [...curr, t].join(', ');
                                form.setValue('tags', merged, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200"
                          >
                            {t}
                          </button>
                        ))}
                        <Button type="button" size="sm" variant="outline" onClick={applySuggestedTags}>Apply all</Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel className="sr-only">Cover Image</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={isLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImageFile(file);
                      }}
                    />
                    {imageFile && (
                      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                        <img src={URL.createObjectURL(imageFile)} alt="Cover preview" className="w-full max-h-56 object-cover" />
                      </div>
                    )}
                  </div>
                </FormControl>
              </FormItem>

            <div className="h-16" />
            {/* Sticky footer bar */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto z-40">
              <div className="mx-auto max-w-4xl rounded-full bg-white/95 dark:bg-gray-900/95 shadow-lg ring-1 ring-black/10 backdrop-blur px-3 py-2 flex items-center justify-end gap-2">
                <Button type="submit" disabled={isLoading} className="px-5">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publish
                </Button>
              </div>
            </div>
          </form>
        </Form>
        </div>
      </div>
    </div>
  );
}
