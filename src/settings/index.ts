const { ipcRenderer } = require('electron');

let currentConfig: any = {};
let isRecordingHotkey = false;

const PRESET_DESCRIPTIONS: Record<string, string> = {
  general: 'Remove filler words, fix grammar (minimal changes)',
  email: 'Professional tone, suitable for email communication',
  technical: 'Clean text for technical prompts'
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element ${id} not found`);
  return el;
}

function init() {
  loadConfig();
  setupEventListeners();
  loadMicrophones();
}

function loadConfig() {
  ipcRenderer.invoke('get-config').then((config: any) => {
    currentConfig = config;
    populateFields();
    checkApiKey();
  });
}

function checkApiKey() {
  ipcRenderer.invoke('has-api-key').then((hasKey: boolean) => {
    const banner = document.getElementById('apiKeyRequired');
    if (banner) {
      banner.style.display = hasKey ? 'none' : 'flex';
    }
    
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    if (hasKey) {
      ipcRenderer.invoke('get-api-key-hint').then((hint: string | null) => {
        if (hint) {
          apiKeyInput.placeholder = `Current: ${hint}`;
        } else {
          apiKeyInput.placeholder = 'API key is set (hidden for security)';
        }
      });
    }
  });
}

function populateFields() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const defaultHotkey = isMac ? 'Option+Z' : 'Alt+Z';
  
  const hotkeyInput = document.getElementById('hotkey') as HTMLInputElement;
  hotkeyInput.value = formatHotkeyDisplay(currentConfig.hotkey?.key || defaultHotkey);
  
  const languageSelect = document.getElementById('language') as HTMLSelectElement;
  languageSelect.value = currentConfig.stt?.language || 'auto';
  
  const llmEnabledCheck = document.getElementById('llmEnabled') as HTMLInputElement;
  llmEnabledCheck.checked = currentConfig.llm?.enabled !== false;
  
  const llmPresetSelect = document.getElementById('llmPreset') as HTMLSelectElement;
  llmPresetSelect.value = currentConfig.llm?.preset || 'general';
  llmPresetSelect.disabled = !llmEnabledCheck.checked;
  updatePresetDescription(llmPresetSelect.value);
  
  const presetRow = $('presetRow');
  presetRow.style.opacity = llmEnabledCheck.checked ? '1' : '0.5';
  
  const positionSelect = document.getElementById('overlayPosition') as HTMLSelectElement;
  positionSelect.value = currentConfig.overlay?.position || 'bottom-center';
  
  const widthSlider = document.getElementById('overlayWidth') as HTMLInputElement;
  widthSlider.value = String(currentConfig.overlay?.width || 600);
  updateWidthDisplay(parseInt(widthSlider.value));
  
  const soundCheck = document.getElementById('soundOnRecord') as HTMLInputElement;
  soundCheck.checked = currentConfig.feedback?.soundOnRecord === true;
}

function formatHotkeyDisplay(key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (key.includes('+')) {
    const parts = key.split('+');
    const modifier = parts[0].toUpperCase();
    const keyPart = parts[1].toUpperCase();
    
    const modifierDisplay: Record<string, string> = {
      'RIGHT_ALT': isMac ? '⌥ Option' : '⌥ Alt',
      'LEFT_ALT': isMac ? '⌥ Option' : '⌥ Alt',
      'RIGHT_OPTION': '⌥ Option',
      'LEFT_OPTION': '⌥ Option',
      'RIGHT_CTRL': '⌃ Control',
      'LEFT_CTRL': '⌃ Control',
      'RIGHT_SHIFT': '⇧ Shift',
      'LEFT_SHIFT': '⇧ Shift',
      'RIGHT_META': '⌘ Command',
      'LEFT_META': '⌘ Command',
      'ALT': isMac ? '⌥ Option' : '⌥ Alt',
      'OPTION': '⌥ Option',
      'CONTROL': '⌃ Control',
      'SHIFT': '⇧ Shift',
      'COMMAND': '⌘ Command',
    };
    
    const displayModifier = modifierDisplay[modifier] || modifier;
    return `${displayModifier}+${keyPart}`;
  }
  
  const displayNames: Record<string, string> = {
    'RIGHT_ALT': isMac ? '⌥ Option' : '⌥ Alt',
    'LEFT_ALT': isMac ? '⌥ Option' : '⌥ Alt',
    'RIGHT_OPTION': '⌥ Option',
    'LEFT_OPTION': '⌥ Option',
    'RIGHT_CTRL': '⌃ Control',
    'LEFT_CTRL': '⌃ Control',
    'RIGHT_SHIFT': '⇧ Shift',
    'LEFT_SHIFT': '⇧ Shift',
    'RIGHT_META': '⌘ Command',
    'LEFT_META': '⌘ Command',
    'ALT_R': isMac ? '⌥ Option' : '⌥ Alt',
    'ALT_L': isMac ? '⌥ Option' : '⌥ Alt',
    'OPTION_R': '⌥ Option',
    'OPTION_L': '⌥ Option',
    'CTRL_R': '⌃ Control',
    'CTRL_L': '⌃ Control',
    'SHIFT_R': '⇧ Shift',
    'SHIFT_L': '⇧ Shift',
    'META_R': '⌘ Command',
    'META_L': '⌘ Command',
    'ALT': isMac ? '⌥ Option' : '⌥ Alt',
    'OPTION': '⌥ Option',
    'CONTROL': '⌃ Control',
    'SHIFT': '⇧ Shift',
    'COMMAND': '⌘ Command',
  };
  return displayNames[key.toUpperCase()] || key;
}

let isShowingApiKey = false;

function setupEventListeners() {
  const toggleApiKeyBtn = $('toggleApiKey');
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  
  toggleApiKeyBtn.addEventListener('click', async () => {
    isShowingApiKey = !isShowingApiKey;
    
    if (isShowingApiKey) {
      const fullKey = await ipcRenderer.invoke('get-api-key-full');
      if (fullKey) {
        apiKeyInput.value = fullKey;
      }
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁';
    }
  });
  
  const testApiKeyBtn = $('testApiKey');
  testApiKeyBtn.addEventListener('click', testApiKey);
  
  const getApiKeyLink = document.getElementById('getApiKeyLink');
  if (getApiKeyLink) {
    getApiKeyLink.addEventListener('click', (e) => {
      e.preventDefault();
      require('electron').shell.openExternal('https://console.groq.com/keys');
    });
  }
  
  const recordHotkeyBtn = $('recordHotkey');
  const hotkeyInput = document.getElementById('hotkey') as HTMLInputElement;
  
  recordHotkeyBtn.addEventListener('click', () => {
    if (isRecordingHotkey) {
      stopHotkeyRecording();
    } else {
      startHotkeyRecording();
    }
  });

  const llmEnabledCheck = document.getElementById('llmEnabled') as HTMLInputElement;
  const presetRow = $('presetRow');
  const llmPresetSelect = document.getElementById('llmPreset') as HTMLSelectElement;
  
  llmEnabledCheck.addEventListener('change', () => {
    llmPresetSelect.disabled = !llmEnabledCheck.checked;
    presetRow.style.opacity = llmEnabledCheck.checked ? '1' : '0.5';
  });
  
  llmPresetSelect.addEventListener('change', () => {
    updatePresetDescription(llmPresetSelect.value);
  });
  
  const widthSlider = document.getElementById('overlayWidth') as HTMLInputElement;
  widthSlider.addEventListener('input', () => {
    updateWidthDisplay(parseInt(widthSlider.value));
  });

  const micSelect = document.getElementById('microphone') as HTMLSelectElement;
  micSelect.addEventListener('change', () => {
    const deviceId = micSelect.value ? parseInt(micSelect.value) : null;
    ipcRenderer.send('update-audio-device', deviceId);
  });
  
  const cancelBtn = $('cancelBtn');
  cancelBtn.addEventListener('click', () => {
    ipcRenderer.send('close-settings');
  });
  
  const saveBtn = $('saveBtn');
  saveBtn.addEventListener('click', saveSettings);
}

async function testApiKey() {
  let apiKey = (document.getElementById('apiKey') as HTMLInputElement).value.trim();
  const statusEl = $('apiKeyStatus');
  const testBtn = document.getElementById('testApiKey') as HTMLButtonElement;
  
  if (!apiKey) {
    const hasKey = await ipcRenderer.invoke('has-api-key');
    if (hasKey) {
      statusEl.textContent = '✓ API key is set. Enter a new key above to change it.';
      statusEl.className = 'status-message success';
      return;
    }
    statusEl.textContent = 'Please enter an API key';
    statusEl.className = 'status-message error';
    return;
  }
  
  testBtn.disabled = true;
  statusEl.textContent = 'Testing...';
  statusEl.className = 'status-message';
  
  try {
    const result = await ipcRenderer.invoke('test-api-key', apiKey);
    if (result.success) {
      statusEl.textContent = '✓ API key is valid';
      statusEl.className = 'status-message success';
    } else {
      statusEl.textContent = `✗ ${result.error || 'Invalid API key'}`;
      statusEl.className = 'status-message error';
    }
  } catch (err: any) {
    statusEl.textContent = `✗ ${err.message || 'Test failed'}`;
    statusEl.className = 'status-message error';
  }
  
  testBtn.disabled = false;
}

function startHotkeyRecording() {
  isRecordingHotkey = true;
  const hotkeyInput = document.getElementById('hotkey') as HTMLInputElement;
  const recordBtn = document.getElementById('recordHotkey') as HTMLButtonElement;
  const statusEl = $('hotkeyStatus');
  
  hotkeyInput.value = 'Press a key...';
  hotkeyInput.classList.add('recording');
  recordBtn.textContent = 'Cancel';
  recordBtn.classList.add('active');
  if (statusEl) {
    statusEl.textContent = '';
  }
  
  document.addEventListener('keydown', handleKeyCapture);
  document.addEventListener('blur', stopHotkeyRecording);
  
  ipcRenderer.send('start-hotkey-listen');
}

function handleKeyCapture(e: KeyboardEvent) {
  if (!isRecordingHotkey) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  if (e.key === 'Escape') {
    stopHotkeyRecording();
    return;
  }
  
  const hasModifier = e.altKey || e.ctrlKey || e.shiftKey || e.metaKey;
  const modifierCount = (e.altKey ? 1 : 0) + (e.ctrlKey ? 1 : 0) + (e.shiftKey ? 1 : 0) + (e.metaKey ? 1 : 0);
  
  if (!hasModifier || modifierCount > 1) {
    const statusEl = $('hotkeyStatus');
    if (statusEl) {
      statusEl.textContent = 'Please hold one modifier + one key (e.g., Option+Z or Alt+Z)';
    }
    return;
  }
  
  const keyCode = e.code.toLowerCase();
  const isModifierKey = ['altleft', 'altright', 'controlleft', 'controlright', 'shiftleft', 'shiftright', 'metaleft', 'metaright'].includes(keyCode);
  
  if (isModifierKey) {
    const statusEl = $('hotkeyStatus');
    if (statusEl) {
      statusEl.textContent = 'Please press a letter or number key, not just the modifier';
    }
    return;
  }
  
  let modifier = '';
  const rawKeyCode = e.code;
  let key: string;
  
  if (rawKeyCode.startsWith('Key')) {
    key = rawKeyCode.replace('Key', '').toUpperCase();
  } else if (rawKeyCode.startsWith('Digit')) {
    key = rawKeyCode.replace('Digit', '').toUpperCase();
  } else {
    key = rawKeyCode.toUpperCase();
  }
  
  if (e.altKey) {
    modifier = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? 'RIGHT_ALT' : 'LEFT_ALT';
  } else if (e.ctrlKey) {
    modifier = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? 'RIGHT_CTRL' : 'LEFT_CTRL';
  } else if (e.shiftKey) {
    modifier = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? 'RIGHT_SHIFT' : 'LEFT_SHIFT';
  } else if (e.metaKey) {
    modifier = e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT ? 'RIGHT_META' : 'LEFT_META';
  }
  
  if (modifier && key) {
    key = `${modifier}+${key}`;
  } else if (!key) {
    return;
  }
  
  ipcRenderer.send('capture-hotkey', key);
  document.removeEventListener('keydown', handleKeyCapture);
  document.removeEventListener('blur', stopHotkeyRecording);
}

ipcRenderer.on('hotkey-status', (_event: any, status: string) => {
  const statusEl = $('hotkeyStatus');
  if (statusEl) {
    statusEl.textContent = status;
  }
});

function stopHotkeyRecording() {
  isRecordingHotkey = false;
  const hotkeyInput = document.getElementById('hotkey') as HTMLInputElement;
  const recordBtn = document.getElementById('recordHotkey') as HTMLButtonElement;
  const statusEl = $('hotkeyStatus');
  
  hotkeyInput.classList.remove('recording');
  recordBtn.textContent = 'Record';
  recordBtn.classList.remove('active');
  if (statusEl) {
    statusEl.textContent = '';
  }
  
  document.removeEventListener('keydown', handleKeyCapture);
  document.removeEventListener('blur', stopHotkeyRecording);
  
  ipcRenderer.send('stop-hotkey-listen');
}

ipcRenderer.on('hotkey-recorded', (_event: any, key: string) => {
  const hotkeyInput = document.getElementById('hotkey') as HTMLInputElement;
  hotkeyInput.value = formatHotkeyDisplay(key);
  currentConfig.hotkey = { key };
  stopHotkeyRecording();
});

async function loadMicrophones() {
  const micSelect = document.getElementById('microphone') as HTMLSelectElement;
  micSelect.innerHTML = '<option value="">System Default</option>';
  
  try {
    const devices: Array<{id: number, name: string}> = await ipcRenderer.invoke('get-microphones');
    const currentDeviceId = currentConfig.audio?.deviceId;
    
    for (const device of devices) {
      const option = document.createElement('option');
      option.value = String(device.id);
      option.textContent = device.name;
      if (currentDeviceId !== null && device.id === currentDeviceId) {
        option.selected = true;
      }
      micSelect.appendChild(option);
    }
  } catch (err) {
    console.error('Failed to load microphones:', err);
  }
}

function updatePresetDescription(preset: string) {
  const descEl = $('presetDescription');
  descEl.textContent = PRESET_DESCRIPTIONS[preset] || '';
}

function updateWidthDisplay(width: number) {
  const widthValue = $('overlayWidthValue');
  widthValue.textContent = `${width}px`;
}

function saveSettings() {
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
  const micEl = document.getElementById('microphone') as HTMLSelectElement;
  const langEl = document.getElementById('language') as HTMLSelectElement;
  const llmEnabledEl = document.getElementById('llmEnabled') as HTMLInputElement;
  const llmPresetEl = document.getElementById('llmPreset') as HTMLSelectElement;
  const posEl = document.getElementById('overlayPosition') as HTMLSelectElement;
  const widthEl = document.getElementById('overlayWidth') as HTMLInputElement;
  const soundEl = document.getElementById('soundOnRecord') as HTMLInputElement;
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const defaultHotkey = isMac ? 'Option+Z' : 'Alt+Z';
  
  const config = {
    apiKey: apiKeyEl.value.trim() || undefined,
    hotkey: {
      key: currentConfig.hotkey?.key || defaultHotkey
    },
    audio: {
      deviceId: micEl.value ? parseInt(micEl.value) : null,
      sampleRate: 16000,
      channels: 1
    },
    stt: {
      provider: 'groq',
      model: 'whisper-large-v3-turbo',
      language: langEl.value
    },
    llm: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      enabled: llmEnabledEl.checked,
      preset: llmPresetEl.value
    },
    overlay: {
      position: posEl.value,
      width: parseInt(widthEl.value),
      maxHeight: 200
    },
    feedback: {
      soundOnRecord: soundEl.checked
    }
  };
  
  ipcRenderer.send('save-config', config);
  
  ipcRenderer.send('update-audio-device', config.audio.deviceId);
}

ipcRenderer.on('mic-level', (_event: any, data: { level: number }) => {
  const levelBar = $('micLevel') as HTMLElement;
  if (levelBar) {
    levelBar.style.width = `${Math.min(data.level * 100, 100)}%`;
  }
});

document.addEventListener('DOMContentLoaded', init);