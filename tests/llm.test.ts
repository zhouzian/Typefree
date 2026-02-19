import { describe, it, expect } from 'vitest';
import { GroqLLM } from '../src/llm/groq';

describe('GroqLLM', () => {
  describe('constructor', () => {
    it('should create instance with API key', () => {
      const llm = new GroqLLM('test-api-key');
      expect(llm).toBeDefined();
    });

    it('should accept custom model', () => {
      const llm = new GroqLLM('test-api-key', 'llama-3.1-70b-versatile');
      expect(llm).toBeDefined();
    });

    it('should accept maxTokens parameter', () => {
      const llm = new GroqLLM('test-api-key', 'llama-3.3-70b-versatile', 2048);
      expect(llm).toBeDefined();
    });

    it('should accept preset parameter', () => {
      const llm = new GroqLLM('test-api-key', 'llama-3.3-70b-versatile', 1024, 'email');
      expect(llm).toBeDefined();
    });

    it('should use default model when not provided', () => {
      const llm = new GroqLLM('test-api-key');
      expect(llm).toBeDefined();
    });

    it('should use default maxTokens when not provided', () => {
      const llm = new GroqLLM('test-api-key');
      expect(llm).toBeDefined();
    });

    it('should use default preset when not provided', () => {
      const llm = new GroqLLM('test-api-key');
      expect(llm).toBeDefined();
    });
  });

  describe('setPreset', () => {
    it('should change preset to general', () => {
      const llm = new GroqLLM('test-api-key');
      llm.setPreset('general');
      expect(llm).toBeDefined();
    });

    it('should change preset to email', () => {
      const llm = new GroqLLM('test-api-key');
      llm.setPreset('email');
      expect(llm).toBeDefined();
    });

    it('should change preset to technical', () => {
      const llm = new GroqLLM('test-api-key');
      llm.setPreset('technical');
      expect(llm).toBeDefined();
    });

    it('should handle unknown preset gracefully', () => {
      const llm = new GroqLLM('test-api-key');
      llm.setPreset('unknown-preset');
      expect(llm).toBeDefined();
    });

    it('should allow preset changes multiple times', () => {
      const llm = new GroqLLM('test-api-key');
      llm.setPreset('email');
      llm.setPreset('technical');
      llm.setPreset('general');
      expect(llm).toBeDefined();
    });
  });

  describe('reorganize', () => {
    it('should return empty string for empty input', async () => {
      const llm = new GroqLLM('test-api-key');
      const result = await llm.reorganize('');
      expect(result).toBe('');
    });

    it('should return empty string for whitespace-only input', async () => {
      const llm = new GroqLLM('test-api-key');
      const result = await llm.reorganize('   \n\t  ');
      expect(result).toBe('');
    });

    it('should handle text with newlines', async () => {
      const llm = new GroqLLM('test-api-key');
      const text = 'Line one\nLine two\nLine three';
      const result = await llm.reorganize(text);
      expect(result).toBeDefined();
    });

    it('should handle text with special characters', async () => {
      const llm = new GroqLLM('test-api-key');
      const text = 'Special chars: @#$%^&*()';
      const result = await llm.reorganize(text);
      expect(result).toBeDefined();
    });

    it('should handle text with unicode characters', async () => {
      const llm = new GroqLLM('test-api-key');
      const text = 'Unicode: 你好世界 🌍 مرحبا';
      const result = await llm.reorganize(text);
      expect(result).toBeDefined();
    });

    it('should handle very long text', async () => {
      const llm = new GroqLLM('test-api-key');
      const text = 'a'.repeat(10000);
      const result = await llm.reorganize(text);
      expect(result).toBeDefined();
    });

    it('should handle text with only spaces', async () => {
      const llm = new GroqLLM('test-api-key');
      const result = await llm.reorganize('     ');
      expect(result).toBe('');
    });

    it('should handle text with only tabs', async () => {
      const llm = new GroqLLM('test-api-key');
      const result = await llm.reorganize('\t\t\t');
      expect(result).toBe('');
    });

    it('should handle text with only newlines', async () => {
      const llm = new GroqLLM('test-api-key');
      const result = await llm.reorganize('\n\n\n');
      expect(result).toBe('');
    });
  });
});
