// Helper to build absolute URLs consistently across routes
export function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return 'http://localhost:9002';
}

export function absUrl(path: string) {
  const base = getBaseUrl();
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}
