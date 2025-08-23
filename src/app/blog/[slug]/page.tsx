// app/blog/[slug]/page.tsx
import type { Metadata } from 'next';
import BlogPage from './BlogPage';

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> } // 👈 params is a Promise now
): Promise<Metadata> {
  const { slug } = await props.params; // ✅ must await

  const title = `Post | CollabCampus`;
  const desc = `Read this post on CollabCampus: ${slug}`;
  const image = 'https://ghoops.me/logo.png';

  return {
    title,
    description: desc,
    openGraph: { title, description: desc, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [image] },
  };
}

export default async function Page(
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params; // ✅ also await here
  return <BlogPage params={params} />;
}
