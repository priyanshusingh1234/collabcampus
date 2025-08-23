import type { User, Blog, Badge } from './types';

export const placeholderBadges: Badge[] = [
  {
    id: 'badge-1',
    name: 'Prolific Writer',
    description: 'Published 5 or more articles.',
    icon: 'PenSquare',
  },
  {
    id: 'badge-2',
    name: 'Community Helper',
    description: 'Answered 10 or more questions.',
    icon: 'MessageSquareHeart',
  },
  {
    id: 'badge-3',
    name: 'First Post',
    description: 'Published your first article.',
    icon: 'Feather',
  }
];

export const placeholderUsers: User[] = [
  {
    id: 'user-1',
    username: 'alice_dev',
    email: 'alice@example.com',
    bio: 'Full-stack developer and lifelong learner. Exploring the frontiers of web technology and sharing my journey one post at a time.',
    avatarUrl: 'https://placehold.co/100x100.png',
    badges: [placeholderBadges[0], placeholderBadges[2]],
    stats: { posts: 5, questions: 10, answers: 20, comments: 50, followers: 150, following: 30 },
  },
  {
    id: 'user-2',
    username: 'bob_designer',
    email: 'bob@example.com',
    bio: 'UX/UI designer passionate about creating intuitive and beautiful interfaces that people love to use.',
    avatarUrl: 'https://placehold.co/100x100.png',
    badges: [placeholderBadges[1]],
    stats: { posts: 2, questions: 3, answers: 8, comments: 25, followers: 75, following: 120 },
  },
];

export const placeholderBlogs: Blog[] = [
  {
    id: 'blog-1',
    title: 'Getting Started with Next.js 14',
    slug: 'getting-started-with-nextjs-14',
    content: `Next.js 14 introduces a paradigm shift with the App Router, Server Components, and Server Actions. This post will guide you through setting up a new project and understanding the core concepts. We'll cover routing, data fetching, and mutations, giving you a solid foundation to build modern, performant web applications. The future of React is here, and it's built on the server. By leveraging server-side rendering and minimizing client-side JavaScript, we can build faster, more resilient applications. Join us as we explore the new features and how they can supercharge your development workflow. Let's dive in and see what makes Next.js 14 so powerful.`,
    author: placeholderUsers[0],
    createdAt: new Date('2023-10-26'),
    imageUrl: 'https://placehold.co/1200x630.png',
    tags: ['Next.js', 'React', 'Web Development'],
  },
  {
    id: 'blog-2',
    title: 'A Deep Dive into Firestore Security Rules',
    slug: 'firestore-security-rules-deep-dive',
    content: `Firestore is a powerful database, but securing your data is crucial. This article explores advanced security rule patterns. We'll go beyond basic authentication checks and look at role-based access control, data validation, and preventing malicious queries. Properly configured rules are your first line of defense against data breaches and unauthorized access. We'll provide practical examples that you can adapt for your own projects, covering common use cases like user profiles, content ownership, and administrative privileges. Secure your app from the ground up!`,
    author: placeholderUsers[1],
    createdAt: new Date('2023-11-05'),
    imageUrl: 'https://placehold.co/1200x630.png',
    tags: ['Firebase', 'Security', 'Database'],
  },
  {
    id: 'blog-3',
    title: 'Mastering Tailwind CSS for Responsive Design',
    slug: 'mastering-tailwind-css',
    content: `Tailwind CSS has changed the way we write styles. This guide will teach you how to build complex, responsive layouts with utility-first classes. Say goodbye to writing custom CSS files for every component. We'll cover mobile-first design, custom variants, and how to use plugins to extend Tailwind's core functionality. By the end, you'll be able to create beautiful, consistent UIs that look great on any device, from mobile phones to large desktops. It's time to build faster and more efficiently.`,
    author: placeholderUsers[0],
    createdAt: new Date('2023-11-15'),
    imageUrl: 'https://placehold.co/1200x630.png',
    tags: ['CSS', 'TailwindCSS', 'Frontend'],
  },
];
