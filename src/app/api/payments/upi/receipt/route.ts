import { NextResponse } from "next/server";

// Premium is paused; endpoint disabled.
export async function POST() {
  return NextResponse.json({ error: 'Premium disabled' }, { status: 404 });
}
