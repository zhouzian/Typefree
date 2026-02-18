import Groq from 'groq-sdk';
import { STTService } from './types';

export class GroqSTT implements STTService {
  private client: Groq;
  private model: string;
  private language: string;

  constructor(apiKey: string, model?: string, language?: string) {
    this.client = new Groq({ apiKey });
    this.model = model || 'whisper-large-v3-turbo';
    this.language = language || 'auto';
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    try {
      const uint8Array = new Uint8Array(audioBuffer);
      const blob = new Blob([uint8Array], { type: 'audio/wav' });
      const file = new File([blob], 'audio.wav', { type: 'audio/wav' });

      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.model,
        language: this.language === 'auto' ? undefined : this.language,
        response_format: 'json',
      });

      return response.text.trim();
    } catch (error) {
      console.error('Groq STT error:', error);
      throw error;
    }
  }
}
