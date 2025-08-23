import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

import { getCategory, toCategorySlug } from '@/lib/categories';
// Accept a minimal blog shape to avoid strict type coupling with server-fetch shapes
type MinimalBlog = {
  id?: string;
  title?: string;
  slug?: string;
  content?: string;
  image?: string;
  imageUrl?: string;
  tags?: string[];
  category?: string;
  author?: { username?: string; avatarUrl?: string; verified?: boolean };
  createdAt?: any;
};
import { format } from 'date-fns';
import { VerifiedTick } from '@/components/ui/VerifiedTick';
import { MentionText } from '@/components/ui/MentionText';
import { Bookmark } from 'lucide-react';
import { PremiumBadge } from '@/components/ui/PremiumBadge';

interface BlogCardProps { blog: MinimalBlog }

export function BlogCard({ blog }: BlogCardProps) {
  const blogImage = (blog as any).image || blog.imageUrl || 'https://placehold.co/600x338.png';
  const fallbackSlug = typeof blog.id === 'string' ? blog.id : '';
  const blogUrl = `/blog/${blog.slug || fallbackSlug}`;
  const authorUsername = (blog as any)?.author?.username || (blog as any)?.username || 'Unknown';
  const authorAvatar = (blog as any)?.author?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${authorUsername}`;
  const userProfileUrl = `/user/${authorUsername || 'unknown'}`;
  const slugForSave = blog.slug || fallbackSlug;

  // Strip unsafe tags if needed (basic sanitization)
  const sanitize = (html: string) => {
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  };

  const rawHTML = blog.content ? sanitize(blog.content.slice(0, 200)) + '...' : 'No content available';

  // Estimated reading time (like Medium)
  const readingMinutes = useMemo(() => {
    const text = (blog.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    return Math.max(1, Math.round(words / 200));
  }, [blog.content]);

  // Local save/unsave (shares storage format with post page)
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('savedPosts');
      if (!raw) return setIsSaved(false);
      const arr = JSON.parse(raw) as Array<{ slug: string }>;
      setIsSaved(arr.some((x) => x.slug === slugForSave));
    } catch {}
  }, [slugForSave]);

  function toggleSave() {
    try {
      const raw = localStorage.getItem('savedPosts');
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((x) => x.slug === slugForSave);
      if (idx >= 0) {
        arr.splice(idx, 1);
        setIsSaved(false);
      } else {
        arr.unshift({
          slug: slugForSave,
          title: blog?.title,
          username: blog?.author?.username,
          image: (blog as any).image || blog.imageUrl || null,
          savedAt: Date.now(),
        });
        setIsSaved(true);
      }
      localStorage.setItem('savedPosts', JSON.stringify(arr.slice(0, 200)));
    } catch {}
  }

  // Derive category if missing from the first tag
  const tagsArr = Array.isArray(blog.tags) ? blog.tags : [];
  const firstTag = (tagsArr[0] || '').toString().toLowerCase();
  const categorySlug = blog.category || (firstTag ? toCategorySlug(firstTag) : undefined);

  return (
    <Card className="group relative flex flex-col overflow-hidden h-full rounded-xl border bg-card text-card-foreground transition-shadow hover:shadow-md">
        <Link href={blogUrl} className="block">
          <div className="relative w-full aspect-[16/9] overflow-hidden rounded-t-xl bg-muted/30">
            {(() => {
              let isImageKit = false;
              try {
                const h = new URL(blogImage).hostname;
                isImageKit = h === 'ik.imagekit.io';
              } catch {}
              return (
                <Image
                  src={blogImage}
                  alt={blog.title || 'Blog image'}
                  fill
                  sizes="(min-width: 640px) 600px, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  priority={false}
                  unoptimized={isImageKit}
                />
              );
            })()}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); toggleSave(); }}
              className={`absolute top-2 right-2 inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur bg-white/80 text-gray-800 hover:bg-white shadow ${isSaved ? 'border-amber-300' : 'border-transparent'}`}
              aria-label={isSaved ? 'Unsave' : 'Save for later'}
              title={isSaved ? 'Remove from saved' : 'Save for later'}
            >
              <Bookmark className="w-3.5 h-3.5 mr-1" fill={isSaved ? 'rgb(245 158 11)' : 'none'} color={isSaved ? 'rgb(217 119 6)' : 'currentColor'} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </Link>

      <CardHeader className="pb-3">
        <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
          {categorySlug && (
            <Link href={`/categories/${categorySlug}`}>
              <Badge variant="secondary" className="rounded-full border px-2.5 py-0.5 text-xs">
                {getCategory(categorySlug)?.label || categorySlug}
              </Badge>
            </Link>
          )}
        </div>
        <CardTitle className="font-headline text-lg sm:text-xl leading-snug tracking-tight line-clamp-2">
          <MentionText
            text={blog.title || ''}
            fallbackHref={blogUrl}
            nonMentionClassName="hover:underline"
            // mentionClassName defaults to blue
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-grow">
        <div
          className="text-muted-foreground line-clamp-3 text-sm"
          dangerouslySetInnerHTML={{ __html: rawHTML }}
        />
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-3 w-full">
          <Link href={userProfileUrl} className="shrink-0">
            <Avatar className="h-9 w-9 overflow-hidden">
              <img src={authorAvatar || ''} alt={authorUsername || 'User'} className="h-full w-full object-cover" />
              <AvatarFallback>
                {authorUsername?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 text-sm">
              <Link href={userProfileUrl} className="font-medium hover:underline truncate">
                {authorUsername}
              </Link>
              {(blog.author as any)?.verified && <VerifiedTick size={14} />}
              {(blog.author as any)?.isPremium && <PremiumBadge className="ml-1" compact href="/pricing" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {blog.createdAt ? format((blog.createdAt as any)?.toDate?.() || (blog.createdAt as any), 'MMM d, yyyy') : ''}
              {readingMinutes ? ` • ${readingMinutes} min read` : ''}
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
