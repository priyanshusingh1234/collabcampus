// app/ask/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ask a Question - CollabCampus',
  description: 'Ask your questions and get help from the CollabCampus community.',
  openGraph: {
    title: 'Ask a Question - CollabCampus',
    description: 'Ask your questions and get help from the CollabCampus community.',
    url: 'https://collabcampus.com/ask',
    siteName: 'CollabCampus',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ask a Question - CollabCampus',
    description: 'Ask your questions and get help from the CollabCampus community.',
  },
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AskQuestionForm } from "@/components/questions/AskQuestionForm";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function AskQuestionPage() {
  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Ask a Public Question</CardTitle>
          <CardDescription>
            Get unstuck by asking the community. Be specific and imagine you’re asking a question to another person.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequireAuth>
            <AskQuestionForm />
          </RequireAuth>
        </CardContent>
      </Card>
    </div>
  );
}
