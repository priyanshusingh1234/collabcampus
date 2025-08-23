"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Quiz } from '@/lib/quiz';

type Props = {
  q: Quiz;
  href?: string; // override link
};

export function QuizCard({ q, href }: Props) {
  const link = href || `/quiz/play/${q.id}`;
  return (
    <div className="group relative rounded-2xl overflow-hidden border bg-card hover:shadow-xl transition-shadow">
      <div className="h-36 w-full relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={q.bannerImageUrl || '/pexels-kobeboy-1516440.jpg'}
          alt="cover"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/0" />
      </div>
      <div className="p-3">
        <div className="font-semibold line-clamp-1">{q.title}</div>
        {q.description ? <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{q.description}</div> : null}
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{q.questions?.length || 0} questions</span>
          <Link href={link}><Button size="sm" className="h-7 px-3">Start</Button></Link>
        </div>
      </div>
    </div>
  );
}

export default QuizCard;
