const getGlobalShortcut = () => {
  try {
    return require('electron').globalShortcut;
  } catch {
    return null;
  }
};

import { log } from '../utils/logger';

export interface HotkeyOptions {
  hotkey?: string;
  onKeyDown?: () => void;
  onKeyUp?: () => void;
  onRawKey?: (keyName: string, state: 'DOWN' | 'UP') => void;
}

type KeyHandler = () => void;

export class HotkeyManager {
  private hotkey: string;
  private onKeyDown?: () => void;
  private onKeyUp?: () => void;
  private onRawKey?: (keyName: string, state: 'DOWN' | 'UP') => void;
  private isPressed: boolean = false;
  private isRunning: boolean = false;
  private additionalHandlers: Map<string, KeyHandler> = new Map();
  private releaseCheckInterval: NodeJS.Timeout | null = null;
  private lastKeyPressTime: number = 0;

  constructor(options: HotkeyOptions = {}) {
    this.hotkey = options.hotkey || 'RightAlt';
    this.onKeyDown = options.onKeyDown;
    this.onKeyUp = options.onKeyUp;
    this.onRawKey = options.onRawKey;
  }

  isEnabled(): boolean {
    return this.isRunning;
  }

  start(): boolean {
    if (this.isRunning) {
      this.stop();
    }

    const globalShortcut = getGlobalShortcut();
    if (!globalShortcut) {
      log('[Hotkey] globalShortcut not available (not in Electron context)');
      return false;
    }

    try {
      const accelerator = this.convertToAccelerator(this.hotkey);
      log(`[Hotkey] Registering global shortcut: ${accelerator}`);

      const success = globalShortcut.register(accelerator, () => {
        log(`[Hotkey] Global shortcut triggered: ${accelerator}`);
        this.onRawKey?.(this.hotkey, 'DOWN');
        this.onKeyDown?.();
      });

      if (!success) {
        log(`[Hotkey] Failed to register shortcut: ${accelerator}`);
        return false;
      }

      this.isRunning = true;
      log(`[Hotkey] Global shortcut registered successfully: ${accelerator}`);
      return true;
    } catch (error) {
      log(`[Hotkey] Failed to start hotkey listener: ${error}`);
      console.error('Failed to start hotkey listener:', error);
      return false;
    }
  }

  restart(): void {
    log('[Hotkey] Restarting hotkey listener...');
    this.stop();
    this.start();
  }

  addKeyListener(key: string, handler: KeyHandler): void {
    const keyUpper = key.toUpperCase();
    this.additionalHandlers.set(keyUpper, handler);
  }

  removeKeyListener(key: string): void {
    const keyUpper = key.toUpperCase();
    this.additionalHandlers.delete(keyUpper);
  }

  private convertToAccelerator(hotkey: string): string {
    const isMac = process.platform === 'darwin';
    const altKey = isMac ? 'Option' : 'Alt';
    
    const modifierMap: Record<string, string> = {
      'RIGHT_ALT': altKey,
      'LEFT_ALT': altKey,
      'RIGHT_OPTION': 'Option',
      'LEFT_OPTION': 'Option',
      'RIGHT_CTRL': 'Control',
      'LEFT_CTRL': 'Control',
      'RIGHT_SHIFT': 'Shift',
      'LEFT_SHIFT': 'Shift',
      'RIGHT_META': 'Command',
      'LEFT_META': 'Command',
      'ALT': altKey,
      'OPTION': 'Option',
      'CONTROL': 'Control',
      'SHIFT': 'Shift',
      'COMMAND': 'Command',
    };

    if (hotkey.includes('+')) {
      const parts = hotkey.split('+');
      const modifier = parts[0];
      const key = parts[1];
      const mappedModifier = modifierMap[modifier.toUpperCase()] || modifier;
      return `${mappedModifier}+${key.toUpperCase()}`;
    }

    const upperHotkey = hotkey.toUpperCase();
    if (modifierMap[upperHotkey]) {
      return `${modifierMap[upperHotkey]}+Z`;
    }
    
    return hotkey;
  }

  stop(): void {
    const globalShortcut = getGlobalShortcut();
    if (globalShortcut) {
      try {
        globalShortcut.unregisterAll();
      } catch (error) {
        console.error('Failed to stop hotkey listener:', error);
      }
    }
    
    if (this.releaseCheckInterval) {
      clearInterval(this.releaseCheckInterval);
      this.releaseCheckInterval = null;
    }
    
    this.isRunning = false;
    this.isPressed = false;
    this.lastKeyPressTime = 0;
    this.additionalHandlers.clear();
  }

  setHotkey(hotkey: string): void {
    this.hotkey = hotkey;
  }
}
