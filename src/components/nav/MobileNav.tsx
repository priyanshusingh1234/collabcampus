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
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-soft blur-bg border-t border-gray-200/80 dark:border-gray-700/70 shadow-lg pb-safe"
      role="navigation"
      aria-label="Primary mobile"
    >
      <ul className="flex justify-around items-end px-2 pt-1 gap-1">
        <NavItem href="/" label="Home" Icon={HomeIcon} pathname={pathname} />
  <NavItem href="/questions" label="Questions" Icon={PencilSquareIcon} pathname={pathname} />
  <NavItem href="/moments" label="Moments" Icon={NewspaperIcon} pathname={pathname} />
  <NavItem href="/blogs" label="Blogs" Icon={NewspaperIcon} pathname={pathname} />
        <li className="-mt-6">
          <NavItem
            href="/ask"
            label="Ask"
            Icon={PlusCircleIcon}
            pathname={pathname}
            emphasize
          />
        </li>
        {!isSignedIn ? (
          <>
            <NavItem href="/signin" label="Sign In" Icon={ArrowRightOnRectangleIcon} pathname={pathname} />
            <NavItem href="/signup" label="Sign Up" Icon={UserPlusIcon} pathname={pathname} />
          </>
        ) : null}
      </ul>
    </nav>
  );
}

type NavItemProps = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.ComponentProps<'svg'>>;
  pathname: string;
  emphasize?: boolean;
};

function NavItem({ href, label, Icon, pathname, emphasize }: NavItemProps) {
  const isActive = pathname === href;
  const base = emphasize
    ? 'rounded-full px-4 py-2 fab-shadow bg-blue-600 text-white dark:bg-blue-500 active:scale-95 transition'
    : 'px-2.5 py-1.5 rounded-xl';
  return (
    <li className="list-none">
      <Link
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 text-[11px] font-medium min-w-[56px] min-hit select-none ${base} ${
          !emphasize && isActive
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
            : !emphasize
              ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-800/60'
              : ''
        }`}
      >
        <Icon
          className={`h-6 w-6 ${
            emphasize
              ? 'text-white'
              : isActive
                ? 'text-blue-600 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400'
          }`}
        />
        {!emphasize && <span className="leading-none">{label}</span>}
        {emphasize && <span className="text-[12px] leading-tight -mt-0.5">{label}</span>}
      </Link>
    </li>
  );
}
