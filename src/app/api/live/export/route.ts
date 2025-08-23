// Minimal Next.js route to satisfy type checking
import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({ ok: true });
}

export const runtime = "edge";
