import Groq from 'groq-sdk';
import { LLMService } from './types';

const PRESETS: Record<string, string> = {
  general: `You are a text editor. Clean up the following voice transcript with MINIMAL changes.
Rules:
1. Remove only obvious filler words like "um", "uh", "like", "you know"
2. Fix obvious grammar mistakes
3. DO NOT restructure, summarize, or rewrite sentences
4. DO NOT remove any meaningful content
5. Preserve the exact words and phrases the speaker used
6. Output ONLY the cleaned text`,
  
  email: `You are a text editor. Adjust the following voice transcript to have a slightly more professional tone with MINIMAL changes.
Rules:
1. Remove only obvious filler words like "um", "uh", "like", "you know"
2. Fix obvious grammar mistakes
3. Adjust tone slightly to be more professional (e.g., "gonna" → "going to")
4. DO NOT restructure, summarize, or rewrite sentences
5. DO NOT add greeting, sign-off, or any new content
6. DO NOT remove any meaningful content
7. Output ONLY the adjusted text`,
  
  technical: `You are a text editor. Clean up the following voice transcript for technical clarity with MINIMAL changes.
Rules:
1. Remove only obvious filler words like "um", "uh", "like", "you know"
2. Fix obvious grammar mistakes
3. Keep technical terms, file names, and code references exactly as spoken
4. DO NOT restructure, summarize, or rewrite sentences
5. DO NOT remove any meaningful content
6. DO NOT change "I want to" to imperative form
7. Output ONLY the cleaned text`
};

export class GroqLLM implements LLMService {
  private client: Groq;
  private model: string;
  private maxTokens: number;
  private preset: string;

  constructor(apiKey: string, model?: string, maxTokens?: number, preset?: string) {
    this.client = new Groq({ apiKey });
    this.model = model || 'llama-3.3-70b-versatile';
    this.maxTokens = maxTokens || 1024;
    this.preset = preset || 'general';
  }

  setPreset(preset: string): void {
    this.preset = preset;
  }

  async reorganize(text: string): Promise<string> {
    if (!text.trim()) {
      return '';
    }

    const systemPrompt = PRESETS[this.preset] || PRESETS.general;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      const result = response.choices[0]?.message?.content?.trim();
      return result || text;
    } catch (error) {
      console.error('Groq LLM error:', error);
      return text;
    }
  }
}