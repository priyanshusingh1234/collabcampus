'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  auth,
  db,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToastProvider, Toast, ToastTitle, ToastDescription, ToastClose } from "@/components/ui/toast";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [toasts, setToasts] = useState<{id: string, title: string, description: string, variant: 'default' | 'destructive'}[]>([]);

  const router = useRouter();

  function showToast(title: string, description: string, variant: 'default' | 'destructive' = 'default') {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }


  function sanitizeUsername(v: string): string {
    return (v || "").trim().toLowerCase();
  }

  async function handleNewUserSetup(uid: string) {
    setLoading(true);
    try {
      const uname = sanitizeUsername(username);
      if (!uname) {
        showToast("Invalid username", "Username is required.", "destructive");
        return;
      }
      if (/\s/.test(uname)) {
        showToast("Invalid username", "Username cannot contain spaces.", "destructive");
        return;
      }
      await setDoc(doc(db, "users", uid), {
        uid,
        username: uname,
        usernameLower: uname,
        email,
        avatarUrl: "",
        bio: "",
        links: [],
        stats: { posts: 0, followers: 0, following: 0 },
        badges: [],
        followers: [],
        following: [],
        createdAt: new Date(),
      });
      router.push(`/profile/${encodeURIComponent(uname)}`);
    } catch (error) {
      console.error("Error setting up user:", error);
      showToast("Error", "There was a problem setting up your account.", "destructive");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithEmail() {
    setEmailLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setNeedsUsername(true);
      } else {
        const data = userDocSnap.data() as any;
        const uname = (data?.username || data?.usernameLower || "").toString();
        if (!uname) {
          setNeedsUsername(true);
        } else {
          router.push(`/profile/${encodeURIComponent(uname)}`);
        }
      }
    } catch (err) {
      console.error("Email Sign-in error:", err);
      showToast("Error", "Invalid email or password.", "destructive");
    } finally {
      setEmailLoading(false);
    }
  }

  if (needsUsername) {
    return (
      <ToastProvider>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleNewUserSetup(auth.currentUser?.uid || "")}
                  disabled={!username.trim() || /\s/.test(username) || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {toasts.map((toast) => (
            <Toast key={toast.id} variant={toast.variant}>
              <div className="grid gap-1">
                <ToastTitle>{toast.title}</ToastTitle>
                <ToastDescription>{toast.description}</ToastDescription>
              </div>
              <ToastClose>
                <X className="h-4 w-4" />
              </ToastClose>
            </Toast>
          ))}
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to CollabCampus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Email Sign-in */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={emailLoading}
                />
              </div>
              <div className="flex justify-end">
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button
                className="w-full"
                onClick={signInWithEmail}
                disabled={emailLoading || !email || !password}
              >
                {emailLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>

              <div className="text-center text-sm">
                Don't have an account?{" "}
                <Link href="/auth/sign-up" className="text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

  {/* Password Reset moved to dedicated route */}

        {/* Toast Notifications */}
        {toasts.map((toast) => (
          <Toast key={toast.id} variant={toast.variant}>
            <div className="grid gap-1">
              <ToastTitle>{toast.title}</ToastTitle>
              <ToastDescription>{toast.description}</ToastDescription>
            </div>
            <ToastClose>
              <X className="h-4 w-4" />
            </ToastClose>
          </Toast>
        ))}
      </div>
    </ToastProvider>
  );
}