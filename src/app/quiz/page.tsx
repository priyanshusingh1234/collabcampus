"use client";

import { useEffect, useMemo, useState } from 'react';
import { getRecentQuizzes, type Quiz } from '@/lib/quiz';
import { QButton as Button, QInput as Input } from '@/components/quiz/ui';
import Link from 'next/link';
import {
  Search,
  User2,
  House,
  Palette,
  Star,
  Globe2,
  Landmark,
  Languages,
  Leaf,
  Dumbbell,
  HelpCircle,
  Sparkles,
  Plus,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'Start', icon: House, color: 'from-blue-500 to-cyan-500' },
  { key: 'Art & Literature', label: 'Art & Lit', icon: Palette, color: 'from-pink-500 to-rose-500' },
  { key: 'Entertainment', label: 'Entertainment', icon: Star, color: 'from-amber-500 to-orange-500' },
  { key: 'Geography', label: 'Geography', icon: Globe2, color: 'from-emerald-500 to-teal-500' },
  { key: 'History', label: 'History', icon: Landmark, color: 'from-amber-800 to-amber-600' },
  { key: 'Languages', label: 'Languages', icon: Languages, color: 'from-indigo-500 to-purple-500' },
  { key: 'Science & Nature', label: 'Science', icon: Leaf, color: 'from-green-500 to-emerald-500' },
  { key: 'Sports', label: 'Sports', icon: Dumbbell, color: 'from-red-500 to-orange-500' },
  { key: 'Trivia', label: 'Trivia', icon: HelpCircle, color: 'from-purple-500 to-pink-500' },
] as const;

function QuizCard({ q }: { q: Quiz }) {
  const category =
    CATEGORIES.find((cat) => q.category === cat.key) ||
    CATEGORIES.find((cat) => q.title.includes(cat.label) || (q.description || '').includes(cat.label)) ||
    CATEGORIES[8];
  
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 hover:-translate-y-1">
      <div className="h-36 w-full relative overflow-hidden">
        {q.bannerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.bannerImageUrl} alt="Quiz banner" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-90`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <category.icon className="h-12 w-12 text-white opacity-80" />
            </div>
          </>
        )}
        <div className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
          <span className="text-xs font-medium text-white">{q.questions?.length || 0} Qs</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="font-semibold text-slate-800 line-clamp-1 group-hover:text-slate-900">{q.title}</div>
        {q.description ? (
          <div className="text-sm text-slate-600 line-clamp-2">{q.description}</div>
        ) : null}
        <div className="pt-2">
          <Link href={`/quiz/play/${q.id}`}>
            <Button size="sm" className="w-full bg-slate-800 hover:bg-slate-900">
              Play Now <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuizCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="h-36 w-full bg-slate-100 animate-pulse"></div>
      <div className="p-4 space-y-3">
        <div className="h-5 bg-slate-100 rounded animate-pulse"></div>
        <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
        <div className="h-9 bg-slate-100 rounded animate-pulse mt-2"></div>
      </div>
    </div>
  );
}

export default function QuizHomePage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Quiz[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('all');

  useEffect(() => {
    (async () => {
      try {
        const qs = await getRecentQuizzes(30);
        setList(qs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((q) => {
      const matchesSearch = term
        ? q.title.toLowerCase().includes(term) || (q.description || '').toLowerCase().includes(term)
        : true;
      const matchesCat =
        category === 'all'
          ? true
          : q.category
            ? q.category === category
            : (q.title + ' ' + (q.description || '')).toLowerCase().includes(String(category).toLowerCase());
      return matchesSearch && matchesCat;
    });
  }, [list, search, category]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="container max-w-6xl space-y-8">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">QuizMaster</h1>
              <p className="text-indigo-100 mt-1">Test your knowledge with fun quizzes</p>
            </div>
          </div>
        </div>

        {/* Categories row */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Categories</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {CATEGORIES.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key as string}
                className={`flex flex-col items-center rounded-xl p-3 text-xs transition-all duration-200 ${
                  category === key 
                    ? `bg-gradient-to-b ${color} text-white shadow-md` 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setCategory(key)}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hero CTAs */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-6 text-white shadow-lg overflow-hidden relative">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-white/5"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Plus className="h-6 w-6" />
                <h2 className="text-xl font-bold">Create a Quiz</h2>
              </div>
              <p className="text-emerald-100 mb-5">Design your own custom quiz with our easy-to-use editor</p>
              <Link href="/quiz/create">
                <Button className="bg-teal-700 hover:bg-teal-800 text-white font-medium">
                  Quiz Editor
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white shadow-lg overflow-hidden relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-white/5"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-6 w-6" />
                <h2 className="text-xl font-bold">AI Quiz Generator</h2>
              </div>
              <p className="text-violet-100 mb-5">Generate engaging quizzes instantly on any topic with AI</p>
              <Link href="/quiz/generator">
                <Button className="bg-violet-700 hover:bg-violet-800 text-white font-medium">
                  Generate Quiz
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <Search className="h-5 w-5 text-slate-400" />
            <Input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search quizzes by title or description..." 
              className="flex-1 border-slate-200 focus:border-purple-300"
            />
          </div>
        </div>

        {/* Recently published */}
        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-semibold text-slate-800">Recently Published</h2>
            {filtered.length > 0 && (
              <span className="text-sm text-slate-500">{filtered.length} quizzes</span>
            )}
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <QuizCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-slate-400 mb-2">No quizzes found</div>
              <p className="text-sm text-slate-500 mb-4">
                {search || category !== 'all' 
                  ? 'Try changing your search or category filters' 
                  : 'Be the first to create a quiz!'
                }
              </p>
              <Link href="/quiz/create">
                <Button>Create Quiz</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.slice(0, 10).map((q) => (
                <QuizCard key={q.id} q={q} />
              ))}
            </div>
          )}
        </section>

        {/* Popular/AI created */}
        {!loading && filtered.length > 10 && (
          <section className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold text-slate-800">Trending Quizzes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.slice(10, 20).map((q) => (
                <QuizCard key={q.id} q={q} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}