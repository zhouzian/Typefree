import { log } from '../utils/logger';

export class TextOutput {
  private lastFrontmostApp: string | null = null;
  private lastFrontmostAppTime: number = 0;

  rememberFrontmostApp(): void {
    const { execSync } = require('child_process');
    const platform = process.platform;
    
    if (platform === 'darwin') {
      try {
        const result = execSync(`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`).toString().trim();
        this.lastFrontmostApp = result;
        this.lastFrontmostAppTime = Date.now();
      } catch (e) {
        log(`[TextOutput] Could not get frontmost app: ${e}`);
      }
    } else if (platform === 'win32') {
      try {
        const result = execSync('powershell -command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -First 1 -ExpandProperty ProcessName"').toString().trim();
        this.lastFrontmostApp = result;
        this.lastFrontmostAppTime = Date.now();
      } catch (e) {
        log(`[TextOutput] Could not get frontmost app: ${e}`);
      }
    }
  }

  async insertText(text: string): Promise<void> {
    if (!text || !text.trim()) {
      throw new Error('No text to insert');
    }

    log(`[TextOutput] Attempting to insert text: "${text.substring(0, 50)}..."`);

    const { exec, execSync } = require('child_process');
    const platform = process.platform;

    if (platform === 'darwin') {
      await this.insertMacOS(text, exec, execSync);
    } else if (platform === 'win32') {
      await this.insertWindows(text, exec);
    } else {
      throw new Error(`Unsupported platform: ${platform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
    }
  }

  private async insertMacOS(text: string, exec: Function, execSync: Function): Promise<void> {
    try {
      const { Clipboard } = require('@napi-rs/clipboard');
      const clipboard = new Clipboard();
      clipboard.setText(text);
      log('[TextOutput] Text copied to clipboard (macOS)');
      
      let targetApp = this.lastFrontmostApp;
      const timeSinceRemembered = Date.now() - this.lastFrontmostAppTime;
      
      if (!targetApp || timeSinceRemembered > 5000) {
        try {
          targetApp = execSync(`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`).toString().trim();
          log(`[TextOutput] Current frontmost app: "${targetApp}"`);
        } catch (e) {
          log(`[TextOutput] Could not get frontmost app: ${e}`);
        }
      }
      
      if (targetApp && targetApp !== 'Electron' && targetApp !== 'Typefree') {
        const script = `tell application "${targetApp}" to activate`;
        
        await new Promise<void>((resolve, reject) => {
          exec(`osascript -e '${script}'`, (err: Error | null) => {
            if (err) {
              log(`[TextOutput] Activate ${targetApp} failed: ${err}`);
              reject(err);
            } else {
              log(`[TextOutput] Activated ${targetApp}`);
              resolve();
            }
          });
        });
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const pasteScript = `tell application "System Events" to keystroke "v" using command down`;
        
        await new Promise<void>((resolve, reject) => {
          exec(`osascript -e '${pasteScript}'`, (err: Error | null, stdout: string, stderr: string) => {
            if (err) {
              log(`[TextOutput] Paste failed: ${err}, stderr: ${stderr}`);
              reject(err);
            } else {
              log(`[TextOutput] Pasted to ${targetApp}`);
              resolve();
            }
          });
        });
      } else {
        const pasteScript = `tell application "System Events" to keystroke "v" using command down`;
        
        await new Promise<void>((resolve, reject) => {
          exec(`osascript -e '${pasteScript}'`, (err: Error | null, stdout: string, stderr: string) => {
            if (err) {
              log(`[TextOutput] Paste failed: ${err}, stderr: ${stderr}`);
              reject(err);
            } else {
              log(`[TextOutput] Paste command sent`);
              resolve();
            }
          });
        });
      }
    } catch (error) {
      log(`[TextOutput] Clipboard approach failed: ${error}`);
      throw error;
    }
  }

  private async insertWindows(text: string, exec: Function): Promise<void> {
    try {
      const { Clipboard } = require('@napi-rs/clipboard');
      const clipboard = new Clipboard();
      clipboard.setText(text);
      log('[TextOutput] Text copied to clipboard (Windows)');
      
      let targetApp = this.lastFrontmostApp;
      const timeSinceRemembered = Date.now() - this.lastFrontmostAppTime;
      
      if (targetApp && timeSinceRemembered <= 5000 && targetApp !== 'Electron' && targetApp !== 'Typefree') {
        try {
          await new Promise<void>((resolve) => {
            exec(`powershell -command "(New-Object -ComObject WScript.Shell).AppActivate('${targetApp}')"`, (err: Error | null) => {
              if (err) {
                log(`[TextOutput] Activate ${targetApp} failed: ${err}`);
              } else {
                log(`[TextOutput] Activated ${targetApp}`);
              }
              resolve();
            });
          });
          
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (e) {
          log(`[TextOutput] Activate error: ${e}`);
        }
      }
      
      await new Promise<void>((resolve, reject) => {
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`, (err: Error | null) => {
          if (err) {
            log(`[TextOutput] Paste failed: ${err}`);
            reject(err);
          } else {
            log('[TextOutput] Paste command sent');
            resolve();
          }
        });
      });
    } catch (error: any) {
      log(`[TextOutput] Clipboard approach failed: ${error}`);
      throw error;
    }
  }
}
