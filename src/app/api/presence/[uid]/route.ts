import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Lightweight presence API backed by PostgreSQL via Prisma
// GET /api/presence/[uid] -> { uid, state, lastActive, updatedAt } | 404
// POST /api/presence/[uid] with { state: 'online' | 'offline' } -> upsert document

export async function GET(_: NextRequest, { params }: { params: { uid: string } }) {
  const { uid } = params;
  try {
    const p = await prisma.presence.findUnique({ where: { uid } });
    if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(p);
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { uid: string } }) {
  const { uid } = params;
  try {
    const body = await req.json();
    const state = body?.state === 'online' ? 'online' : body?.state === 'offline' ? 'offline' : null;
    if (!state) return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
    const now = new Date();
    const lastActive = state === 'online' ? now : undefined;
    const p = await prisma.presence.upsert({
      where: { uid },
      update: { state, lastActive },
      create: { uid, state, lastActive },
    });
    return NextResponse.json(p);
  } catch (e) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
