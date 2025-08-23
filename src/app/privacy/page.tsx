import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | CollabCampus',
  description: 'How we handle your data and respect your privacy.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">Privacy Policy</h1>
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed max-w-3xl">
        We value your privacy. We collect only what we need to provide core features and to improve the product. We never sell your data.
      </p>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">What we collect</h2>
          <ul className="list-disc ml-5 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li>Account info (email, username) to authenticate you</li>
            <li>Content you create (blogs, questions, comments)</li>
            <li>Basic usage analytics to improve CollabCampus</li>
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">How we use it</h2>
          <ul className="list-disc ml-5 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li>Provide features like posts, comments, and notifications</li>
            <li>Detect abuse and keep the community safe</li>
            <li>Understand product usage to guide improvements</li>
          </ul>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Data choices</h2>
          <ul className="list-disc ml-5 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li>Export or delete your account data anytime</li>
            <li>Update email and profile in settings</li>
            <li>Manage cookie preferences at the bottom of the site</li>
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Have questions? Email <a className="underline hover:text-gray-900 dark:hover:text-gray-100" href="mailto:kpk22128@gmail.com">kpk22128@gmail.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
