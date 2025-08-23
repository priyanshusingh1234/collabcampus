import * as admin from "firebase-admin";
import { NextRequest } from "next/server";

function ensureAdmin() {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    } else {
      throw new Error("Firebase Admin credentials are not configured");
    }
  }
}

export async function verifyAuthFromRequest(req: NextRequest, fallbackToken?: string) {
  ensureAdmin();
  const auth = admin.auth();
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = bearer || fallbackToken;
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded; // contains uid
  } catch {
    return null;
  }
}
