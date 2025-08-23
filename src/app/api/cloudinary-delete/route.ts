import { NextRequest, NextResponse } from "next/server";
import { getCloudinaryConfig } from "@/lib/cloudinary";
import { v2 as cloudinary } from "cloudinary";

// POST /api/cloudinary-delete
// body: { public_id: string, resource_type?: 'image'|'video'|'raw' }
// Deletes an asset from Cloudinary securely on the server.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const public_id: string | undefined = body?.public_id;
    const resource_type: "image" | "video" | "raw" | undefined = body?.resource_type;

    if (!public_id) {
      return NextResponse.json({ error: "public_id is required" }, { status: 400 });
    }

    const { cloudName, apiKey, hasSecret } = getCloudinaryConfig();
    if (!cloudName || !apiKey || !hasSecret) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }

    const opts: Record<string, any> = {};
    if (resource_type === "video" || resource_type === "raw" || resource_type === "image") {
      opts.resource_type = resource_type;
    }

    const result = await cloudinary.uploader.destroy(public_id, opts);
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete asset" }, { status: 500 });
  }
}
