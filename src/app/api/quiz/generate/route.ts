import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/generate-quiz';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, numQuestions, difficulty, sourceText, category } = body || {};
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
    }

    const n = typeof numQuestions === 'number' ? numQuestions : 5;
    const result = await generateQuiz({
      topic,
      numQuestions: Math.min(10, Math.max(2, n)),
      difficulty: (difficulty || 'medium') as any,
      sourceText,
      category,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate' }, { status: 500 });
  }
}
