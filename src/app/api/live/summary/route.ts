import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({ summary: [] });
}

export const runtime = "edge";
