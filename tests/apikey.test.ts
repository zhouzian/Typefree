import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const realDataDir = path.join(os.homedir(), '.typefree');
const realEnvPath = path.join(realDataDir, '.env');
let envBackup: string | null = null;

describe('apikey', () => {
  let apikey: typeof import('../src/config/apikey');

  beforeEach(() => {
    vi.resetModules();
    
    if (fs.existsSync(realEnvPath)) {
      envBackup = fs.readFileSync(realEnvPath, 'utf-8');
    }
    
    delete process.versions.electron;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    
    if (envBackup !== null) {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, envBackup);
      envBackup = null;
    } else if (fs.existsSync(realEnvPath)) {
      fs.unlinkSync(realEnvPath);
    }
  });

  describe('getDataDir', () => {
    it('should return ~/.typefree when not in Electron', async () => {
      delete process.versions.electron;
      apikey = await import('../src/config/apikey');
      
      const dir = apikey.getDataDir();
      expect(dir).toBe(path.join(os.homedir(), '.typefree'));
    });
  });

  describe('getApiKeyPath', () => {
    it('should return path to .env file in data dir', async () => {
      apikey = await import('../src/config/apikey');
      
      const keyPath = apikey.getApiKeyPath();
      expect(keyPath).toContain('.env');
      expect(keyPath).toContain('.typefree');
    });
  });

  describe('loadApiKey', () => {
    it('should return null when no .env file exists', async () => {
      if (fs.existsSync(realEnvPath)) {
        fs.unlinkSync(realEnvPath);
      }
      
      apikey = await import('../src/config/apikey');
      
      const key = apikey.loadApiKey();
      expect(key).toBeNull();
    });

    it('should load API key from .env file', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'GROQ_API_KEY=gsk_test123\n');
      
      apikey = await import('../src/config/apikey');
      
      const key = apikey.loadApiKey();
      expect(key).toBe('gsk_test123');
    });

    it('should handle .env file without API key', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'OTHER_KEY=value\n');
      
      apikey = await import('../src/config/apikey');
      
      const key = apikey.loadApiKey();
      expect(key).toBeNull();
    });

    it('should handle .env file with multiple lines', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'OTHER_KEY=value\nGROQ_API_KEY=gsk_multiline\nANOTHER=key\n');
      
      apikey = await import('../src/config/apikey');
      
      const key = apikey.loadApiKey();
      expect(key).toBe('gsk_multiline');
    });

    it('should trim whitespace from API key', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'GROQ_API_KEY=gsk_whitespace  \n');
      
      apikey = await import('../src/config/apikey');
      
      const key = apikey.loadApiKey();
      expect(key).toBe('gsk_whitespace');
    });
  });

  describe('saveApiKey', () => {
    it('should create .env file if it does not exist', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      if (fs.existsSync(realEnvPath)) {
        fs.unlinkSync(realEnvPath);
      }
      
      apikey = await import('../src/config/apikey');
      
      apikey.saveApiKey('gsk_newkey');
      
      const savedContent = fs.readFileSync(realEnvPath, 'utf-8');
      expect(savedContent).toContain('GROQ_API_KEY=gsk_newkey');
    });

    it('should update existing API key in .env file', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'GROQ_API_KEY=gsk_old\n');
      
      apikey = await import('../src/config/apikey');
      apikey.saveApiKey('gsk_updated');
      
      const savedContent = fs.readFileSync(realEnvPath, 'utf-8');
      expect(savedContent).toContain('GROQ_API_KEY=gsk_updated');
      expect(savedContent).not.toContain('gsk_old');
    });

    it('should preserve other variables in .env file', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'OTHER_VAR=value\nGROQ_API_KEY=gsk_old\n');
      
      apikey = await import('../src/config/apikey');
      apikey.saveApiKey('gsk_new');
      
      const savedContent = fs.readFileSync(realEnvPath, 'utf-8');
      expect(savedContent).toContain('OTHER_VAR=value');
      expect(savedContent).toContain('GROQ_API_KEY=gsk_new');
    });

    it('should add API key to .env file without it', async () => {
      fs.mkdirSync(realDataDir, { recursive: true });
      fs.writeFileSync(realEnvPath, 'OTHER_VAR=value\n');
      
      apikey = await import('../src/config/apikey');
      apikey.saveApiKey('gsk_added');
      
      const savedContent = fs.readFileSync(realEnvPath, 'utf-8');
      expect(savedContent).toContain('GROQ_API_KEY=gsk_added');
      expect(savedContent).toContain('OTHER_VAR=value');
    });

    it('should create data directory if it does not exist', async () => {
      if (fs.existsSync(realDataDir)) {
        fs.rmSync(realDataDir, { recursive: true, force: true });
      }
      
      apikey = await import('../src/config/apikey');
      apikey.saveApiKey('gsk_mkdir');
      
      expect(fs.existsSync(realDataDir)).toBe(true);
      expect(fs.existsSync(realEnvPath)).toBe(true);
    });
  });
});
