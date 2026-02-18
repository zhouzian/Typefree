import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { log } from './logger';

function getSoundPath(type: 'start' | 'end'): string {
  const soundsDir = path.join(__dirname, '../assets/sounds');
  let soundPath = path.join(soundsDir, `${type}.wav`);
  
  if (!fs.existsSync(soundPath) && process.resourcesPath) {
    soundPath = path.join(process.resourcesPath, 'assets/sounds', `${type}.wav`);
  }
  
  return soundPath;
}

export function playSound(type: 'start' | 'end'): void {
  const soundFile = getSoundPath(type);
  
  if (!fs.existsSync(soundFile)) {
    log(`[Audio] Sound file not found: ${soundFile}`);
    return;
  }

  const platform = process.platform;
  let cmd: string;
  
  if (platform === 'darwin') {
    cmd = `afplay "${soundFile}"`;
  } else if (platform === 'win32') {
    cmd = `powershell -c "(New-Object Media.SoundPlayer '${soundFile}').PlaySync()"`;
  } else {
    log(`[Audio] Unsupported platform: ${platform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
    return;
  }
  
  exec(cmd, (error) => {
    if (error) {
      log(`[Audio] Failed to play sound: ${error.message}`);
    }
  });
}
