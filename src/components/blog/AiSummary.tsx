"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAiSummary } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface AiSummaryProps {
  blogPostContent: string;
}

export function AiSummary({ blogPostContent }: AiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    const result = await getAiSummary(blogPostContent);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      toast({
        variant: "destructive",
        title: "AI Summary Failed",
        description: result.error,
      });
    } else if (result.summary) {
      setSummary(result.summary);
    }
  };

  return (
    <div className="my-6 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-headline text-primary/90">AI-Powered Summary</h3>
        </div>
        {!summary && !isLoading && (
          <Button onClick={handleGenerateSummary} size="sm" variant="outline" className="bg-background">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Brewing a summary for you...
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="prose prose-base dark:prose-invert max-w-none text-foreground/80">
          <blockquote className="border-l-primary not-prose">
            <p>{summary}</p>
          </blockquote>
        </div>
      )}
    </div>
  );
}
