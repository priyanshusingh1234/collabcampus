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
  prompt: `You are a social media content moderation assistant for a general-purpose community app called Manthan. Analyze a user post and decide if it is spam or abusive.

Flag as spam/abuse if any of the following apply:
- Scam, phishing, impersonation, or malware links.
- Unsolicited promotions, affiliate/referral drops, coupon/crypto/"DM me" schemes.
- Mass-posted or repetitive low-effort content (copypasta, keyword stuffing, AI gibberish).
- Adult or explicit sexual content; sexual solicitation.
- Hate speech, threats, or targeted harassment.
- Doxxing or sharing private personal data without consent.

Usually NOT spam:
- Normal social updates, opinions, event invites, or personal milestones.
- Constructive help requests or tips.
- Links to trusted hosts already allowed by the app (first-party media/CDN) when relevant.

Rules:
- If unsure, prefer not flagging unless a clear policy is violated.
- Short posts (e.g., "nice", "lol") are fine unless they include promotions or links.
- Consider link reputation. URL shorteners + salesy language => likely spam.

Return concise output.

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
