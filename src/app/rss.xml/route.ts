import { NextResponse } from 'next/server';
import { absUrl } from '@/lib/site';

export const dynamic = 'force-static';

async function getPosts(): Promise<Array<{ title: string; slug: string; description?: string; date?: Date }>> {
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(50).get();
    return snap.docs.map((d: any) => {
      const data = d.data() || {};
      const created = data.createdAt?.toDate?.() || new Date();
      return { title: String(data.title || 'Untitled'), slug: String(data.slug || d.id), description: String((data.content || '').slice(0, 180)), date: created };
    });
  } catch (_) {
    return [];
  }
}

function rssXml(items: Array<{ title: string; link: string; description: string; pubDate: string }>) {
  const channelTitle = 'CollabCampus - Latest Posts';
  const channelLink = absUrl('/');
  const channelDesc = 'Latest posts from CollabCampus';
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${channelTitle}</title>
    <link>${channelLink}</link>
    <description>${channelDesc}</description>
    ${items
      .map(
        (i) => `
    <item>
      <title><![CDATA[${i.title}]]></title>
      <link>${i.link}</link>
      <description><![CDATA[${i.description}]]></description>
      <pubDate>${i.pubDate}</pubDate>
    </item>`
      )
      .join('')}
  </channel>
</rss>`;
}

export async function GET() {
  const posts = await getPosts();
  const items = posts.map((p) => ({
    title: p.title,
    link: absUrl(`/blog/${p.slug}`),
    description: p.description || '',
    pubDate: (p.date || new Date()).toUTCString(),
  }));
  const xml = rssXml(items);
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 's-maxage=600, stale-while-revalidate=86400' } });
}
