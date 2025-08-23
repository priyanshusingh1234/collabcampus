"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerifiedTick } from "@/components/ui/VerifiedTick";
import { getCategory } from "@/lib/categories";
import React from "react";
import { useToast } from "@/hooks/use-toast";
import { MentionText } from "@/components/ui/MentionText";

type Author = {
  id?: string;
  username?: string;
  avatarUrl?: string;
  verified?: boolean;
};

export type QuestionCardProps = {
  id: string;
  slug: string;
  title: string;
  content?: string;
  tags?: string[];
  category?: string;
  image?: string | null;
  views?: number;
  answers?: number;
  createdAt?: string | Date | null;
  author?: Author;
  className?: string;
};

function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function timeAgo(input?: string | Date | null) {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  const yr = Math.floor(mon / 12);
  return `${yr}y ago`;
}

export function QuestionCard({
  id,
  slug,
  title,
  content,
  tags = [],
  category,
  image,
  views = 0,
  answers = 0,
  createdAt,
  author,
  className,
}: QuestionCardProps) {
  const excerpt = stripHtml(content).slice(0, 180);
  const { toast } = useToast();

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/questions/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "The question URL is in your clipboard." });
    } catch (e) {
      toast({ title: "Copy failed", description: "Could not copy the link. Please try again.", variant: "destructive" });
    }
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border bg-card hover:shadow-md transition-shadow",
        className
      )}
    >
      <div className="flex flex-col md:flex-row">
        {/* Stats rail */}
        <div className="flex md:flex-col items-center justify-start gap-4 md:gap-3 p-4 md:w-28 border-b md:border-b-0 md:border-r bg-muted/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium text-foreground">{answers}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="font-medium text-foreground">{views}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-headline text-xl font-semibold leading-snug tracking-tight line-clamp-2">
                <MentionText
                  text={title}
                  fallbackHref={`/questions/${slug}`}
                  nonMentionClassName="hover:underline"
                  // mentionClassName defaults to blue
                />
              </h2>
              {excerpt && (
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Category */}
          {category && (
            <div className="mt-3">
              <Link href={`/categories/${category}`}>
                <Badge variant="secondary" className="text-xs rounded-full border px-2.5 py-0.5">
                  {getCategory(category)?.label || category}
                </Badge>
              </Link>
            </div>
          )}

          {/* Meta */}
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <Avatar className="h-7 w-7">
              <AvatarImage src={author?.avatarUrl || ""} alt={author?.username || "User"} />
              <AvatarFallback>{author?.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5">
              <Link href={author?.username ? `/user/${author.username}` : "#"} className="text-foreground hover:underline">
                {author?.username || "Anonymous"}
              </Link>
              {author?.verified ? <VerifiedTick size={14} /> : null}
              {createdAt ? <span className="text-muted-foreground/80">• {timeAgo(createdAt)}</span> : null}
            </div>
          </div>
        </div>

        {/* Image */}
        {image ? (
          <div className="relative md:w-48 min-h-[140px] md:min-h-full border-t md:border-t-0 md:border-l overflow-hidden">
            <Image
              src={image}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 192px"
              className="object-cover md:rounded-r-md group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default QuestionCard;
