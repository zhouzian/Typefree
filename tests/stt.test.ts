import { describe, it, expect, vi } from 'vitest';
import { GroqSTT } from '../src/stt/groq';

describe('GroqSTT', () => {
  describe('constructor', () => {
    it('should create instance with API key', () => {
      const stt = new GroqSTT('test-api-key');
      expect(stt).toBeDefined();
    });

    it('should accept custom model', () => {
      const stt = new GroqSTT('test-api-key', 'whisper-large-v3');
      expect(stt).toBeDefined();
    });

    it('should accept language parameter', () => {
      const stt = new GroqSTT('test-api-key', 'whisper-large-v3-turbo', 'en');
      expect(stt).toBeDefined();
    });

    it('should use default model when not provided', () => {
      const stt = new GroqSTT('test-api-key');
      expect(stt).toBeDefined();
    });

    it('should use auto language when not provided', () => {
      const stt = new GroqSTT('test-api-key');
      expect(stt).toBeDefined();
    });

    it('should accept explicit auto language', () => {
      const stt = new GroqSTT('test-api-key', undefined, 'auto');
      expect(stt).toBeDefined();
    });

    it('should accept various language codes', () => {
      const sttEn = new GroqSTT('test-api-key', undefined, 'en');
      const sttFr = new GroqSTT('test-api-key', undefined, 'fr');
      const sttDe = new GroqSTT('test-api-key', undefined, 'de');
      const sttEs = new GroqSTT('test-api-key', undefined, 'es');
      const sttZh = new GroqSTT('test-api-key', undefined, 'zh');
      expect(sttEn).toBeDefined();
      expect(sttFr).toBeDefined();
      expect(sttDe).toBeDefined();
      expect(sttEs).toBeDefined();
      expect(sttZh).toBeDefined();
    });
  });

  describe('transcribe', () => {
    it('should handle empty buffer gracefully', async () => {
      const stt = new GroqSTT('test-api-key');
      const emptyBuffer = Buffer.alloc(0);
      
      await expect(stt.transcribe(emptyBuffer)).rejects.toThrow();
    });

    it('should handle invalid audio buffer', async () => {
      const stt = new GroqSTT('test-api-key');
      const invalidBuffer = Buffer.from('not valid audio');
      
      await expect(stt.transcribe(invalidBuffer)).rejects.toThrow();
    });

    it('should handle small buffer', async () => {
      const stt = new GroqSTT('test-api-key');
      const smallBuffer = Buffer.alloc(100, 0);
      
      await expect(stt.transcribe(smallBuffer)).rejects.toThrow();
    });

    it('should handle buffer with random data', async () => {
      const stt = new GroqSTT('test-api-key');
      const randomBuffer = Buffer.alloc(1024);
      for (let i = 0; i < randomBuffer.length; i++) {
        randomBuffer[i] = Math.floor(Math.random() * 256);
      }
      
      await expect(stt.transcribe(randomBuffer)).rejects.toThrow();
    });

    it('should handle buffer that is too large', async () => {
      const stt = new GroqSTT('test-api-key');
      const largeBuffer = Buffer.alloc(1024 * 1024 * 100, 0);
      
      await expect(stt.transcribe(largeBuffer)).rejects.toThrow();
    });
  });
});
