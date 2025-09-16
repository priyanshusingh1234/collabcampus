"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

import {
  getFirestore,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";

import { SocialSignInButtons } from "./SocialSignInButtons";

const formSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters." })
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => !/\s/.test(v), { message: "Username cannot contain spaces." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

export function SignUpForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  // Removed global auth redirect here to allow explicit routing after signup

  function sanitizeUsername(input?: string | null, fallback?: string): string {
    const base = (input || "").trim().toLowerCase();
    if (base && !/\s/.test(base)) return base;
    const fb = (fallback || "").trim().toLowerCase().replace(/\s+/g, "");
    return fb || "user";
  }

  async function storeUserInFirestore(user: any, username?: string): Promise<string> {
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      // enforce lowercase, no spaces; fallback to email local-part
      const uname = sanitizeUsername(username ?? user.displayName, user.email?.split("@")[0]);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        username: uname,
        usernameLower: uname.toLowerCase(),
        avatarUrl: user.photoURL ?? "",
        bio: "",
        links: [],
        stats: { posts: 0, followers: 0, following: 0 },
        badges: [],
        followers: [],
        following: [],
      });
      return uname;
    }
    const data = existing.data() as any;
    const unameExisting = (data?.username || data?.usernameLower || user.displayName || "").toString();
    return unameExisting;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const auth = getAuth();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

  // values.username is already trimmed+lowercased by zod transform
  await updateProfile(user, { displayName: values.username });

  // ✅ Store user in Firestore (returns final username)
  const finalUsername = await storeUserInFirestore(user, values.username);

      toast({
        title: "Account Created!",
        description: "Welcome to CollabCampus!",
      });

  // Redirect to profile edit page
  router.push(`/profile/${encodeURIComponent(finalUsername)}`);
      router.refresh();
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setIsLoading(true);
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

  // ✅ Store user in Firestore and get final username
  const finalUsername = await storeUserInFirestore(user);

      toast({
        title: "Signed in with Google",
        description: `Welcome, ${user.displayName}`,
      });

  router.push(`/profile/${encodeURIComponent(finalUsername)}`);
      router.refresh();
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast({
        variant: "destructive",
        title: "Google Sign In Failed",
        description: error.message || "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="yourusername"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@example.com"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
      </Form>

      {/* Google Sign-in Button */}
      <div className="pt-4">
      
      </div>
    </div>
  );
}
