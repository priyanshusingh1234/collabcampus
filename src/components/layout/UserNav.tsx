"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, User as UserIcon, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";

export function UserNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;
      const db = getFirestore();
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAvatarUrl(data.avatarUrl || null);
        setUsername(data.username || null);
      }
    };

    if (user) fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />;
  }

  return (
    <div>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={avatarUrl || undefined}
                  alt={user.displayName || "User"}
                />
                <AvatarFallback>
                  {user.displayName
                    ? user.displayName.charAt(0).toUpperCase()
                    : <UserIcon />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.displayName || username || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (username) {
                  router.push(`/profile/${username}`);
                } else {
                  // Fallback: maybe show error or fallback to user's uid
                  window.alert("Username not set. Please complete your profile.");
                  // router.push(`/profile/${user.uid}`);
                }
              }}
              className="cursor-pointer"
            >
              <UserIcon className="mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/me/content')}
              className="cursor-pointer"
            >
              <LayoutDashboard className="mr-2" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/messages')}
              className="cursor-pointer"
            >
              <MessageSquare className="mr-2" />
              Messages
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href="/auth/sign-in">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/sign-up">Sign Up</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
