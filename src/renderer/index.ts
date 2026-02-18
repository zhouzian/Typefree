const { ipcRenderer } = require('electron');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Renderer] ${message}`);
}

log('Renderer started');

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element ${id} not found`);
  return el;
}

const textEl = $('text');
const statusEl = $('status');
const overlayEl = $('overlay');
const pulseCore = $('pulse-core');

let isListening = false;
let audioLevel = 0;
let lastAudioTime = 0;
let listeningTimeout: NodeJS.Timeout | null = null;

ipcRenderer.on('recording-started', () => {
  log('recording-started received');
  overlayEl.classList.add('recording');
  overlayEl.classList.remove('error', 'success', 'calibrating', 'listening');
  textEl.textContent = '';
  textEl.classList.remove('final');
  statusEl.textContent = 'Listening...';
  statusEl.classList.remove('organizing', 'grace');
  isListening = false;
  audioLevel = 0;
  updatePulseCore(0);
});

ipcRenderer.on('permission-requested', () => {
  log('permission-requested received');
  overlayEl.classList.add('calibrating');
  overlayEl.classList.remove('error', 'success', 'recording');
  textEl.textContent = '';
  statusEl.textContent = 'Grant microphone permission in the prompt, then wait...';
  statusEl.classList.remove('organizing', 'grace');
  updatePulseCore(0);
});

ipcRenderer.on('calibration-started', (_event: unknown, data: { duration: number }) => {
  log(`calibration-started: duration=${data.duration}s`);
  overlayEl.classList.add('calibrating', 'recording');
  overlayEl.classList.remove('error', 'success');
  textEl.textContent = '';
  statusEl.textContent = `Calibrating... ${data.duration}`;
  statusEl.classList.remove('organizing', 'grace');
  updatePulseCore(0);
});

let lastCalibrationLog = 0;
ipcRenderer.on('calibration-progress', (_event: unknown, data: { remaining: number; isQuiet: boolean }) => {
  const now = Date.now();
  if (now - lastCalibrationLog > 1000) {
    log(`calibration-progress: remaining=${data.remaining}s isQuiet=${data.isQuiet}`);
    lastCalibrationLog = now;
  }
  const quietIndicator = data.isQuiet ? '✓' : '⚠';
  statusEl.textContent = `Calibrating... ${quietIndicator} ${data.remaining}s`;
  updatePulseCore(data.isQuiet ? 0 : 0.3);
});

ipcRenderer.on('calibration-complete', (_event: unknown, data: { noiseFloor: number; speechThreshold: number }) => {
  log(`calibration-complete: noiseFloor=${data.noiseFloor.toFixed(4)} speechThreshold=${data.speechThreshold.toFixed(4)}`);
  overlayEl.classList.remove('calibrating');
  statusEl.textContent = 'Ready!';
  updatePulseCore(0);
});

ipcRenderer.on('transcript-chunk', (_event: unknown, data: { text: string; isPartial: boolean }) => {
  log(`transcript-chunk: "${data.text}"`);
  const lastSentences = getLastSentences(data.text, 3);
  textEl.textContent = lastSentences;
  if (data.isPartial) {
    statusEl.textContent = 'Listening...';
    statusEl.classList.remove('grace');
  }
});

function getLastSentences(text: string, maxSentences: number): string {
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];
  if (sentences.length <= maxSentences) {
    return text;
  }
  return sentences.slice(-maxSentences).join(' ').trim();
}

ipcRenderer.on('grace-period', (_event: unknown, data: { message: string }) => {
  log(`grace-period: "${data.message}"`);
  statusEl.textContent = data.message;
  statusEl.classList.add('grace');
  overlayEl.classList.remove('listening');
  updatePulseCore(0);
});

ipcRenderer.on('transcribing', (_event: unknown, data: { message: string }) => {
  log(`transcribing: "${data.message}"`);
  statusEl.textContent = data.message;
  statusEl.classList.remove('grace');
  overlayEl.classList.remove('recording', 'listening');
  updatePulseCore(0);
});

ipcRenderer.on('organizing', (_event: unknown, data: { message: string }) => {
  log(`organizing: "${data.message}"`);
  overlayEl.classList.remove('recording', 'listening');
  statusEl.textContent = data.message;
  statusEl.classList.add('organizing');
  statusEl.classList.remove('grace');
  updatePulseCore(0.5);
});

let lastAudioLevelLog = 0;
ipcRenderer.on('audio-level', (_event: unknown, data: { level: number }) => {
  const now = Date.now();
  if (now - lastAudioLevelLog > 500) {
    log(`audio-level: ${data.level.toFixed(4)}`);
    lastAudioLevelLog = now;
  }
  
  audioLevel = data.level;
  lastAudioTime = now;
  
  if (overlayEl.classList.contains('recording')) {
    if (audioLevel > 0.05 && !isListening) {
      isListening = true;
      overlayEl.classList.add('listening');
    }
    
    if (listeningTimeout) {
      clearTimeout(listeningTimeout);
    }
    listeningTimeout = setTimeout(() => {
      if (now - lastAudioTime >= 300) {
        isListening = false;
        overlayEl.classList.remove('listening');
      }
    }, 300);
    
    updatePulseCore(data.level);
  }
});

ipcRenderer.on('success', (_event: unknown, data: { text: string }) => {
  log(`success: "${data.text}"`);
  textEl.textContent = '';
  textEl.classList.remove('final');
  statusEl.textContent = '';
  statusEl.classList.remove('organizing', 'grace');
  overlayEl.classList.remove('recording', 'listening');
  overlayEl.classList.add('success');
  updatePulseCore(1);
  
  if (listeningTimeout) {
    clearTimeout(listeningTimeout);
    listeningTimeout = null;
  }
});

ipcRenderer.on('error', (_event: unknown, data: { message: string }) => {
  log(`error: "${data.message}"`);
  textEl.textContent = '';
  textEl.classList.remove('final');
  statusEl.textContent = data.message;
  statusEl.classList.remove('organizing', 'grace');
  overlayEl.classList.remove('recording', 'listening', 'success');
  overlayEl.classList.add('error');
  updatePulseCore(0);
  
  if (listeningTimeout) {
    clearTimeout(listeningTimeout);
    listeningTimeout = null;
  }
});

function updatePulseCore(level: number) {
  const scale = 1 + (level * 0.3);
  const glowIntensity = 20 + (level * 30);
  
  if (pulseCore) {
    pulseCore.style.transform = `translate(-50%, -50%) scale(${scale})`;
    pulseCore.style.boxShadow = `0 0 ${glowIntensity}px rgba(99, 102, 241, ${0.5 + level * 0.3})`;
  }
}
