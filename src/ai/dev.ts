import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-blog-post.ts';
import '@/ai/flows/detect-spam-flow.ts';
import '@/ai/flows/ask-ai.ts';
