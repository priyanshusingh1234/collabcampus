# **App Name**: CollabCampus

## Core Features:

- Firebase Authentication: Set up Firebase Authentication with Google and email/password login for secure user access.
- User Data Management: Manage user data (username, bio, avatar) with Firebase Firestore in 'users' collection.
- Blog Post Creation: Create a blog post editor with title, slug, content (using Markdown), authorId, and timestamp.
- Question Asking: Enable users to ask questions with tags, content (using Markdown), and authorId, stored in 'questions' collection.
- Comment System: Implement nested comment threads under blogs and questions, with parentId support for managing replies.
- Image Management with ImageKit: Allow users to upload and manage profile pictures and blog images via ImageKit.
- AI-Powered Blog Summaries: Use an AI tool to analyze and summarize blog post contents. Users can request the AI summary by clicking a button. Display this at the top of blog posts, to quickly communicate the article content.

## Style Guidelines:

- Primary color: Blue (#3490dc), symbolizing trust and knowledge.
- Background color: Light gray (#f7f7f7), for a clean and modern interface.
- Accent color: Green (#38c172), for calls to action and positive feedback.
- Body font: 'Inter', a sans-serif for readability and modern aesthetic.
- Headline font: 'Space Grotesk', a geometric sans-serif to give a tech-forward appearance.
- Use Font Awesome for a wide range of icons, consistently sized and styled.
- A grid-based layout for a responsive design across different devices.