'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DifficultySchema = z.enum(['easy', 'medium', 'hard']).describe('Overall difficulty for the quiz questions.');

const GenQuizInputSchema = z.object({
  topic: z.string().min(3).describe('Topic or subject to generate the quiz about.'),
  numQuestions: z.number().int().min(2).max(10).default(5).describe('Number of questions to generate (2-10).'),
  difficulty: DifficultySchema.default('medium'),
  sourceText: z.string().optional().describe('Optional source text to base questions on.'),
  category: z.string().optional().describe('Optional category label (e.g., Geography, History).'),
});
export type GenQuizInput = z.infer<typeof GenQuizInputSchema>;

const GenQuizQuestionSchema = z.object({
  text: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(6),
  answerIndex: z.number().int().min(0),
  explanation: z.string().optional(),
});

const GenQuizOutputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(GenQuizQuestionSchema).min(2),
});
export type GenQuizOutput = z.infer<typeof GenQuizOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: { schema: GenQuizInputSchema },
  output: { schema: GenQuizOutputSchema },
  prompt: `You are an expert quiz maker.
Create a multiple-choice quiz in JSON strictly matching the output schema.

Requirements:
- Return exactly {{numQuestions}} questions.
- Each question must have 3-5 choices with exactly one correct answer.
- Put the correct answer's index in answerIndex (0-based).
- Prefer clear, short questions. Avoid ambiguous wording.
- If sourceText is provided, derive questions from it; otherwise use general knowledge about the topic.
- Difficulty should reflect {{difficulty}} and cover subtopics in {{topic}}.

Optional category: {{category}}
Optional source text (may be long): {{{sourceText}}}

Output only valid JSON conforming to the required schema.`,
});

export const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenQuizInputSchema,
    outputSchema: GenQuizOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function generateQuiz(input: GenQuizInput): Promise<GenQuizOutput> {
  return generateQuizFlow(input);
}
