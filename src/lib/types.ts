export interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  badges: Badge[];
  stats: {
    posts: number;
    questions: number;
    answers: number;
    comments: number;
    followers: number;
    following: number;
  };
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown
  author: User;
  createdAt: Date;
  imageUrl?: string;
  tags: string[];
  category?: string;
}

export interface Question {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown
  author: User;
  tags: string[];
  createdAt: Date;
  image?: string | null;
  imageFileId?: string | null;
  category?: string;
  uid?: string; // author uid convenience on root (legacy/new docs)
}

export interface Comment {
  id: string;
  content: string;
  author: User;
  createdAt: Date;
  parentId?: string | null;
  replies: Comment[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}
