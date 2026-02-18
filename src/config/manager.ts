import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppConfig, DEFAULT_CONFIG } from './defaults';

function getDataDir(): string {
  const isElectron = process.versions.electron;
  
  if (isElectron) {
    const { app } = require('electron');
    return app.getPath('userData');
  }
  
  return path.join(os.homedir(), '.typefree');
}

function getOldConfigPath(): string {
  return path.join(os.homedir(), '.typefree', 'config.json');
}

function migrateFromOldLocation(newConfigPath: string): void {
  const oldConfigPath = getOldConfigPath();
  
  if (fs.existsSync(oldConfigPath) && !fs.existsSync(newConfigPath)) {
    try {
      const newConfigDir = path.dirname(newConfigPath);
      if (!fs.existsSync(newConfigDir)) {
        fs.mkdirSync(newConfigDir, { recursive: true });
      }
      
      fs.copyFileSync(oldConfigPath, newConfigPath);
      console.log('[Config] Migrated config from ~/.typefree/ to userData directory');
    } catch (err) {
      console.error('[Config] Failed to migrate config:', err);
    }
  }
}

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const configDir = getDataDir();
    this.configPath = path.join(configDir, 'config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  async load(): Promise<AppConfig> {
    try {
      migrateFromOldLocation(this.configPath);
      
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        this.config = this.mergeWithDefaults(loaded);
      } else {
        await this.save();
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  async save(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = this.deepMerge(this.config, updates);
  }

  private mergeWithDefaults(loaded: Partial<AppConfig>): AppConfig {
    return this.deepMerge(DEFAULT_CONFIG, loaded);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
