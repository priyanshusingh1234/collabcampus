"use client";

import { useEffect, useMemo, useState } from 'react';
import { getQuiz, type Quiz, type QuizQuestion, saveAttempt, getTopAttempts } from '@/lib/quiz';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  Award, 
  BarChart3,
  User,
  Clock,
  Sparkles
} from 'lucide-react';

export default function PlayQuizPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [top, setTop] = useState<Array<{ id: string; uid: string; username?: string; score: number; total: number }>>([]);
  const [timeStarted] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  // Share to group state
  const [shareOpen, setShareOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [shareNote, setShareNote] = useState<string>('');
  const [shareSending, setShareSending] = useState(false);

  // Timer effect
  useEffect(() => {
    if (done || !quiz) return;
    
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - timeStarted) / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [done, quiz, timeStarted]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const q = await getQuiz(String(id));
        setQuiz(q);
        setAnswers(new Array(q?.questions?.length || 0).fill(-1));
      } catch (error) {
        console.error("Failed to load quiz:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Load user groups when opening the share dialog
  useEffect(() => {
    (async () => {
      if (!shareOpen || !user?.uid) return;
      try {
        const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, name: String((d.data() as any)?.name || 'Unnamed Group') }));
        setMyGroups(list);
        if (list.length && !selectedGroupId) setSelectedGroupId(list[0].id);
      } catch (e) {
        console.error('Failed to load groups:', e);
        toast.error('Could not load your groups');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOpen, user?.uid]);

  const score = useMemo(() => {
    if (!quiz) return 0;
    return answers.reduce((acc, a, i) => acc + (a === quiz.questions[i]?.answerIndex ? 1 : 0), 0);
  }, [answers, quiz]);

  useEffect(() => {
    (async () => {
      if (!id || !done) return;
      const t = await getTopAttempts(String(id), 5);
      setTop(t as any);
    })();
  }, [id, done]);

  // Derive current question and render options in a stable hook order
  const q: QuizQuestion | null = useMemo(() => (quiz?.questions?.[idx] as QuizQuestion) || null, [quiz, idx]);
  type Option = { label: string; origIndex: number | null };
  const options = useMemo<Option[]>(() => {
    if (!q) return [];
    const base: Option[] = q.choices.map((label, i) => ({ label, origIndex: i }));
    if (q.allowOther) base.push({ label: 'Other…', origIndex: null });
    if (q.shuffle) {
      // Don't shuffle the "Other" option if present
      const choicesToShuffle = q.allowOther ? base.slice(0, -1) : base;
      const otherOption = q.allowOther ? base[base.length - 1] : null;
      
      for (let i = choicesToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choicesToShuffle[i], choicesToShuffle[j]] = [choicesToShuffle[j], choicesToShuffle[i]];
      }
      
      return otherOption ? [...choicesToShuffle, otherOption] : choicesToShuffle;
    }
    return base;
  }, [q]);

  const chosenOrig = answers[idx];

  const progress = ((idx) / (quiz?.questions.length || 1)) * 100;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  async function shareToGroup() {
    if (!user) { toast.error('Sign in to share'); return; }
    if (!selectedGroupId) { toast.error('Pick a group'); return; }
    if (!quiz?.id) { toast.error('Quiz not loaded'); return; }
    try {
      setShareSending(true);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}/quiz/play/${quiz.id}`;
      const textBase = `Shared a quiz: ${quiz.title}\n${link}`;
      const text = shareNote.trim() ? `${textBase}\n\n${shareNote.trim()}` : textBase;
      await addDoc(collection(db, 'groups', selectedGroupId, 'messages'), {
        text,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        kind: 'shared_quiz',
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description || '',
          bannerImageUrl: (quiz as any).bannerImageUrl || '',
        },
      } as any);
      toast.success('Shared to group');
      setShareOpen(false);
      setShareNote('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to share');
    } finally {
      setShareSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-2xl shadow-sm max-w-md">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Quiz Not Found</h1>
          <p className="text-slate-600 mb-4">The quiz you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => window.location.href = '/quiz'}>Back to Quizzes</Button>
        </div>
      </div>
    );
  }

  if (done) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    let resultColor = "text-red-600";
    let resultMessage = "Keep practicing!";
    
    if (percentage >= 80) {
      resultColor = "text-green-600";
      resultMessage = "Excellent work!";
    } else if (percentage >= 60) {
      resultColor = "text-amber-600";
      resultMessage = "Good effort!";
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
        <div className="container max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white text-center">
              <h1 className="text-2xl font-bold mb-2">{quiz.title}</h1>
              <p className="opacity-90">{quiz.description}</p>
            </div>
            
            {/* Score Summary */}
            <div className="p-6 border-b border-slate-200">
              <div className="text-center mb-6">
                <div className="text-sm text-slate-500 mb-2">Your score</div>
                <div className={`text-5xl font-bold ${resultColor} mb-2`}>{score} / {quiz.questions.length}</div>
                <div className="text-lg font-medium mb-4">{resultMessage}</div>
                
                <div className="flex justify-center items-center gap-6 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Time: {formatTime(timeElapsed)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>{percentage}% correct</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
            
            {/* Questions Review */}
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Question Review
              </h2>
              
              <div className="space-y-4">
                {quiz.questions.map((question, i) => {
                  const isCorrect = answers[i] === question.answerIndex;
                  const userAnswer = answers[i] === -1 
                    ? '—' 
                    : answers[i] === -2 
                      ? 'Other…' 
                      : (question.choices[answers[i]] ?? '—');
                  
                  return (
                    <div key={i} className={`border rounded-xl p-4 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-3 mb-3">
                        {isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">Q{i + 1}. {question.text}</div>
                          <div className="text-sm mt-2">
                            <span className="font-medium">Your answer: </span>
                            <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>{userAnswer}</span>
                          </div>
                          {!isCorrect && (
                            <div className="text-sm mt-1">
                              <span className="font-medium">Correct answer: </span>
                              <span className="text-green-700">{question.choices[question.answerIndex]}</span>
                            </div>
                          )}
                          {question.explanation && (
                            <div className="text-xs text-slate-600 mt-2 p-2 bg-white rounded-md">
                              <span className="font-medium">Explanation: </span>
                              {question.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Leaderboard */}
            <div className="p-6 bg-slate-50 rounded-b-2xl">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Performers
              </h2>
              
              {top.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <Award className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                  <p>No attempts yet. Be the first to set a high score!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {top.map((r, index) => {
                    const isCurrentUser = user && r.uid === user.uid;
                    return (
                      <div 
                        key={r.id} 
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isCurrentUser 
                            ? 'bg-purple-100 border border-purple-300' 
                            : 'bg-white border border-slate-200'
                        } ${index === 0 ? 'shadow-sm' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-amber-500 text-white' : 
                            index === 1 ? 'bg-slate-400 text-white' : 
                            index === 2 ? 'bg-amber-800 text-white' : 
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {r.username || (r.uid.slice(0, 8) + '...')}
                              {isCurrentUser && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              {Math.round((r.score / r.total) * 100)}% correct
                            </div>
                          </div>
                        </div>
                        <div className="font-semibold">
                          {r.score}<span className="text-slate-400">/</span>{r.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
                <Button onClick={() => window.location.href = '/quiz'}>
                  Back to Quizzes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="container max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-slate-600 text-sm mt-1">{quiz.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Share to group</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share quiz to a group</DialogTitle>
                    <DialogDescription>Select a group and optionally add a note. A link to this quiz will be posted in the group chat.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {myGroups.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        You’re not a member of any groups yet. <a className="underline" href="/groups">Browse groups</a>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm mb-1">Choose group</div>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                        >
                          {myGroups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <div className="text-sm mb-1">Note (optional)</div>
                      <Input placeholder="Add a short message" value={shareNote} onChange={(e) => setShareNote(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
                    <Button onClick={shareToGroup} disabled={!myGroups.length || !selectedGroupId || shareSending}>
                      {shareSending ? 'Sharing…' : 'Share'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="flex items-center gap-1 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeElapsed)}</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                <span>{idx + 1} / {quiz.questions.length}</span>
              </div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
        
        {/* Question Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <div className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
              Question {idx + 1} of {quiz.questions.length}
            </div>
          </div>
          
          <h2 className="text-lg font-medium text-slate-800 mb-6">{q?.text}</h2>
          
          <div className="space-y-3">
            {options.map((opt, i) => {
              const isSelected = opt.origIndex === null 
                ? chosenOrig === -2 
                : chosenOrig === opt.origIndex;
              
              return (
                <button
                  key={i}
                  className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                  } ${checking && opt.origIndex === (q?.answerIndex ?? -999) ? 'ring-2 ring-green-500 bg-green-50 border-green-500' : ''} ${
                    checking && isSelected && opt.origIndex !== (q?.answerIndex ?? -999) ? 'ring-2 ring-red-500 bg-red-50 border-red-500 shake' : ''
                  }`}
                  onClick={() => {
                    if (checking) return;
                    setAnswers((arr) => arr.map((a, ai) => (ai === idx ? (opt.origIndex === null ? -2 : opt.origIndex) : a)));
                  }}
                  disabled={checking}
                >
                  <span className={`h-6 w-6 mt-0.5 flex items-center justify-center rounded-full border flex-shrink-0 ${
                    isSelected 
                      ? 'bg-purple-600 border-purple-600 text-white' 
                      : 'bg-white border-slate-300'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setIdx((i) => Math.max(0, i - 1))} 
            disabled={idx === 0 || checking}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            {idx < quiz.questions.length - 1 ? (
              <>
                <Button 
                  variant="secondary" 
                  onClick={async () => {
                    if (chosenOrig < 0) return;
                    setChecking(true);
                    const isCorrect = chosenOrig === (q?.answerIndex ?? -1);
                    setCorrect(isCorrect);
                    
                    // Celebration on correct answer
                    try {
                      if (isCorrect && typeof window !== 'undefined') {
                        (window as any).confettiBurst?.();
                      }
                    } catch {}
                    
                    setTimeout(() => {
                      setChecking(false);
                      setCorrect(null);
                      if (idx < quiz.questions.length - 1) {
                        setIdx((i) => i + 1);
                      }
                    }, 1500);
                  }} 
                  disabled={chosenOrig < 0 || checking}
                  className="flex items-center gap-2"
                >
                  {checking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      Check Answer
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => setIdx((i) => Math.min(quiz.questions.length - 1, i + 1))} 
                  disabled={chosenOrig < 0}
                  className="flex items-center gap-2"
                >
                  Skip
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button 
                onClick={async () => {
                  setDone(true);
                  // Save attempt if not preview and logged in
                  try {
                    if (user?.uid && id) {
                      await saveAttempt(String(id), { 
                        uid: user.uid, 
                        username: user.displayName || user.email || '', 
                        score, 
                        total: quiz.questions.length 
                      });
                    }
                  } catch (error) {
                    console.error("Failed to save attempt:", error);
                  }
                }} 
                disabled={answers.some((a) => a < 0)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                Finish Quiz
                <Trophy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Confetti script */}
      <script dangerouslySetInnerHTML={{ __html: `
        function confettiBurst(){
          try{
            const count=120; const defaults={origin:{y:0.7}};
            const fire=(p)=>{ if(window.confetti) window.confetti(Object.assign({},defaults,p)); };
            fire({ particleCount: 40, spread: 26, startVelocity: 55 });
            fire({ particleCount: 20, spread: 60 });
            fire({ particleCount: 50, spread: 100, decay: 0.91, scalar: 0.8 });
            fire({ particleCount: 40, spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
          }catch{}
        }
        window.confetti = window.confetti || null;
        window.confettiBurst = confettiBurst;
      `}} />
      
      <style jsx>{`
        .shake { animation: shake 0.4s ease-in-out; }
        @keyframes shake { 
          0% { transform: translateX(0); } 
          25% { transform: translateX(-4px); } 
          50% { transform: translateX(4px); } 
          75% { transform: translateX(-4px); } 
          100% { transform: translateX(0); } 
        }
      `}</style>
    </div>
  );
}