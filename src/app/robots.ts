import type { MetadataRoute } from 'next';
import { absUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
  disallow: ['/api/', '/admin'],
    },
    sitemap: absUrl('/sitemap.xml'),
  };
}
