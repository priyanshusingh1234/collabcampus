"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  HomeIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
  NewspaperIcon,
} from "@heroicons/react/24/solid";

export default function MobileNav() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsSignedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-700 z-50 shadow-lg">
      <div className="flex justify-around items-center p-2">
        <NavItem href="/" label="Home" Icon={HomeIcon} pathname={pathname} />
        <NavItem href="/questions" label="Questions" Icon={PencilSquareIcon} pathname={pathname} />
        <NavItem href="/ask" label="Ask" Icon={PlusCircleIcon} pathname={pathname} />
        <NavItem href="/blogs" label="Blogs" Icon={NewspaperIcon} pathname={pathname} />
        {!isSignedIn ? (
          <>
            <NavItem href="/signin" label="Sign In" Icon={ArrowRightOnRectangleIcon} pathname={pathname} />
            <NavItem href="/signup" label="Sign Up" Icon={UserPlusIcon} pathname={pathname} />
          </>
        ) : null}
      </div>
    </div>
  );
}

type NavItemProps = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.ComponentProps<"svg">>;
  pathname: string;
};

function NavItem({ href, label, Icon, pathname }: NavItemProps) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex flex-col items-center text-sm ${
        isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-200"
      }`}
    >
      <Icon className={`h-6 w-6 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
      {label}
    </Link>
  );
}
