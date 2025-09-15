import { absUrl } from '@/lib/site'

export type BasicSeo = {
  title?: string
  description?: string
  url?: string
  image?: string | null
  type?: 'website' | 'article' | 'profile'
  publishedTime?: string
  modifiedTime?: string
  authorName?: string
  siteName?: string
  locale?: string
}

export function buildTitle(title?: string) {
  const base = 'Manthan'
  if (!title) return base
  // Avoid duplicate brand if already included
  return /manthan/i.test(title) ? title : `${title} • ${base}`
}

export function canonical(pathOrUrl?: string) {
  if (!pathOrUrl) return absUrl('/')
  try {
    const u = new URL(pathOrUrl)
    return u.origin + u.pathname + u.search
  } catch {
    return absUrl(pathOrUrl)
  }
}

export function defaultImage() {
  return absUrl('/logo.svg')
}

export function ogTags(meta: BasicSeo) {
  const siteName = meta.siteName || 'Manthan'
  const url = canonical(meta.url)
  const title = buildTitle(meta.title)
  const description = meta.description || 'Ignite curiosity. Build together on Manthan.'
  const image = meta.image || defaultImage()
  const type = meta.type || 'website'
  const locale = meta.locale || 'en_US'

  return [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: type },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: siteName },
    { property: 'og:locale', content: locale },
    { property: 'og:image', content: image as string },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image as string },
  ]
}

export function articleJsonLd(meta: BasicSeo) {
  if (meta.type !== 'article') return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    datePublished: meta.publishedTime,
    dateModified: meta.modifiedTime || meta.publishedTime,
    author: meta.authorName ? { '@type': 'Person', name: meta.authorName } : undefined,
    mainEntityOfPage: canonical(meta.url),
    image: meta.image || defaultImage(),
  }
}

export function profileJsonLd(meta: BasicSeo & { username?: string }) {
  if (meta.type !== 'profile') return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: meta.authorName || meta.username,
    url: canonical(meta.url),
    image: meta.image || defaultImage(),
  }
}
