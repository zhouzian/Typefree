import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { log } from './logger';

export function playSound(type: 'start' | 'end'): void {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    const soundsDir = path.join(__dirname, '../assets/sounds');
    const soundPath = path.join(soundsDir, `${type}.wav`);
    
    if (!fs.existsSync(soundPath)) {
      log(`[Audio] Sound file not found: ${soundPath}`);
      return;
    }
    
    exec(`afplay "${soundPath}"`, (error) => {
      if (error) {
        log(`[Audio] Failed to play sound: ${error.message}`);
      }
    });
  } else if (platform === 'win32') {
    // For Windows, extract the sound file from app.asar to temp folder first because
    // PowerShell Media.SoundPlayer can't read directly from asar archives
    const tempDir = require('os').tmpdir();
    const targetPath = path.join(tempDir, `typefree-${type}.wav`);
    
    // Determine source path - from log we know it's in:
    // __dirname (app.asar/dist/utils) + /../assets/sounds
    const sourcePath = path.join(__dirname, '../assets/sounds', `${type}.wav`);
    
    try {
      // Copy sound file from asar to temp
      if (fs.existsSync(sourcePath)) {
        const soundData = fs.readFileSync(sourcePath);
        fs.writeFileSync(targetPath, soundData);
      } else {
        log(`[Audio] Sound file not found at source: ${sourcePath}`);
        return;
      }
      
      // Now play it from temp
      const cmd = `powershell -c "(New-Object Media.SoundPlayer '${targetPath}').PlaySync()"`;
      exec(cmd, (error) => {
        // Clean up temp file
        try {
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
        } catch (cleanupError) {
          log(`[Audio] Failed to delete temp sound file: ${cleanupError}`);
        }
        
        if (error) {
          log(`[Audio] Failed to play sound: ${error.message}`);
        }
      });
    } catch (copyError) {
      log(`[Audio] Failed to copy sound file to temp: ${copyError}`);
    }
  } else {
    log(`[Audio] Unsupported platform: ${platform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
    return;
  }
}