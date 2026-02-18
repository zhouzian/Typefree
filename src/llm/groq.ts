import Groq from 'groq-sdk';
import { LLMService } from './types';

const PRESETS: Record<string, string> = {
  none: '',
  general: `You are a text formatter. Transform the following voice transcript into clear text.
Rules:
1. Remove filler words and repetitions
2. Fix grammar while preserving meaning
3. Structure lists with numbers or bullets if appropriate
4. Keep the tone natural
5. Do NOT add information not present in the original
6. Output ONLY the reformatted text`,
  
  email: `You are an email formatter. Transform the following voice transcript into a professional email.
Rules:
1. Add appropriate greeting and sign-off
2. Remove filler words and repetitions
3. Structure into clear paragraphs
4. Keep the tone professional but natural
5. Do NOT add information not present in the original
6. Output ONLY the formatted email`,
  
  technical: `You are a text formatter for technical prompts. Transform the following voice transcript into a clear, concise prompt for a coding assistant or CLI tool.
Rules:
1. Remove conversational filler, hedging, and repetitions
2. Be direct and precise - prefer "Create a function" over "I want to create a function"
3. Preserve technical terms, file names, and code references exactly
4. Structure multi-step requests clearly with numbers or bullets
5. Keep the original intent, just make it clearer
6. Do NOT add information not present in the original
7. Output ONLY the reformatted text`
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

    if (this.preset === 'none') {
      return text;
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
            content: `Transcript: "${text}"`,
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