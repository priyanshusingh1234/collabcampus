import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebaseAdmin";
import QuestionPageClient from "./QuestionPageClient";

// Deep-serialize Firestore data so only plain JSON values are passed to the client
function serializeFirestore(value: any): any {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t !== "object") return value;

  // Firestore Timestamp detection (has toDate())
  if (typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) return value.map(serializeFirestore);

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = serializeFirestore(v);
  }
  return out;
}

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("questions")
    .where("slug", "==", resolved.slug)
    .limit(1)
    .get();

  if (snapshot.empty) return { title: "Question Not Found - Collab Campus" };

  const data = snapshot.docs[0].data();

  return {
    title: `${data.title} - Asked by ${data.author?.username || "Unknown"} | Collab Campus`,
    description: data.content?.slice(0, 160),
    openGraph: {
      title: data.title,
      description: data.content,
      images: data.image ? [{ url: data.image }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.content,
      images: data.image ? [data.image] : [],
    },
  };
}

export default async function QuestionPage({ params }: any) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("questions")
    .where("slug", "==", resolved.slug)
    .limit(1)
    .get();

  if (snapshot.empty) return notFound();

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  // ✅ Deep-serialize all Firestore Timestamp and nested values
  const question = { id: docSnap.id, ...serializeFirestore(data) } as any;

  return <QuestionPageClient question={question} />;
}
