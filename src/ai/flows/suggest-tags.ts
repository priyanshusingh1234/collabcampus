'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestTagsInputSchema = z.object({
  text: z.string().describe('The combined text (title + content or answer text) to analyze.'),
  maxTags: z.number().min(1).max(10).default(6).describe('Maximum number of tags to return.'),
  kind: z.enum(['post', 'answer']).default('post').describe('Content kind for better guidance.'),
});
export type SuggestTagsInput = z.infer<typeof SuggestTagsInputSchema>;

const SuggestTagsOutputSchema = z.object({
  tags: z.array(z.string()).describe('List of concise tags/skills.'),
});
export type SuggestTagsOutput = z.infer<typeof SuggestTagsOutputSchema>;

export async function suggestTagsFlow(input: SuggestTagsInput): Promise<SuggestTagsOutput> {
  return suggestTags(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTagsPrompt',
  input: { schema: SuggestTagsInputSchema },
  output: { schema: SuggestTagsOutputSchema },
  prompt: `You are a tagging assistant for a student collaboration platform.
Given the following {{kind}} text, extract between 3 and {{maxTags}} concise, human-friendly tags/skills/topics.

Rules:
- Prefer academic and technical topics (e.g., 'javascript', 'react hooks', 'data structures', 'machine learning').
- Keep each tag short (1-3 words) and readable (no hashtags).
- Lowercase; avoid duplicates; no punctuation except hyphens.
- Do not invent niche jargon; prefer widely-recognized terms.

Text:
{{{text}}}

Return only the tags array with no explanations.`,
});

const suggestTags = ai.defineFlow(
  {
    name: 'suggestTagsFlow',
    inputSchema: SuggestTagsInputSchema,
    outputSchema: SuggestTagsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
