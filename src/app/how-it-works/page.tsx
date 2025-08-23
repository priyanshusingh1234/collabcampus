import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How it works | CollabCampus',
  description: 'A quick guide to using CollabCampus effectively.',
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">How it works</h1>
      <p className="text-gray-700 dark:text-gray-300 mb-8 max-w-3xl">
        CollabCampus helps you learn in public, share work, and get feedback quickly. Here’s how to make the most of it:
      </p>

      {/* Onboarding steps */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="font-semibold mb-2">1) Create your profile</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Sign up, add a photo and bio, and follow topics and creators you like.</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="font-semibold mb-2">2) Ask or share</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Post questions or write blogs. Be specific and show what you tried.</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="font-semibold mb-2">3) Engage</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Comment, upvote helpful answers, and follow threads you care about.</p>
        </div>
      </div>

      {/* Product features */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="text-lg font-semibold mb-1">Ask AI</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Use the built-in AI assistant to summarize posts or get hints (not answers) on tough questions.</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="text-lg font-semibold mb-1">Save for later</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Bookmark posts to your saved list and build your personal reading queue.</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="text-lg font-semibold mb-1">Follow topics & creators</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Tune your home feed by following categories and people whose work you admire.</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6">
          <h3 className="text-lg font-semibold mb-1">Groups</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Create or join groups to organize learners around a goal, course, or challenge.</p>
        </div>
      </section>

      {/* Community guidelines and safety */}
      <section className="mt-12">
        <h3 className="text-lg font-semibold mb-3">Community basics</h3>
        <ul className="list-disc ml-6 space-y-2 text-gray-700 dark:text-gray-300">
          <li>Be kind. Assume good intent and keep feedback constructive.</li>
          <li>Credit sources. Link to original posts, repos, or authors.</li>
          <li>No spam or harassment. We moderate and may restrict accounts.</li>
        </ul>
      </section>

      {/* Power tips */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold mb-3">Power tips</h3>
        <ol className="list-decimal ml-6 space-y-2 text-gray-700 dark:text-gray-300">
          <li>Post small updates often instead of one big update.</li>
          <li>Use tags on questions so the right people can find them.</li>
          <li>Summarize your learnings in blogs to help future you.</li>
        </ol>
      </section>
    </div>
  );
}
