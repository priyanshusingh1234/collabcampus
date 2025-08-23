// Minimal API route for AI ask (replace with your backend logic)
import { NextRequest, NextResponse } from 'next/server';
import { askAI } from '@/ai/flows/ask-ai';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const question: string | undefined = typeof body?.question === 'string' ? body.question : undefined;
  const imageUrl: string | undefined = typeof body?.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl : undefined;

  if (!question) {
    return NextResponse.json({ error: 'Please provide a question.' }, { status: 400 });
  }

  try {
    const payload = imageUrl ? { question, imageUrl } : { question };
    const { answer } = await askAI(payload as any);
    return NextResponse.json({ answer });
  } catch (e: any) {
    console.error('AskAI error', e);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
