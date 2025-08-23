"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { QButton as Button, QInput as Input, QTextarea as Textarea, QCheckbox as Checkbox } from '@/components/quiz/ui';
import { createQuiz, type QuizQuestion } from '@/lib/quiz';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Settings, 
  CheckCircle, 
  Circle,
  ArrowLeft,
  Save,
  Brain,
  Image,
  Upload,
  X
} from 'lucide-react';

export default function CreateQuizPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    { text: '', choices: ['', ''], answerIndex: 0, required: false, shuffle: false, allowOther: false, allowComment: false, defaultChoiceIndex: null },
  ]);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Category & banner state
  const [category, setCategory] = useState<string>('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>(undefined);
  const [bannerImageFileId, setBannerImageFileId] = useState<string | undefined>(undefined);
  const [bannerImageFilePath, setBannerImageFilePath] = useState<string | undefined>(undefined);
  const [bannerPreview, setBannerPreview] = useState<string | undefined>(undefined);
  
  // Import AI draft from generator page if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem('quiz_ai_draft');
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.title && Array.isArray(d?.questions) && d.questions.length >= 2) {
          setTitle((t) => t || d.title);
          setDesc((dd) => dd || d.description || '');
          setQuestions(d.questions);
          setSelectedIndex(0);
          localStorage.removeItem('quiz_ai_draft');
          toast.success("AI-generated quiz loaded!");
        }
      }
    } catch {}
  }, []);

  // Persist banner state defensively so it won't disappear on re-renders
  useEffect(() => {
    try {
      const toSave = {
        bannerImageUrl: bannerImageUrl || '',
        bannerImageFileId: bannerImageFileId || '',
        bannerImageFilePath: bannerImageFilePath || '',
        // Do NOT persist blob preview; it's ephemeral and tied to this session
      };
      const hasAny = toSave.bannerImageUrl || toSave.bannerImageFileId || toSave.bannerImageFilePath;
      if (hasAny) {
        localStorage.setItem('quiz_banner_draft', JSON.stringify(toSave));
      } else {
        localStorage.removeItem('quiz_banner_draft');
      }
    } catch {}
  }, [bannerImageUrl, bannerImageFileId, bannerImageFilePath]);

  // Restore banner state if present (only when fields are empty)
  useEffect(() => {
    if (bannerImageUrl || bannerImageFileId || bannerImageFilePath) return;
    try {
      const raw = localStorage.getItem('quiz_banner_draft');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.bannerImageUrl) setBannerImageUrl(String(d.bannerImageUrl));
      if (d?.bannerImageFileId) setBannerImageFileId(String(d.bannerImageFileId));
      if (d?.bannerImageFilePath) setBannerImageFilePath(String(d.bannerImageFilePath));
    } catch {}
  }, []);

  // Cleanup any blob preview on unmount
  useEffect(() => {
    return () => {
      try {
        if (bannerPreview && bannerPreview.startsWith('blob:')) {
          URL.revokeObjectURL(bannerPreview);
        }
      } catch {}
    };
  }, [bannerPreview]);
  
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiSource, setAiSource] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const addQuestion = () => {
    setQuestions((q) => [...q, { 
      text: '', 
      choices: ['', ''], 
      answerIndex: 0, 
      required: false, 
      shuffle: false, 
      allowOther: false, 
      allowComment: false, 
      defaultChoiceIndex: null 
    }]);
    setSelectedIndex(questions.length);
  };
  
  const removeQuestion = (i: number) => {
    if (questions.length <= 1) return;
    setQuestions((q) => q.filter((_, idx) => idx !== i));
    if (selectedIndex >= i) {
      setSelectedIndex(Math.max(0, i - 1));
    }
  };
  
  const selected = useMemo(() => questions[selectedIndex] || null, [questions, selectedIndex]);

  async function handleSave() {
    if (!user) { toast.error('Please sign in'); return; }
    if (!title.trim() || questions.some((q) => !q.text.trim() || q.choices.some((c) => !c.trim()))) {
      toast.error('Please fill in the title and all question fields');
      return;
    }
    try {
      setSaving(true);
      const docRef = await createQuiz({
        title: title.trim(),
        description: desc.trim(),
        questions,
        createdBy: { uid: user.uid, username: user.displayName || user.email || '' },
        visibility: 'public',
        category: category.trim() || undefined,
        bannerImageUrl,
        bannerImageFileId,
        bannerImageFilePath,
      });
      toast.success('Quiz created successfully!');
      router.push(`/quiz/play/${docRef.id}`);
    } catch (e) {
      toast.error('Failed to create quiz');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.push('/quiz')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-slate-800">Create a Quiz</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Quiz Info & AI Generator */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quiz Info Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                Quiz Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quiz Title *</label>
                  <Input 
                    placeholder="Enter quiz title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                  <Textarea 
                    placeholder="Briefly describe your quiz" 
                    value={desc} 
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category (optional)</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select a category</option>
                    <option value="Art & Literature">Art & Literature</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Geography">Geography</option>
                    <option value="History">History</option>
                    <option value="Languages">Languages</option>
                    <option value="Science & Nature">Science & Nature</option>
                    <option value="Sports">Sports</option>
                    <option value="Trivia">Trivia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banner Image (optional)</label>
                  {bannerImageUrl || bannerPreview ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="relative group">
                        <img src={bannerImageUrl || bannerPreview} alt="Banner" className="w-full h-40 object-cover rounded-lg border" />
                        <button 
                          onClick={() => {
                            // revoke any local preview
                            setBannerPreview((prev) => {
                              if (prev && prev.startsWith('blob:')) {
                                try { URL.revokeObjectURL(prev); } catch {}
                              }
                              return undefined;
                            });
                            // best-effort delete of uploaded file if present
                            const fileId = bannerImageFileId;
                            if (fileId) {
                              fetch('/api/imagekit/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fileId }),
                              }).catch(() => {});
                            }
                            setBannerImageUrl(undefined);
                            setBannerImageFileId(undefined);
                            setBannerImageFilePath(undefined);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label 
                      htmlFor="quiz-banner-input"
                      className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-purple-400 hover:bg-purple-50 ${bannerUploading ? 'opacity-50' : ''}`}
                    >
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm font-medium text-slate-700">Upload banner image</span>
                      <span className="text-xs text-slate-500 mt-1">JPG, PNG or GIF (max 5MB)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="quiz-banner-input"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const MAX_MB = 5;
                          if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
                          if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Image must be under ${MAX_MB}MB`); return; }
                          // Show local preview immediately
                          try {
                            const blobUrl = URL.createObjectURL(file);
                            setBannerPreview((prev) => {
                              if (prev && prev.startsWith('blob:')) {
                                try { URL.revokeObjectURL(prev); } catch {}
                              }
                              return blobUrl;
                            });
                          } catch {}
                          setBannerUploading(true);
                          const toastId = toast.loading('Uploading banner...');
                          try {
                            const form = new FormData();
                            form.append('file', file);
                            form.append('fileName', `quiz-banner-${user?.uid || 'guest'}-${Date.now()}`);
                            form.append('folder', 'banners');
                            const res = await fetch('/api/imagekit/upload', { method: 'POST', body: form });
                            const data = await res.json();
                            if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed');
                            setBannerImageUrl(data.url);
                            setBannerImageFileId(data.fileId);
                            setBannerImageFilePath(data.filePath);
                            // Replace local preview with CDN url
                            setBannerPreview((prev) => {
                              if (prev && prev.startsWith('blob:')) {
                                try { URL.revokeObjectURL(prev); } catch {}
                              }
                              return undefined;
                            });
                            toast.success('Banner uploaded', { id: toastId });
                          } catch (err: any) {
                            console.error(err);
                            toast.error(err.message || 'Banner upload failed', { id: toastId });
                            // Keep local preview visible so user can still see their pick
                          } finally {
                            setBannerUploading(false);
                            if (e.target) (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="hidden"
                        disabled={bannerUploading}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* AI Generator Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  AI Quiz Generator
                </h2>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setAiOpen((v) => !v)}
                  className="flex items-center gap-1"
                >
                  {aiOpen ? 'Hide' : 'Show'} <Sparkles className="h-4 w-4" />
                </Button>
              </div>
              
              {aiOpen && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Topic *</label>
                    <Input 
                      placeholder="e.g., World Capitals, Python Programming" 
                      value={aiTopic} 
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Questions</label>
                      <Input 
                        type="number" 
                        min={2} 
                        max={10} 
                        value={aiNumQuestions} 
                        onChange={(e) => setAiNumQuestions(parseInt(e.target.value || '5', 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                      <select 
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                        value={aiDifficulty} 
                        onChange={(e) => setAiDifficulty(e.target.value as any)}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source Material (optional)</label>
                    <Textarea 
                      placeholder="Paste notes or content to base questions on..." 
                      value={aiSource} 
                      onChange={(e) => setAiSource(e.target.value)}
                      className="w-full min-h-[100px]"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      disabled={aiLoading || !aiTopic.trim()} 
                      onClick={async () => {
                        try {
                          setAiLoading(true);
                          const res = await fetch('/api/quiz/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              topic: aiTopic.trim(), 
                              numQuestions: aiNumQuestions, 
                              difficulty: aiDifficulty, 
                              sourceText: aiSource 
                            })
                          });
                          if (!res.ok) throw new Error('Failed');
                          const data = await res.json();
                          setTitle((t) => t || data.title);
                          setDesc((d) => d || data.description || '');
                          const qs: QuizQuestion[] = (data.questions || []).map((q: any) => ({
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
                          if (qs.length >= 2) {
                            setQuestions(qs);
                            setSelectedIndex(0);
                          }
                          toast.success('Quiz generated successfully!');
                        } catch {
                          toast.error('Failed to generate quiz');
                        } finally {
                          setAiLoading(false);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      {aiLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Quiz
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => { setAiTopic(''); setAiSource(''); }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Questions Navigation */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Questions</h2>
                <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{questions.length} questions</span>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedIndex === idx 
                        ? 'bg-purple-100 border border-purple-300 shadow-sm' 
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                      selectedIndex === idx 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 truncate text-sm">
                      {q.text || `Question ${idx + 1}`}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                      disabled={questions.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={addQuestion} 
                variant="outline" 
                className="w-full mt-4 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
          </div>

          {/* Middle Panel - Question Editor */}
          <div className="lg:col-span-2">
            {questions.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                    Question {selectedIndex + 1}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIndex(Math.min(questions.length - 1, selectedIndex + 1))}
                      disabled={selectedIndex === questions.length - 1}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Question Text *</label>
                    <Input
                      placeholder="Enter your question"
                      value={selected.text}
                      onChange={(e) => setQuestions((arr) => arr.map((qq, i) => i === selectedIndex ? { ...qq, text: e.target.value } : qq))}
                      className="w-full text-lg py-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Explanation (optional)</label>
                    <Textarea
                      placeholder="Add context or explanation for this question"
                      value={selected.explanation || ''}
                      onChange={(e) => setQuestions((arr) => arr.map((qq, i) => i === selectedIndex ? { ...qq, explanation: e.target.value } : qq))}
                      className="w-full min-h-[80px]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-slate-700">Answer Choices *</label>
                      <span className="text-xs text-slate-500">{selected.choices.length}/6 options</span>
                    </div>
                    
                    <div className="space-y-3">
                      {selected.choices.map((choice, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <button
                            onClick={() => setQuestions((arr) => arr.map((qq, i) => i === selectedIndex ? { ...qq, answerIndex: idx } : qq))}
                            className="mt-2.5 flex-shrink-0 transition-transform hover:scale-110"
                          >
                            {selected.answerIndex === idx ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>
                          <Input
                            placeholder={`Option ${idx + 1}`}
                            value={choice}
                            onChange={(e) => setQuestions((arr) => arr.map((qq, i) => 
                              i === selectedIndex ? { 
                                ...qq, 
                                choices: qq.choices.map((c, ci) => ci === idx ? e.target.value : c) 
                              } : qq
                            ))}
                            className="flex-1"
                          />
                          <div className="flex gap-1 mt-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setQuestions((arr) => arr.map((qq, i) => 
                                i === selectedIndex ? { 
                                  ...qq, 
                                  choices: [...qq.choices.slice(0, idx), ...qq.choices.slice(idx + 1)],
                                  answerIndex: qq.answerIndex >= idx && qq.choices.length > 1 ? Math.max(0, qq.answerIndex - 1) : qq.answerIndex
                                } : qq
                              ))}
                              disabled={selected.choices.length <= 2}
                              className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      onClick={() => setQuestions((arr) => arr.map((qq, i) => 
                        i === selectedIndex ? { ...qq, choices: [...qq.choices, ''] } : qq
                      ))}
                      disabled={selected.choices.length >= 6}
                      variant="outline"
                      className="mt-3 w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
                <div className="text-slate-400 mb-4">No questions yet</div>
                <Button onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Question
                </Button>
              </div>
            )}

            {/* Right Panel - Question Settings */}
            {questions.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-slate-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Question Settings</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-medium text-slate-800">Required Question</div>
                      <div className="text-sm text-slate-500">User must answer this question</div>
                    </div>
                    <Checkbox 
                      checked={!!selected.required} 
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setQuestions((arr) => arr.map((qq, i) => 
                          i === selectedIndex ? { ...qq, required: checked } : qq
                        ));
                      }} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-medium text-slate-800">Shuffle Options</div>
                      <div className="text-sm text-slate-500">Randomize order of choices</div>
                    </div>
                    <Checkbox 
                      checked={!!selected.shuffle} 
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setQuestions((arr) => arr.map((qq, i) => 
                          i === selectedIndex ? { ...qq, shuffle: checked } : qq
                        ));
                      }} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-medium text-slate-800">Allow "Other" Option</div>
                      <div className="text-sm text-slate-500">Let users enter a custom answer</div>
                    </div>
                    <Checkbox 
                      checked={!!selected.allowOther} 
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setQuestions((arr) => arr.map((qq, i) => 
                          i === selectedIndex ? { ...qq, allowOther: checked } : qq
                        ));
                      }} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-medium text-slate-800">Add Comment Field</div>
                      <div className="text-sm text-slate-500">Allow users to add comments</div>
                    </div>
                    <Checkbox 
                      checked={!!selected.allowComment} 
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setQuestions((arr) => arr.map((qq, i) => 
                          i === selectedIndex ? { ...qq, allowComment: checked } : qq
                        ));
                      }} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t border-slate-200 gap-4">
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <div className="flex items-center">
              <div className={`h-2 w-2 rounded-full mr-2 ${title.trim() ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {title ? `"${title.length > 20 ? title.substring(0, 20) + '...' : title}"` : 'Untitled quiz'}
            </div>
            <span className="text-slate-300">•</span>
            <span>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={() => router.push('/quiz')}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !title.trim() || questions.some(q => !q.text.trim() || q.choices.some(c => !c.trim()))}
              className="flex items-center gap-2 min-w-[120px] bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save & Start
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}