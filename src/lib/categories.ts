export type Category = {
  slug: string;
  label: string;
  emoji?: string;
};

export const CATEGORIES: Category[] = [
  { slug: 'web-dev', label: 'Web Dev', emoji: '🌐' },
  { slug: 'javascript', label: 'JavaScript', emoji: '🟨' },
  { slug: 'react', label: 'React', emoji: '⚛️' },
  { slug: 'mobile', label: 'Mobile', emoji: '📱' },
  { slug: 'ai-ml', label: 'AI & ML', emoji: '🤖' },
  { slug: 'cloud', label: 'Cloud', emoji: '☁️' },
  { slug: 'devops', label: 'DevOps', emoji: '🛠️' },
  { slug: 'data', label: 'Data', emoji: '📊' },
  { slug: 'design', label: 'Design', emoji: '🎨' },
  { slug: 'career', label: 'Career', emoji: '🚀' },
];

export function getCategory(slug?: string) {
  if (!slug) return undefined;
  return CATEGORIES.find((c) => c.slug === slug);
}

// Convert a free-form tag or label to a category slug: prefer known categories, else slugify
export function toCategorySlug(input?: string) {
  try {
    if (!input) return 'web-dev';
    const norm = (input || '').trim().toLowerCase();
    const match = CATEGORIES.find(
      (c) => c.slug === norm || c.label.toLowerCase() === norm
    );
    if (match) return match.slug;
    // fall back to slugified form (lazy slugify to avoid heavy deps here)
    const slug = norm
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || 'web-dev';
  } catch {
    return 'web-dev';
  }
}
