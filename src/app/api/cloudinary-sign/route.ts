import { NextRequest, NextResponse } from "next/server";
import { getCloudinaryConfig, signParams, buildStringToSign } from "@/lib/cloudinary";

// POST /api/cloudinary-sign
// body: { folder?: string, public_id?: string, resource_type?: 'auto'|'image'|'video'|'raw', timestamp?: number, eager?: string }
// returns: { signature, timestamp, apiKey, cloudName, folder?, public_id? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const timestamp = Math.floor(Date.now() / 1000);
    const { cloudName, apiKey, hasSecret } = getCloudinaryConfig();
    if (!cloudName || !apiKey || !hasSecret) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }

    // Only include parameters that Cloudinary expects in the signature for uploads.
    // Do NOT include resource_type in the signature (it is part of the URL path, not signed).
    const signableKeys = ["folder", "public_id", "eager", "tags", "context", "invalidate"] as const;
    const params: Record<string, string | number> = { timestamp };
    for (const k of signableKeys) {
      if (body?.[k] != null) params[k] = String(body[k]);
    }

    const signature = signParams(params);
    // Echo back non-signed values needed by the client (e.g., resource_type) without affecting signature
    const responsePayload = { signature, timestamp, apiKey, cloudName, ...params } as any;
    if (body?.resource_type) responsePayload.resource_type = String(body.resource_type);
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.stringToSign = buildStringToSign(params);
    }
    return NextResponse.json(responsePayload);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to sign" }, { status: 500 });
  }
}
