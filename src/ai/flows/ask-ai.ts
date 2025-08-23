"use server";

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const AskAiInputSchema = z.object({
  question: z.string().min(1).describe("The user's question or problem statement."),
  imageUrl: z.string().url().optional().describe("Optional image URL to provide visual context."),
});
export type AskAiInput = z.infer<typeof AskAiInputSchema>;

const AskAiOutputSchema = z.object({
  answer: z.string().describe("Helpful, step-by-step answer to the user's question."),
});
export type AskAiOutput = z.infer<typeof AskAiOutputSchema>;

const askAiFlow = ai.defineFlow(
  {
    name: "askAiFlow",
    inputSchema: AskAiInputSchema,
    outputSchema: AskAiOutputSchema,
  },
  async (input) => {
    // Build multimodal parts: text + optional image
    const parts: any[] = [
      {
        text:
          `You are a helpful developer assistant for students.
Provide a concise, actionable answer with clear steps and small code snippets when helpful.
If an image is provided, use it as visual context to better understand the problem.`,
      },
      { text: `Question: ${input.question}` },
    ];

    if (input.imageUrl) {
      parts.push({ media: { url: input.imageUrl } });
    }

    // Generate with the configured model (Gemini 2.0 Flash per genkit.ts)
  const result: any = await ai.generate(parts);

    const answer: string =
      result?.outputText ?? result?.text ?? result?.output?.text ?? String(result ?? "");

    return { answer };
  }
);

export async function askAI(input: AskAiInput): Promise<AskAiOutput> {
  return askAiFlow(input);
}
