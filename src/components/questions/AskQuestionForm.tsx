"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import slugify from "slugify";
import type { Question } from "@/lib/types";
import { notifyMentions, notifyFollowersAndFollowingOfActivity } from "@/lib/notifications";
import { awardQuestionBadges } from "@/lib/achievements";
import { recomputeVerificationFromSnapshot } from "@/lib/verification";

import RichTextEditor from "@/components/ui/rich-text";
import { toCategorySlug, getCategory } from "@/lib/categories";

// Icons from lucide-react
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
// no custom select needed; category will be derived from first tag


const formSchema = z.object({
  title: z.string().min(15, { message: "Title must be at least 15 characters." }),
  problem: z
    .string()
    .min(30, { message: "Please describe your problem in at least 30 characters." }),
  tags: z.string().min(3, { message: "Please add at least one tag." }),
});


export function AskQuestionForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      problem: "",
  tags: "",
    },
  });

  const [problemHtml, setProblemHtml] = useState<string>("");
  useEffect(() => {
    setProblemHtml(form.getValues("problem") || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    form.setValue("problem", problemHtml, { shouldValidate: true });
  }, [problemHtml]);

  async function uploadToImageKit(file: File, fileName: string, folder = "questions") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);
    formData.append("folder", folder);

    const res = await fetch("/api/imagekit/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data?.url || !data?.fileId) {
      throw new Error(data?.error || "Image upload failed");
    }
    return data as { url: string; fileId: string };
  }

  // no editor instance to destroy

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Authentication required",
          description: "You must be logged in to post a question.",
        });
        setIsLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("User profile not found");
      const userData = userSnap.data();
      if (userData?.blocked) {
        toast({
          variant: "destructive",
          title: "Account blocked",
          description: "You cannot post questions at this time.",
        });
        setIsLoading(false);
        return;
      }

      // Generate slug
      const titleSlug = slugify(values.title, { lower: true, strict: true });
      const uniqueId = Date.now().toString(36);
      const slug = `${titleSlug}-${uniqueId}`;

      const tagArray = values.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);

  const firstTag = (values.tags.split(",").map((t) => t.trim()).find(Boolean) || '').toLowerCase();
  const detectedCategory = getCategory(toCategorySlug(firstTag))?.slug || toCategorySlug(firstTag);

  const question: Omit<Question, "id"> = {
        title: values.title.trim(),
        slug,
        content: values.problem.trim(),
        tags: tagArray,
        category: detectedCategory,
        createdAt: new Date(),
        uid: user.uid,
        author: {
          id: user.uid,
          username: userData.username || "Anonymous",
          email: user.email || "",
          avatarUrl: userData.avatarUrl || user.photoURL || "",
          bio: userData.bio || "",
          badges: userData.badges || [],
          stats: userData.stats || {},
        },
      };

      let imageUrl: string | null = null;
      let imageFileId: string | null = null;
      if (imageFile) {
        const upload = await uploadToImageKit(imageFile, `question-${Date.now()}`);
        imageUrl = upload.url;
        imageFileId = upload.fileId;
      }

      await addDoc(collection(db, "questions"), {
        ...question,
        uid: user.uid,
        author: { ...question.author, id: user.uid },
        image: imageUrl,
        imageFileId,
        createdAt: serverTimestamp(),
      });

  const nextQuestions = (userData.stats?.questions || 0) + 1;
  await updateDoc(userRef, { "stats.questions": increment(1) });
  await awardQuestionBadges({ userRef, currentBadges: userData.badges || [], nextQuestionCount: nextQuestions });
  await recomputeVerificationFromSnapshot(userRef);

      toast({
        title: "Question Posted",
        description: "Your question was submitted successfully.",
      });

      // Notify mentions from title + content
      await notifyMentions({
        from: { uid: user.uid, username: userData.username || user.displayName || undefined, avatarUrl: userData.avatarUrl || user.photoURL || undefined },
        text: `${values.title}\n\n${values.problem}`,
        title: values.title,
        url: `/questions/${slug}`,
      });

      // Notify followers and following about new question
      try {
        await notifyFollowersAndFollowingOfActivity({
          authorUid: user.uid,
          authorUsername: userData.username || user.displayName || undefined,
          authorAvatarUrl: userData.avatarUrl || user.photoURL || undefined,
          title: values.title,
          url: `/questions/${slug}`,
          kind: 'question',
        });
      } catch (e) {
        console.warn('follower notifications (question) failed', e);
      }

  form.reset();
  setProblemHtml("");
  setImageFile(null);
      router.push("/questions");
    } catch (err: any) {
      console.error("Error posting question:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: err.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Toolbar button component for reuse
  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`p-2 rounded-md border ${
        active ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700"
      } hover:bg-blue-500 hover:text-white transition`}
    >
      {children}
    </button>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
  {/* Category is auto-detected from the first tag. */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., How do I center a div?"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Be specific and imagine you're asking someone else.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="problem"
          render={() => (
            <FormItem>
              <FormLabel>Describe your problem</FormLabel>

              {/* Toolbar */}
              <FormControl>
                <RichTextEditor
                  value={problemHtml}
                  onChange={setProblemHtml}
                  readOnly={isLoading}
                  placeholder="Describe your problem clearly…"
                />
              </FormControl>

              <FormMessage />
              <FormDescription>
                Include everything someone would need to help you.
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., nextjs, react, firebase"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Add up to 5 tags, separated by commas. The first tag becomes the category automatically.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image upload */}
        <FormItem>
          <FormLabel>Image (optional)</FormLabel>
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
                <div className="border rounded-lg p-2 inline-block">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Image preview"
                    className="w-full max-h-56 object-cover rounded"
                  />
                </div>
              )}
            </div>
          </FormControl>
        </FormItem>

        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post Your Question
        </Button>
      </form>
    </Form>
  );
}
