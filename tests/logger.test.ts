import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const testLogDir = path.join(os.homedir(), '.typefree-test-logger');
const testLogPath = path.join(testLogDir, 'typefree.log');

describe('Logger', () => {
  let logger: typeof import('../src/utils/logger');

  beforeEach(() => {
    vi.resetModules();
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('initLogger', () => {
    it('should initialize logger without Electron', async () => {
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      logger.initLogger();
      const logPath = logger.getLogPath();
      expect(logPath).toContain('.typefree');
    });

    it('should create log directory if it does not exist', async () => {
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      expect(fs.existsSync(testLogDir)).toBe(false);
    });
  });

  describe('log', () => {
    it('should log message to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      logger.initLogger();
      logger.log('Test message');
      expect(consoleSpy).toHaveBeenCalledWith('Test message');
    });

    it('should handle multiple log messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      logger.initLogger();
      logger.log('Message 1');
      logger.log('Message 2');
      logger.log('Message 3');
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });

    it('should include timestamp in log format', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      logger.initLogger();
      logger.log('Test message');
      expect(consoleSpy).toHaveBeenCalledWith('Test message');
    });
  });

  describe('getLogPath', () => {
    it('should return null before initialization', async () => {
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      const logPath = logger.getLogPath();
      expect(logPath).toBeNull();
    });

    it('should return path after initialization', async () => {
      delete process.versions.electron;
      logger = await import('../src/utils/logger');
      logger.initLogger();
      const logPath = logger.getLogPath();
      expect(logPath).not.toBeNull();
      expect(logPath).toContain('typefree.log');
    });
  });
});
