"use server";

// Server Actions module: safe to import from client components; Next will RPC calls under the hood.

// This is a server action that can be called from client components.
export async function getAiSummary(blogPostContent: string) {
  const { summarizeBlogPost } = await import("@/ai/flows/summarize-blog-post");
  try {
    const result = await summarizeBlogPost({ blogPostContent });
    if (!result.summary) {
        return { summary: null, error: 'Failed to generate summary. The AI returned an empty result.' };
    }
    return { summary: result.summary, error: null };
  } catch (error) {
    console.error("AI summary failed:", error);
    // Return a generic error message to the client for security.
    return { summary: null, error: "An unexpected error occurred while generating the summary." };
  }
}

export async function checkForSpam(text: string) {
  const { detectSpam } = await import("@/ai/flows/detect-spam-flow");
    try {
        const result = await detectSpam({ text });
        return { isSpam: result.isSpam, reason: result.reason, error: null };
    } catch (error) {
        console.error("Spam detection failed:", error);
        // Fail open (assume not spam) if the detector fails, to avoid blocking legitimate users.
        return { isSpam: false, reason: "Detector failed", error: "An unexpected error occurred during spam check." };
    }
}

export async function getSuggestedTags(input: { text: string; kind?: 'post' | 'answer'; maxTags?: number }) {
  const { suggestTagsFlow } = await import("@/ai/flows/suggest-tags");
  try {
    const res = await suggestTagsFlow({ text: input.text, kind: input.kind ?? 'post', maxTags: input.maxTags ?? 6 });
    return { tags: res.tags, error: null };
  } catch (error) {
    console.error('Tag suggestion failed:', error);
    return { tags: [], error: 'Failed to suggest tags' };
  }
}
