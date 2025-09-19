import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyAuthFromRequest } from "@/lib/authServer";

// Configure ImageKit for server-side deletions
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
});

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const req = _req as NextRequest;
    const token = await verifyAuthFromRequest(req);
    if (!token?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const snap = await db.collection("moments").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = snap.data() as any;

    // Authorization: author or admin (users document has isAdmin=true)
    let isAdmin = false;
    try {
      const usersQ = await db.collection("users").where("uid", "==", token.uid).limit(1).get();
      const me = usersQ.docs[0]?.data();
      isAdmin = !!me?.isAdmin;
    } catch {}
    if (data.authorId !== token.uid && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Best-effort: delete associated media from ImageKit
    const media: Array<{ fileId?: string }> = Array.isArray(data.media) ? data.media : [];
    const deleteMedia = async () => {
      if (!imagekit || !process.env.IMAGEKIT_PRIVATE_KEY) return;
      await Promise.all(
        media
          .map((m) => m?.fileId)
          .filter(Boolean)
          .map(async (fileId) => {
            try { await imagekit.deleteFile(fileId as string); } catch {/* ignore */}
          })
      );
    };

    // Delete subcollections: comments and likes (best-effort batches)
    const deleteSubcollection = async (sub: string) => {
      try {
        const col = db.collection("moments").doc(id).collection(sub);
        const qs = await col.get();
        const chunks: any[] = [];
        const arr = qs.docs;
        const size = 400; // under 500/batch limit
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        for (const group of chunks) {
          const batch = db.batch();
          group.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch {/* ignore */}
    };

    // Remove references from users.favoriteMoments
    const removeFromFavorites = async () => {
      try {
        // Firestore array-contains query
        let fetched = 0;
        const pageSize = 100;
        let last: any = null;
        // Loop pages; safety cap 10 pages
        for (let page = 0; page < 10; page++) {
          let q = db.collection("users").where("favoriteMoments", "array-contains", id).limit(pageSize);
          if (last) q = q.startAfter(last);
          const qs = await q.get();
          if (qs.empty) break;
          const batch = db.batch();
          qs.docs.forEach((d: any) => {
            batch.update(d.ref, { favoriteMoments: (global as any).FieldValue?.arrayRemove
              ? (global as any).FieldValue.arrayRemove(id)
              : require("firebase-admin").firestore.FieldValue.arrayRemove(id) });
          });
          await batch.commit();
          fetched += qs.docs.length;
          last = qs.docs[qs.docs.length - 1];
          if (qs.docs.length < pageSize) break;
        }
      } catch {/* ignore */}
    };

    // Perform deletions
    await Promise.all([
      deleteMedia(),
      deleteSubcollection("comments"),
      deleteSubcollection("likes"),
      removeFromFavorites(),
    ]);

    // Finally delete the moment doc
    await db.collection("moments").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Delete moment error", e);
    return NextResponse.json({ error: e?.message || "Failed to delete moment" }, { status: 500 });
  }
}

export const runtime = "nodejs";
