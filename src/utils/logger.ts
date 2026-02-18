import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let logPath: string | null = null;

export function initLogger(): void {
  const isElectron = process.versions.electron;
  
  if (isElectron) {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    logPath = path.join(userDataPath, 'typefree.log');
  } else {
    logPath = path.join(os.homedir(), '.typefree', 'typefree.log');
  }
  
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  if (logPath) {
    try {
      fs.appendFileSync(logPath, line);
    } catch {
      // Silently fail if log can't be written
    }
  }
}

export function getLogPath(): string | null {
  return logPath;
}
