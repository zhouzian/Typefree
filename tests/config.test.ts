import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/config/manager';
import { DEFAULT_CONFIG } from '../src/config/defaults';

describe('ConfigManager', () => {
  const realConfigDir = path.join(os.homedir(), '.typefree');
  const realConfigPath = path.join(realConfigDir, 'config.json');
  let realConfigBackup: string | null = null;

  beforeEach(() => {
    vi.resetModules();
    if (fs.existsSync(realConfigPath)) {
      realConfigBackup = fs.readFileSync(realConfigPath, 'utf-8');
      fs.unlinkSync(realConfigPath);
    }
    if (fs.existsSync(realConfigDir)) {
      fs.rmSync(realConfigDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (realConfigBackup !== null && fs.existsSync(realConfigDir)) {
      fs.writeFileSync(realConfigPath, realConfigBackup);
    }
    realConfigBackup = null;
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have default hotkey', () => {
      expect(DEFAULT_CONFIG.hotkey?.key).toBe('');
    });

    it('should have default audio settings', () => {
      expect(DEFAULT_CONFIG.audio?.sampleRate).toBe(16000);
      expect(DEFAULT_CONFIG.audio?.channels).toBe(1);
    });

    it('should have default STT settings', () => {
      expect(DEFAULT_CONFIG.stt?.provider).toBe('groq');
      expect(DEFAULT_CONFIG.stt?.model).toBe('whisper-large-v3-turbo');
      expect(DEFAULT_CONFIG.stt?.language).toBe('auto');
    });

    it('should have default LLM settings', () => {
      expect(DEFAULT_CONFIG.llm?.provider).toBe('groq');
      expect(DEFAULT_CONFIG.llm?.enabled).toBe(true);
    });

    it('should have default overlay settings', () => {
      expect(DEFAULT_CONFIG.overlay?.width).toBe(600);
      expect(DEFAULT_CONFIG.overlay?.maxHeight).toBe(200);
    });

    it('should have default feedback settings', () => {
      expect(DEFAULT_CONFIG.feedback?.soundOnRecord).toBe(false);
    });

    it('should have default LLM preset', () => {
      expect(DEFAULT_CONFIG.llm?.preset).toBe('general');
    });

    it('should have default VAD settings', () => {
      expect(DEFAULT_CONFIG.audio?.vad?.type).toBe('webrtc');
      expect(DEFAULT_CONFIG.audio?.vad?.silenceDurationMs).toBe(2000);
    });

    it('should have default audio deviceId as null', () => {
      expect(DEFAULT_CONFIG.audio?.deviceId).toBeNull();
    });

    it('should have default overlay position', () => {
      expect(DEFAULT_CONFIG.overlay?.position).toBe('bottom-center');
    });
  });

  describe('ConfigManager', () => {
    it('should create instance', () => {
      const manager = new ConfigManager();
      expect(manager).toBeDefined();
    });

    it('should return config after load', async () => {
      const manager = new ConfigManager();
      const config = await manager.load();
      expect(config).toBeDefined();
      expect(config.hotkey?.key).toBe('');
    });

    it('should return config from getConfig', async () => {
      const manager = new ConfigManager();
      await manager.load();
      const config = manager.getConfig();
      expect(config).toBeDefined();
    });

    it('should update config', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ hotkey: { key: 'LEFT_ALT' } });
      const config = manager.getConfig();
      expect(config.hotkey?.key).toBe('LEFT_ALT');
    });

    it('should update nested config', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ audio: { sampleRate: 44100 } });
      const config = manager.getConfig();
      expect(config.audio?.sampleRate).toBe(44100);
      expect(config.audio?.channels).toBe(1);
    });

    it('should preserve existing config when updating', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ hotkey: { key: 'LEFT_ALT' } });
      manager.updateConfig({ audio: { sampleRate: 44100 } });
      const config = manager.getConfig();
      expect(config.hotkey?.key).toBe('LEFT_ALT');
      expect(config.audio?.sampleRate).toBe(44100);
    });

    it('should return config path', () => {
      const manager = new ConfigManager();
      const configPath = manager.getConfigPath();
      expect(configPath).toContain('.typefree');
      expect(configPath).toContain('config.json');
    });

    it('should save config', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ hotkey: { key: 'LEFT_ALT' } });
      await manager.save();
      expect(manager).toBeDefined();
    });

    it('should handle multiple updateConfig calls', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ hotkey: { key: 'LEFT_ALT' } });
      manager.updateConfig({ hotkey: { key: 'RIGHT_OPTION' } });
      manager.updateConfig({ llm: { preset: 'technical' } });
      const config = manager.getConfig();
      expect(config.hotkey?.key).toBe('RIGHT_OPTION');
      expect(config.llm?.preset).toBe('technical');
    });

    it('should handle deep nested updates', async () => {
      const manager = new ConfigManager();
      await manager.load();
      manager.updateConfig({ 
        audio: { 
          vad: { 
            silenceDurationMs: 2000 
          } 
        } 
      });
      const config = manager.getConfig();
      expect(config.audio?.vad?.silenceDurationMs).toBe(2000);
      expect(config.audio?.vad?.type).toBe('webrtc');
    });

    it('should load default config when no file exists', async () => {
      const manager = new ConfigManager();
      const config = await manager.load();
      expect(config.hotkey?.key).toBe('');
      expect(config.audio?.sampleRate).toBe(16000);
    });
  });
});
