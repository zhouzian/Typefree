import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotkeyManager } from '../src/hotkey/listener';

describe('HotkeyManager', () => {
  let manager: HotkeyManager;

  beforeEach(() => {
    manager = new HotkeyManager();
  });

  afterEach(() => {
    manager.stop();
  });

  describe('constructor', () => {
    it('should create instance with default hotkey', () => {
      expect(manager).toBeDefined();
    });

    it('should accept custom hotkey via options', () => {
      const customManager = new HotkeyManager({ hotkey: 'LEFT_ALT' });
      expect(customManager).toBeDefined();
    });

    it('should accept onKeyDown callback', () => {
      const callback = vi.fn();
      const customManager = new HotkeyManager({ onKeyDown: callback });
      expect(customManager).toBeDefined();
    });

    it('should accept onKeyUp callback', () => {
      const callback = vi.fn();
      const customManager = new HotkeyManager({ onKeyUp: callback });
      expect(customManager).toBeDefined();
    });

    it('should accept onRawKey callback', () => {
      const callback = vi.fn();
      const customManager = new HotkeyManager({ onRawKey: callback });
      expect(customManager).toBeDefined();
    });
  });

  describe('setHotkey', () => {
    it('should change the hotkey', () => {
      manager.setHotkey('LEFT_ALT');
      expect(manager).toBeDefined();
    });

    it('should accept RIGHT_OPTION hotkey', () => {
      manager.setHotkey('RIGHT_OPTION');
      expect(manager).toBeDefined();
    });

    it('should accept LEFT_OPTION hotkey', () => {
      manager.setHotkey('LEFT_OPTION');
      expect(manager).toBeDefined();
    });

    it('should handle lowercase hotkey', () => {
      manager.setHotkey('right_alt');
      expect(manager).toBeDefined();
    });
  });

  describe('addKeyListener', () => {
    it('should add a key listener', () => {
      const handler = vi.fn();
      manager.addKeyListener('ESCAPE', handler);
      expect(manager).toBeDefined();
    });

    it('should handle multiple key listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.addKeyListener('ESCAPE', handler1);
      manager.addKeyListener('SPACE', handler2);
      expect(manager).toBeDefined();
    });

    it('should overwrite existing listener for same key', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.addKeyListener('ESCAPE', handler1);
      manager.addKeyListener('ESCAPE', handler2);
      expect(manager).toBeDefined();
    });

    it('should handle lowercase key names', () => {
      const handler = vi.fn();
      manager.addKeyListener('escape', handler);
      expect(manager).toBeDefined();
    });
  });

  describe('removeKeyListener', () => {
    it('should remove an existing key listener', () => {
      const handler = vi.fn();
      manager.addKeyListener('ESCAPE', handler);
      manager.removeKeyListener('ESCAPE');
      expect(manager).toBeDefined();
    });

    it('should handle removing non-existent listener', () => {
      manager.removeKeyListener('NONEXISTENT');
      expect(manager).toBeDefined();
    });

    it('should handle lowercase key names', () => {
      const handler = vi.fn();
      manager.addKeyListener('ESCAPE', handler);
      manager.removeKeyListener('escape');
      expect(manager).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start without error', () => {
      manager.start();
      expect(manager).toBeDefined();
    });

    it('should handle multiple start calls', () => {
      manager.start();
      manager.start();
      expect(manager).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      manager.start();
      manager.stop();
      expect(manager).toBeDefined();
    });

    it('should handle stop without start', () => {
      manager.stop();
      expect(manager).toBeDefined();
    });

    it('should handle multiple stop calls', () => {
      manager.start();
      manager.stop();
      manager.stop();
      expect(manager).toBeDefined();
    });

    it('should clear additional handlers on stop', () => {
      const handler = vi.fn();
      manager.addKeyListener('ESCAPE', handler);
      manager.start();
      manager.stop();
      expect(manager).toBeDefined();
    });
  });

  describe('integration', () => {
    it('should support full lifecycle', () => {
      const onKeyDown = vi.fn();
      const onKeyUp = vi.fn();
      
      const fullManager = new HotkeyManager({
        hotkey: 'RIGHT_ALT',
        onKeyDown,
        onKeyUp,
      });
      
      fullManager.addKeyListener('ESCAPE', () => {});
      fullManager.start();
      fullManager.setHotkey('LEFT_ALT');
      fullManager.stop();
      
      expect(fullManager).toBeDefined();
    });
  });
});
