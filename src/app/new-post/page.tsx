import { NewPostForm } from "@/components/blog/NewPostForm";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function NewPostPage() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-[radial-gradient(1200px_600px_at_50%_-50%,#ffd1dc_0%,transparent_60%),radial-gradient(1200px_600px_at_50%_110%,#ffd1dc_0%,transparent_60%)] dark:bg-[radial-gradient(1200px_600px_at_50%_-50%,#2a2a72_0%,transparent_60%),radial-gradient(1200px_600px_at_50%_110%,#009ffd_0%,transparent_60%)] transition-colors">
      <div className="mx-auto max-w-5xl px-4 md:px-8 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white/95 dark:bg-gray-950/95 shadow-xl ring-1 ring-black/5 backdrop-blur">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-semibold">New Post</h1>
          </div>
          <div className="px-4 md:px-8 py-6">
            <RequireAuth>
              <NewPostForm />
            </RequireAuth>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Press Tab for helpers. Be kind and follow the rules.</p>
      </div>
    </div>
  );
}
