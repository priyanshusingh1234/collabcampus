import { NextResponse } from "next/server";

// Premium paused: always report false
export async function GET() {
  return NextResponse.json({ premium: false });
}

// Clear any existing cookie (no-op stub)
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('prem', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
