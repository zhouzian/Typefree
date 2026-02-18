import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function getDataDir(): string {
  const isElectron = process.versions.electron;
  
  if (isElectron) {
    const { app } = require('electron');
    return app.getPath('userData');
  }
  
  return path.join(os.homedir(), '.typefree');
}

export function getApiKeyPath(): string {
  return path.join(getDataDir(), '.env');
}

export function loadApiKey(): string | null {
  const envPath = getApiKeyPath();
  console.log(`[Config] Loading API key from: ${envPath}`);
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^GROQ_API_KEY=(.+)$/);
      if (match) {
        console.log(`[Config] Found API key in file`);
        return match[1].trim();
      }
    }
  } else {
    console.log(`[Config] API key file does not exist at: ${envPath}`);
  }
  
  const oldEnvPath = path.join(os.homedir(), '.typefree', '.env');
  if (fs.existsSync(oldEnvPath) && !fs.existsSync(envPath)) {
    try {
      const newDir = path.dirname(envPath);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      fs.copyFileSync(oldEnvPath, envPath);
      console.log('[Config] Migrated API key from ~/.typefree/ to userData directory');
      
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const match = line.match(/^GROQ_API_KEY=(.+)$/);
        if (match) {
          return match[1].trim();
        }
      }
    } catch (err) {
      console.error('[Config] Failed to migrate API key:', err);
    }
  }
  
  return null;
}

export function saveApiKey(apiKey: string): void {
  const envPath = getApiKeyPath();
  const envDir = path.dirname(envPath);
  
  console.log(`[Config] Saving API key to: ${envPath}`);
  
  if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
    console.log(`[Config] Created directory: ${envDir}`);
  }
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  const lines = envContent.split('\n');
  let found = false;
  const updatedLines = lines.map(line => {
    if (line.startsWith('GROQ_API_KEY=')) {
      found = true;
      return `GROQ_API_KEY=${apiKey}`;
    }
    return line;
  });
  
  if (!found) {
    updatedLines.push(`GROQ_API_KEY=${apiKey}`);
  }
  
  const finalContent = updatedLines.join('\n');
  fs.writeFileSync(envPath, finalContent);
  console.log(`[Config] API key saved successfully`);
}
