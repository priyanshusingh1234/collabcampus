"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function PremiumBadge({ className, compact = false, href }: { className?: string; compact?: boolean; href?: string }) {
  const El: any = href ? Link : 'span';
  const props: any = href ? { href } : {};
  return (
    <El
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        "bg-amber-50 text-amber-800 border-amber-200",
        href && "hover:bg-amber-100",
        className
      )}
      title="Premium member"
    >
      <Star className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} fill="rgb(245 158 11)" color="rgb(217 119 6)" />
      {!compact && <span>Premium</span>}
    </El>
  );
}

export function RankChip({ rank, className }: { rank?: number | null; className?: string }) {
  if (!rank || rank < 1) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 text-[11px]",
        className
      )}
      title={`Leaderboard rank #${rank}`}
    >
      #{rank}
    </span>
  );
}
