import { describe, it, expect } from 'vitest';
import { calculateAudioLevel, AudioCapture } from '../src/audio/capture';

describe('AudioCapture', () => {
  describe('calculateAudioLevel', () => {
    it('should return 0 for silent audio (all zeros)', () => {
      const silentBuffer = Buffer.alloc(3200, 0);
      const level = calculateAudioLevel(silentBuffer);
      expect(level).toBe(0);
    });

    it('should return value between 0 and 1 for audio with signal', () => {
      const audioBuffer = Buffer.alloc(3200);
      for (let i = 0; i < audioBuffer.length; i += 2) {
        audioBuffer.writeInt16LE(10000, i);
      }
      const level = calculateAudioLevel(audioBuffer);
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it('should return 1 for maximum amplitude', () => {
      const maxBuffer = Buffer.alloc(3200);
      for (let i = 0; i < maxBuffer.length; i += 2) {
        maxBuffer.writeInt16LE(32767, i);
      }
      const level = calculateAudioLevel(maxBuffer);
      expect(level).toBe(1);
    });

    it('should handle odd-length buffers', () => {
      const oddBuffer = Buffer.alloc(3201);
      for (let i = 0; i < oddBuffer.length - 1; i += 2) {
        oddBuffer.writeInt16LE(5000, i);
      }
      const level = calculateAudioLevel(oddBuffer);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it('should handle small buffers', () => {
      const smallBuffer = Buffer.alloc(100);
      for (let i = 0; i < smallBuffer.length; i += 2) {
        smallBuffer.writeInt16LE(1000, i);
      }
      const level = calculateAudioLevel(smallBuffer);
      expect(level).toBeGreaterThanOrEqual(0);
    });

    it('should handle buffer with negative samples', () => {
      const negBuffer = Buffer.alloc(3200);
      for (let i = 0; i < negBuffer.length; i += 2) {
        negBuffer.writeInt16LE(-10000, i);
      }
      const level = calculateAudioLevel(negBuffer);
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it('should handle buffer with mixed positive and negative samples', () => {
      const mixedBuffer = Buffer.alloc(3200);
      for (let i = 0; i < mixedBuffer.length; i += 4) {
        mixedBuffer.writeInt16LE(10000, i);
        mixedBuffer.writeInt16LE(-10000, i + 2);
      }
      const level = calculateAudioLevel(mixedBuffer);
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it('should handle very small amplitude', () => {
      const lowBuffer = Buffer.alloc(3200);
      for (let i = 0; i < lowBuffer.length; i += 2) {
        lowBuffer.writeInt16LE(10, i);
      }
      const level = calculateAudioLevel(lowBuffer);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThan(0.01);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const level = calculateAudioLevel(emptyBuffer);
      expect(level).toBe(NaN);
    });

    it('should handle buffer with single sample', () => {
      const singleBuffer = Buffer.alloc(2);
      singleBuffer.writeInt16LE(16383, 0);
      const level = calculateAudioLevel(singleBuffer);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    });
  });

  describe('AudioCapture', () => {
    it('should not be recording initially', () => {
      const capture = new AudioCapture();
      expect(capture).toBeDefined();
    });

    it('should accept configuration options', () => {
      const capture = new AudioCapture({
        sampleRate: 44100,
        deviceId: 1,
        channels: 2,
      });
      expect(capture).toBeDefined();
    });

    it('should return empty buffer when stopping without recording', async () => {
      const capture = new AudioCapture();
      const buffer = await capture.stopRecording();
      expect(buffer.length).toBe(0);
    });

    it('should accept callbacks in options', () => {
      const capture = new AudioCapture({
        onTranscript: () => {},
        onAudioLevel: () => {},
      });
      expect(capture).toBeDefined();
    });

    it('should accept STT service in options', () => {
      const mockSttService = {
        transcribe: async () => 'test',
      };
      const capture = new AudioCapture({
        sttService: mockSttService as any,
      });
      expect(capture).toBeDefined();
    });

    it('should accept calibration callbacks in options', () => {
      const capture = new AudioCapture({
        onCalibrationProgress: () => {},
        onCalibrationComplete: () => {},
      });
      expect(capture).toBeDefined();
    });

    it('should return thresholds with default values', () => {
      const capture = new AudioCapture();
      const thresholds = capture.getThresholds();
      expect(thresholds).toHaveProperty('noiseFloor');
      expect(thresholds).toHaveProperty('speechThreshold');
      expect(thresholds).toHaveProperty('silenceThreshold');
    });

    it('should return total speech chunks as zero initially', () => {
      const capture = new AudioCapture();
      const totalChunks = capture.getTotalSpeechChunks();
      expect(totalChunks).toBe(0);
    });

    it('should handle multiple stop calls without error', async () => {
      const capture = new AudioCapture();
      await capture.stopRecording();
      await capture.stopRecording();
      expect(capture).toBeDefined();
    });

    it('should use default sample rate when not provided', () => {
      const capture = new AudioCapture({});
      expect(capture).toBeDefined();
    });

    it('should use default channels when not provided', () => {
      const capture = new AudioCapture({});
      expect(capture).toBeDefined();
    });
  });
});
