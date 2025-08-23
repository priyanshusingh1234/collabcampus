"use client";

import { useEffect, useMemo, useState } from 'react';
import { QButton as Button, QInput as Input, QTextarea as Textarea } from '@/components/quiz/ui';
import { useRouter } from 'next/navigation';
import { createQuiz, type QuizQuestion } from '@/lib/quiz';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';
import { Wand2, Sparkles, BookOpen, Settings2 } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard';

export default function QuizGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [num, setNum] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ title: string; description?: string; questions: QuizQuestion[] } | null>(null);

  const canGenerate = topic.trim().length > 2 && num >= 2 && num <= 10;

  async function handleGenerate() {
    if (!canGenerate) return;
    try {
      setLoading(true);
      setData(null);
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), numQuestions: num, difficulty, sourceText: source }),
      });
      if (!res.ok) throw new Error('Failed');
      const j = await res.json();
      const qs: QuizQuestion[] = (j.questions || []).map((q: any) => ({
        text: String(q.text || ''),
        choices: (q.choices || []).slice(0, 6).map(String),
        answerIndex: Math.max(0, Math.min((q.choices || []).length - 1, Number(q.answerIndex ?? 0))),
        explanation: q.explanation ? String(q.explanation) : undefined,
        required: false,
        shuffle: true,
        allowOther: false,
        allowComment: false,
        defaultChoiceIndex: null,
      })).filter((q: QuizQuestion) => q.text && q.choices.length >= 2);
      setData({ title: String(j.title || topic), description: j.description ? String(j.description) : '', questions: qs });
    } catch (e) {
      toast.error('Generator failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNow() {
    if (!user) { toast.error('Please sign in'); return; }
    if (!data || data.questions.length < 2) { toast.error('Generate a quiz first'); return; }
    try {
      const ref = await createQuiz({
        title: data.title,
        description: data.description || '',
        questions: data.questions,
        createdBy: { uid: user.uid, username: user.displayName || user.email || '' },
        visibility: 'public',
        // Generator currently doesn't set category/banner
      });
      toast.success('Quiz created');
      router.push(`/quiz/play/${ref.id}`);
    } catch {
      toast.error('Failed to save');
    }
  }

  function importToBuilder() {
    if (!data) return;
    try {
      localStorage.setItem('quiz_ai_draft', JSON.stringify(data));
    } catch {}
    router.push('/quiz/create');
  }

  const previewCount = data?.questions.length ?? 0;

  return (
    <div className="container max-w-6xl py-8">
      {/* Hero */}
      <div className="quiz-hero mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/30 backdrop-blur flex items-center justify-center shadow-sm">
            <Wand2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">AI Quiz Generator</div>
            <div className="text-white/90">Create a quiz from any topic or notes in seconds</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="soft-card p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" /> Generator settings</div>
            <Button variant="outline" onClick={() => { setTopic(''); setSource(''); setData(null); }}>Reset</Button>
          </div>
          <Input placeholder="Topic (e.g., World Capitals, JavaScript Basics)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1"># Questions</div>
              <Input type="number" min={2} max={10} value={num} onChange={(e) => setNum(Math.max(2, Math.min(10, parseInt(e.target.value || '5'))))} />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
              <div className="flex gap-2">
                {(['easy','medium','hard'] as Difficulty[]).map((d) => (
                  <button key={d} className={`soft-pill ${difficulty === d ? 'soft-pill-active' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Optional source text</div>
            <Textarea rows={6} placeholder="Paste content to base questions on (notes, article text, etc.)" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleGenerate} disabled={!canGenerate || loading}>{loading ? 'Generating…' : 'Generate quiz'} <Sparkles className="ml-2 h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => router.push('/quiz')}>Back to quizzes</Button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="soft-card p-4 md:p-5">
          {!data && !loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" /> No quiz yet — generate to preview.</div>
          ) : loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-2/3 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              {Array.from({ length: num }).map((_, i) => (
                <div className="border rounded-md p-3" key={i}>
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="mt-2 grid gap-2">
                    <div className="h-3 w-1/2 bg-muted rounded" />
                    <div className="h-3 w-2/3 bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xl font-bold">{data!.title}</div>
              {data!.description ? <div className="text-sm text-muted-foreground">{data!.description}</div> : null}
              <div className="text-xs text-muted-foreground">{previewCount} questions</div>
              <div className="space-y-3 mt-2">
                {data!.questions.map((q, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="font-medium">Q{i + 1}. {q.text}</div>
                    <ul className="mt-2 text-sm grid gap-1 list-disc pl-5">
                      {q.choices.map((c, ci) => (
                        <li key={ci} className={`${ci === q.answerIndex ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={importToBuilder}>Use in builder</Button>
                <Button variant="secondary" onClick={handleSaveNow}>Save & play</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
