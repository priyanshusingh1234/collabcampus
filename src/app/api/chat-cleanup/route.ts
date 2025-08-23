import { NextRequest, NextResponse } from 'next/server';
import ImageKit from 'imagekit';
import { getAdminDb } from '@/lib/firebaseAdmin';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function POST(req: NextRequest) {
  try {
    // Optional shared-secret check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.headers.get('x-cron-key');
      if (provided !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

  const db = getAdminDb();
  const body = await req.json().catch(() => ({} as any));
  const groupId: string | undefined = body.groupId;

    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour ago

    // If a groupId is provided, clean just that group; else clean all groups (limited scan)
    const groupsToCheck: string[] = [];
    if (groupId) {
      groupsToCheck.push(groupId);
    } else {
      // Caution: scanning all groups; consider narrowing with scheduled known groups list
  const groupsSnap = await db.collection('groups').select().limit(200).get();
  groupsSnap.forEach((g: any) => groupsToCheck.push(g.id));
    }

    const results: { deletedMessages: number; deletedFiles: number } = { deletedMessages: 0, deletedFiles: 0 };

    for (const gid of groupsToCheck) {
      const msgsSnap = await db
        .collection('groups')
        .doc(gid)
        .collection('messages')
        .where('expiresAt', '<=', new Date(cutoff))
        .get();
      const batch = db.batch();
      const deletions: Array<Promise<any>> = [];
      msgsSnap.forEach((d: any) => {
        const data = d.data() as any;
        if (data.imageFileId) {
          deletions.push(
            imagekit
              .deleteFile(data.imageFileId)
              .then(() => {
                results.deletedFiles += 1;
              })
              .catch(() => null)
          );
        }
        batch.delete(d.ref);
        results.deletedMessages += 1;
      });
      await Promise.allSettled(deletions);
      await batch.commit();
    }

    return NextResponse.json({ success: true, ...results });
  } catch (e: any) {
    console.error('Chat cleanup error', e);
    return NextResponse.json({ error: e?.message || 'Cleanup failed' }, { status: 500 });
  }
}
