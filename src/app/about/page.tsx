import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | CollabCampus',
  description: 'Learn about the mission and vision behind CollabCampus.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">About CollabCampus</h1>
        <p className="mx-auto max-w-3xl text-gray-700 dark:text-gray-300 leading-relaxed">
          CollabCampus is a community platform for learners and builders. Ask questions, publish
          blogs, join groups, and go further together.
        </p>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">What we do</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            We make it simple to learn in public, get feedback fast, and build a body of work you can be proud of.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Our mission</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Empower students and professionals to share knowledge, showcase projects, and help each other succeed.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">Built for community</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Follow topics, join groups, and collaborate with updates, comments, and notifications.
          </p>
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Values</h3>
          <ul className="list-disc ml-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>Learn in public</li>
            <li>Be kind, be curious</li>
            <li>Ship small, ship often</li>
            <li>Credit creators</li>
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Tech</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Built with Next.js, TypeScript, Tailwind, and Firebase for speed and reliability.
          </p>
        </div>
      </section>
    </div>
  );
}
