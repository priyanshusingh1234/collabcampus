import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DetectSpamInputSchema = z.object({
  text: z.string().describe('The text content to analyze for spam.'),
});
export type DetectSpamInput = z.infer<typeof DetectSpamInputSchema>;

const DetectSpamOutputSchema = z.object({
  isSpam: z.boolean().describe('Whether or not the content is considered spam.'),
  reason: z
    .string()
    .describe('A brief explanation of why the content was flagged as spam (or not).'),
});
export type DetectSpamOutput = z.infer<typeof DetectSpamOutputSchema>;

export async function detectSpam(input: DetectSpamInput): Promise<DetectSpamOutput> {
  return detectSpamFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectSpamPrompt',
  input: { schema: DetectSpamInputSchema },
  output: { schema: DetectSpamOutputSchema },
  prompt: `You are an expert spam detection bot for a student collaboration platform called CollabCampus. Your job is to analyze user-submitted content and determine if it is spam.

Spam includes:
- Advertisements or promotional material unrelated to academic subjects.
- Gibberish or nonsensical text.
- Phishing links or malicious content.
- Inappropriate or irrelevant content for a student community.
- Repetitive, low-quality posts.

Legitimate content includes:
- Questions about academic subjects.
- Educational articles and tutorials.
- Discussions about programming, science, humanities, etc.
- Content containing links to collabcampus.com (and its subdomains) — such links should NOT be considered spam.

Analyze the following text and determine if it's spam. Provide a reason for your decision.

Content to analyze:
{{{text}}}`,
});

const detectSpamFlow = ai.defineFlow(
  {
    name: 'detectSpamFlow',
    inputSchema: DetectSpamInputSchema,
    outputSchema: DetectSpamOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
