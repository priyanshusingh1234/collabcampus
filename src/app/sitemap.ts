import type { MetadataRoute } from 'next';
import { absUrl } from '@/lib/site';

async function getBlogSlugs(): Promise<string[]> {
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const snap = await db.collection('posts').select('slug', 'updatedAt', 'createdAt').get();
    const slugs = new Set<string>();
    snap.forEach((d: any) => {
      const slug = d.get('slug');
      if (slug) slugs.add(String(slug));
    });
    return Array.from(slugs);
  } catch (_) {
    // Fallback: no admin or no access; return empty
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: absUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absUrl('/blogs'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absUrl('/questions'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absUrl('/new-post'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absUrl('/ask'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: absUrl('/saved'), lastModified: now, changeFrequency: 'weekly', priority: 0.4 },
  { url: absUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  { url: absUrl('/how-it-works'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  { url: absUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const slugs = await getBlogSlugs();
  const blogEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: absUrl(`/blog/${slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...base, ...blogEntries];
}
