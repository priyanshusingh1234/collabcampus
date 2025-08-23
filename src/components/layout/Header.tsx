"use client";

import Link from "next/link";
import { Bookmark, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/layout/UserNav";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserSearch } from "@/components/layout/UserSearch";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import dynamic from "next/dynamic";
import Logo from "@/components/branding/Logo";

const UserSearchFullScreen = dynamic(() => import("@/components/layout/UserSearchFullScreen"), { ssr: false });

export function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: "/blogs", label: "Blogs" },
    { href: "/questions", label: "Questions" },
  { href: "/quiz", label: "Quizzes" },
    { href: "/users", label: "Users" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/new-post", label: "New Post" },
    { href: "/ask", label: "Ask Question" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container relative flex h-14 max-w-screen-2xl items-center">
        {/* Mobile: hamburger + compact brand */}
        <div className="flex items-center gap-1 md:hidden mr-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetTitle className="sr-only">Main menu</SheetTitle>
              <div className="mt-2">
                <Link href="/" className="flex items-center gap-2 px-2 py-1">
                  <Logo className="h-6 w-6" />
                  <span className="font-bold font-headline">CollabCampus</span>
                </Link>
                <nav className="mt-4 grid">
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm hover:bg-accent text-foreground/80",
                        pathname === href && "bg-accent font-semibold"
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                  {!loading && user ? (
                    <Link href="/saved" className="px-3 py-2 rounded-md text-sm hover:bg-accent text-foreground/80">
                      Saved
                    </Link>
                  ) : null}
                  <Link href="/pricing" className="mt-2 px-3 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-600/90">
                    Premium
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-1">
            <Logo className="h-6 w-6" />
            <span className="sr-only">CollabCampus</span>
          </Link>
        </div>

        {/* Desktop: brand + main nav */}
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block font-headline">CollabCampus</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === href ? "text-foreground" : "text-foreground/60"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: search, icons, user */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* Hide full search on mobile to save space */}
          <div className="hidden md:block w-full md:w-auto md:flex-none">
            {!loading && user && <UserSearch />}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {/* Mobile search trigger */}
            {!loading && user ? (
              <div className="md:hidden">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Search">
                      <Search className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-none w-screen h-screen">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Search users</DialogTitle>
                    </DialogHeader>
                    <UserSearchFullScreen />
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}

            {/* Hide non-essential icons on smallest screens to reduce clutter */}
            <div className="hidden sm:flex items-center gap-1">
              <NotificationsBell />
              {!loading && user ? (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  aria-label="Saved posts"
                  title="Saved posts"
                >
                  <Link href="/saved">
                    <Bookmark className="h-5 w-5" />
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" asChild className="ml-1">
                <Link href="/pricing">Premium</Link>
              </Button>
            </div>

            {/* Desktop avatar inline */}
            <div className="pl-1 hidden md:block">
              <UserNav />
            </div>
          </div>
        </div>

        {/* Mobile: Avatar pinned to far right corner */}
        <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
