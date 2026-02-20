import * as dotenv from 'dotenv';
dotenv.config();

import { app, BrowserWindow, screen, ipcMain, app as electronApp, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Groq from 'groq-sdk';
import { HotkeyManager } from '../hotkey';
import { AudioCapture } from '../audio';
import { GroqSTT } from '../stt';
import { GroqLLM } from '../llm';
import { TextOutput } from '../output';
import { ConfigManager } from '../config';
import { loadApiKey, saveApiKey } from '../config/apikey';
import { playSound } from '../utils/audio';
import { initTray, updateTrayRecording, updateTrayMicName, updateTrayApiKeyRequired, updateTrayReady, destroyTray } from './tray';
import { initLogger, log, getLogPath } from '../utils/logger';

initLogger();
log('=== Typefree starting ===');

const GRACE_PERIOD_MS = 3000;
const MAX_RECORDING_MS = 30000;
const SUCCESS_DISPLAY_MS = 800;

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let hotkeyManager: HotkeyManager | null = null;
let audioCapture: AudioCapture | null = null;
let sttService: GroqSTT | null = null;
let llmService: GroqLLM | null = null;
let llmEnabled: boolean = true;
let textOutput: TextOutput | null = null;
let configManager: ConfigManager | null = null;
let isCalibrated: boolean = false;
let isRecordingHotkey: boolean = false;
let recordedHotkey: string | null = null;

let isRecording = false;
let isProcessing = false;
let transcriptionBuffer: string[] = [];
let gracePeriodTimeout: NodeJS.Timeout | null = null;

function validateApiKey(): boolean {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return false;
  }
  return true;
}

async function showAccessibilityDialog() {
  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Open System Settings', 'Continue Anyway'],
    defaultId: 0,
    cancelId: 1,
    title: 'Accessibility Permission Required',
    message: 'Typefree needs Accessibility permission to detect global hotkeys.',
    detail: 'Without this permission, the voice recording hotkey will not work.\n\nYou can grant permission in System Settings > Privacy & Security > Accessibility.'
  });
  
  if (result.response === 0) {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  }
}

async function createOverlayWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const config = configManager?.getConfig();
  const overlayWidth = config?.overlay?.width || 600;
  const overlayHeight = config?.overlay?.maxHeight || 200;
  const position = config?.overlay?.position || 'bottom-center';
  
  let x: number, y: number;
  
  switch (position) {
    case 'top-left':
      x = 50;
      y = 50;
      break;
    case 'top-right':
      x = screenWidth - overlayWidth - 50;
      y = 50;
      break;
    case 'bottom-left':
      x = 50;
      y = screenHeight - overlayHeight - 50;
      break;
    case 'bottom-right':
      x = screenWidth - overlayWidth - 50;
      y = screenHeight - overlayHeight - 50;
      break;
    case 'bottom-center':
    default:
      x = Math.floor((screenWidth - overlayWidth) / 2);
      y = screenHeight - overlayHeight - 50;
      break;
  }

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'floating');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setFullScreenable(false);
  }
  
  overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  overlayWindow.hide();

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

async function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: process.platform === 'win32',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
  
  settingsWindow.loadFile(path.join(__dirname, '../settings/index.html'));
  
  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
    stopMicLevelPolling();
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
  });
  
  startMicLevelPolling();
}

function startMicLevelPolling() {
  if (!audioCapture) return;
  
  audioCapture.startLevelPolling();
}

function stopMicLevelPolling() {
  if (audioCapture) {
    audioCapture.stopLevelPolling();
  }
}

function showOverlay() {
  if (overlayWindow) {
    overlayWindow.showInactive();
  }
}

function hideOverlay() {
  if (overlayWindow) {
    overlayWindow.hide();
  }
}

function sendToOverlay(channel: string, data: unknown) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (channel !== 'audio-level' && channel !== 'calibration-progress') {
      log(`[Main] Sending to overlay: ${channel}`);
    }
    overlayWindow.webContents.send(channel, data);
  } else {
    log(`[Main] Cannot send to overlay - window not available`);
  }
}

async function startRecording() {
  if (settingsWindow) return;
  
  log(`[Main] startRecording called, isProcessing: ${isProcessing}`);
  if (isProcessing) return;
  
  textOutput?.rememberFrontmostApp?.();
  log(`[Main] Remembered frontmost app before showing overlay`);
  
  updateTrayRecording(true);
  
  if (isRecording) return;
  
  isRecording = true;
  transcriptionBuffer = [];
  log('[Main] Starting recording...');
  
  const config = configManager?.getConfig();
  if (config?.feedback?.soundOnRecord) {
    playSound('start');
  }
  
  showOverlay();
  sendToOverlay('recording-started', { text: transcriptionBuffer.join(' ') });
  
  try {
    await audioCapture?.startRecording();
    log('[Main] Audio capture started');
    
    stopRecordingRequested();
  } catch (error) {
    log(`[Main] Failed to start recording: ${error}`);
    sendToOverlay('error', { message: 'Failed to start recording. Is ffmpeg installed?' });
    isRecording = false;
    updateTrayRecording(false);
  }
}

function stopRecordingRequested() {
  if (settingsWindow) return;
  
  log(`[Main] stopRecordingRequested, isRecording=${isRecording} isProcessing=${isProcessing}`);
  if (!isRecording || isProcessing) return;
  
  if (gracePeriodTimeout) {
    clearTimeout(gracePeriodTimeout);
    log('[Main] Cleared existing grace period timer due to new speech');
  }
  
  const isMac = process.platform === 'darwin';
  const defaultHotkey = isMac ? 'Option+Z' : 'Alt+Z';
  
  sendToOverlay('grace-period', { 
    message: 'Recording... wait a moment to finish, or speak again to continue',
    seconds: GRACE_PERIOD_MS / 1000 
  });
  
  gracePeriodTimeout = setTimeout(() => {
    const isSpeaking = audioCapture?.isCurrentlySpeaking() || false;
    log(`[Main] Grace period ended, isRecording=${isRecording} isProcessing=${isProcessing} isSpeaking=${isSpeaking}`);
    if (isRecording && !isProcessing && !isSpeaking) {
      processRecording();
    } else if (isRecording && !isProcessing && isSpeaking) {
      log('[Main] User is still speaking, resetting grace period');
      stopRecordingRequested();
    }
  }, GRACE_PERIOD_MS);
}
  
async function processRecording() {
  log(`[Main] processRecording called, isRecording=${isRecording} isProcessing=${isProcessing}`);
  if (!isRecording || isProcessing) return;
  
  isProcessing = true;
  isRecording = false;
  
  if (gracePeriodTimeout) {
    clearTimeout(gracePeriodTimeout);
    gracePeriodTimeout = null;
  }
  
  const config = configManager?.getConfig();
  if (config?.feedback?.soundOnRecord) {
    playSound('end');
  }
  
  try {
    const finalAudio = await audioCapture?.stopRecording();
    const totalSpeechChunks = audioCapture?.getTotalSpeechChunks() || 0;
    log(`[Main] Final audio size: ${finalAudio?.length || 0} bytes, speech chunks: ${totalSpeechChunks}`);
    
    if (totalSpeechChunks < 10) {
      log(`[Main] No significant speech detected (${totalSpeechChunks} chunks), skipping transcription`);
      sendToOverlay('error', { message: 'No speech detected' });
      setTimeout(() => hideOverlay(), 1500);
      isProcessing = false;
      transcriptionBuffer = [];
      updateTrayRecording(false);
      return;
    }
    
    if (finalAudio && finalAudio.length > 0 && sttService) {
      sendToOverlay('transcribing', { message: 'Transcribing...' });
      
      if (audioCapture) {
        audioCapture.forceTranscribeRemainingSpeech();
        log('[Main] Force transcribed remaining speech');
      }
      
      if (audioCapture) {
        await audioCapture.waitForPendingTranscription();
        log('[Main] Waiting for pending VAD transcription complete');
      }
      
      try {
        log('[Main] Starting final transcription...');
        const finalTranscript = await sttService.transcribe(finalAudio);
        log(`[Main] Final transcript: "${finalTranscript}"`);
        if (finalTranscript.trim()) {
          transcriptionBuffer = [finalTranscript];
        }
      } catch (err) {
        log(`[Main] Final transcription error: ${err}`);
      }
    }
    
    const completeTranscript = transcriptionBuffer.join(' ').trim();
    
    log(`[Main] Complete transcript: "${completeTranscript}"`);
    
    if (!completeTranscript) {
      sendToOverlay('error', { message: 'No speech detected' });
      setTimeout(() => hideOverlay(), 1500);
      isProcessing = false;
      transcriptionBuffer = [];
      updateTrayRecording(false);
      return;
    }
    
    let finalText = completeTranscript;
    if (llmService && llmEnabled) {
      sendToOverlay('organizing', { message: 'Organizing...' });
      log('[Main] Starting LLM reorganization...');
      finalText = await llmService.reorganize(completeTranscript);
      log(`[Main] LLM result: "${finalText}"`);
    }
    
    sendToOverlay('success', { text: finalText });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    hideOverlay();
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await textOutput?.insertText(finalText);
    log('[Main] Text inserted successfully');
    
    transcriptionBuffer = [];
    isProcessing = false;
    updateTrayRecording(false);
    
  } catch (error) {
    log(`[Main] Failed to process recording: ${error}`);
    sendToOverlay('error', { message: 'Failed to process audio' });
    isProcessing = false;
    transcriptionBuffer = [];
    updateTrayRecording(false);
  }
}

function handleTranscriptChunk(transcript: string) {
  log(`[Main] handleTranscriptChunk: "${transcript}" isRecording=${isRecording} isProcessing=${isProcessing}`);
  if (!isRecording && !isProcessing) return;
  
  if (transcript.trim()) {
    transcriptionBuffer.push(transcript);
    const fullText = transcriptionBuffer.join(' ');
    sendToOverlay('transcript-chunk', { text: fullText, isPartial: true });
  }
}

function handleAudioLevel(level: number) {
  sendToOverlay('audio-level', { level });
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('mic-level', { level });
  }
}

function handleCalibrationProgress(progress: { remaining: number; isQuiet: boolean }) {
  sendToOverlay('calibration-progress', progress);
}

function handleCalibrationComplete(result: { noiseFloor: number; speechThreshold: number }) {
  log(`[Main] Calibration complete: noiseFloor=${result.noiseFloor.toFixed(4)} speechThreshold=${result.speechThreshold.toFixed(4)}`);
  isCalibrated = true;
  sendToOverlay('calibration-complete', result);
}

async function runStartupCalibration(): Promise<void> {
  if (!audioCapture) return;
  
  showOverlay();
  sendToOverlay('permission-requested', {});
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  sendToOverlay('calibration-started', { duration: 6 });
  
  try {
    const result = await audioCapture.runStartupCalibration();
    log(`[Main] Startup calibration result: ${JSON.stringify(result)}`);
  } catch (error) {
    log(`[Main] Startup calibration failed: ${error}`);
    sendToOverlay('error', { message: 'Microphone permission denied. Please grant permission in System Settings.' });
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  hideOverlay();
}

function cleanup() {
  if (gracePeriodTimeout) {
    clearTimeout(gracePeriodTimeout);
    gracePeriodTimeout = null;
  }
  if (hotkeyManager) {
    hotkeyManager.stop();
    hotkeyManager = null;
  }
  if (audioCapture) {
    audioCapture.stopRecording().catch(() => {});
    audioCapture = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
  destroyTray();
}

function formatHotkeyName(key: string): string {
  const isMac = process.platform === 'darwin';
  
  if (key.includes('+')) {
    const parts = key.split('+');
    const modifier = parts[0].toUpperCase();
    const keyPart = parts[1];
    
    const modifierNames: Record<string, string> = {
      'RIGHT_ALT': isMac ? 'Option' : 'Alt',
      'LEFT_ALT': isMac ? 'Option' : 'Alt',
      'RIGHT_OPTION': 'Option',
      'LEFT_OPTION': 'Option',
      'OPTION': 'Option',
      'ALT': isMac ? 'Option' : 'Alt',
      'CONTROL': 'Control',
      'SHIFT': 'Shift',
      'COMMAND': 'Command',
    };
    
    const modifierName = modifierNames[modifier] || modifier;
    return `${modifierName}+${keyPart}`;
  }
  
  const displayNames: Record<string, string> = {
    'RIGHT_ALT': isMac ? 'Option' : 'Alt',
    'LEFT_ALT': isMac ? 'Option' : 'Alt',
    'RIGHT_OPTION': 'Option',
    'LEFT_OPTION': 'Option',
    'OPTION': 'Option',
    'ALT': isMac ? 'Option' : 'Alt',
  };
  return displayNames[key.toUpperCase()] || key;
}

async function initialize() {
  const apiKey = loadApiKey();
  const hasApiKey = apiKey && apiKey !== 'your_groq_api_key_here';
  
  if (hasApiKey) {
    process.env.GROQ_API_KEY = apiKey;
  }
  
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  
  await app.whenReady();
  
  configManager = new ConfigManager();
  await configManager.load();
  
  const config = configManager.getConfig();
  
  let resolvedDeviceId = config.audio?.deviceId ?? undefined;
  let resolvedDeviceName = config.audio?.deviceName ?? undefined;
  
  if (process.platform === 'win32' && !resolvedDeviceName) {
    resolvedDeviceName = await AudioCapture.getDefaultDeviceName();
    log(`[Main] Resolved Windows device name: ${resolvedDeviceName}`);
  }
  
  if (resolvedDeviceId === null || resolvedDeviceId === undefined) {
    resolvedDeviceId = await AudioCapture.getDefaultDeviceIndex();
    log(`[Main] Resolved default device to index: ${resolvedDeviceId}`);
  }
  
  audioCapture = new AudioCapture({
    sampleRate: config.audio?.sampleRate || 16000,
    deviceId: resolvedDeviceId,
    deviceName: resolvedDeviceName,
    onAudioLevel: handleAudioLevel,
    onSpeechEnd: stopRecordingRequested,
  });
  
  audioCapture.setSpeechStartHandler(stopRecordingRequested);
  
  const isMac = process.platform === 'darwin';
  const defaultHotkey = isMac ? 'Option+Z' : 'Alt+Z';
  const hotkeyKey = config.hotkey?.key || defaultHotkey;
  
  hotkeyManager = new HotkeyManager({
    hotkey: hotkeyKey,
    onKeyDown: startRecording,
    onRawKey: handleRawKey,
  });
  
  hotkeyManager.start();
  
  initTray({
    onOpenSettings: () => {
      log('[Main] Opening settings from tray');
      createSettingsWindow();
    },
    onQuit: () => {
      cleanup();
      app.quit();
    }
  });
  
  if (!hasApiKey) {
    log('[Main] No API key found, opening settings');
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
    createSettingsWindow();
    updateTrayApiKeyRequired();
    return;
  }
  
  await initializeServices(config);
}

async function initializeServices(config: any): Promise<void> {
  sttService = new GroqSTT(process.env.GROQ_API_KEY || '', config.stt?.model);
  llmService = new GroqLLM(process.env.GROQ_API_KEY || '', config.llm?.model, undefined, config.llm?.preset);
  llmEnabled = config.llm?.enabled !== false;
  textOutput = new TextOutput();
  
  if (audioCapture) {
    audioCapture.setSTTService(sttService);
    audioCapture.setTranscriptHandler(handleTranscriptChunk);
    audioCapture.setCalibrationHandlers(handleCalibrationProgress, handleCalibrationComplete);
  }
  
  await createOverlayWindow();

  console.log('');
  console.log('Typefree is running!');
  console.log('Calibrating microphone... Please stay quiet and grant mic permission if prompted.');
  console.log('');
  
  await runStartupCalibration();

  let micName = 'Default Microphone';
  try {
    const devices = await AudioCapture.getDevices();
    const defaultIndex = await AudioCapture.getDefaultDeviceIndex();
    if (devices[defaultIndex]) {
      micName = devices[defaultIndex].name;
    }
  } catch (e) {
    log(`[Main] Could not get microphone info: ${e}`);
  }
  
  updateTrayMicName(micName);
  updateTrayReady();
  
  app.on('window-all-closed', () => {
  });
  
  app.on('before-quit', () => {
    cleanup();
  });
  
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    cleanup();
    app.quit();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    cleanup();
    app.quit();
    process.exit(0);
  });
  
  console.log('');
  console.log('Typefree is running in the menu bar!');
  console.log(`Microphone: ${micName}`);
  console.log(`Press and hold ${formatHotkeyName(config.hotkey?.key || 'Option')} to record.`);
  console.log('Release, wait 1.5s, and text will be auto-pasted.');
  console.log('Use the menu bar icon to quit.');
  console.log('');
}

async function initializeAfterApiKey(config: any): Promise<void> {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  
  await initializeServices(config);
}

initialize().catch((err) => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});

ipcMain.handle('get-config', () => {
  const config = configManager?.getConfig() || {};
  return {
    ...config
  };
});

ipcMain.handle('has-api-key', () => {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    return true;
  }
  const savedKey = loadApiKey();
  if (savedKey && savedKey !== 'your_groq_api_key_here') {
    process.env.GROQ_API_KEY = savedKey;
    return true;
  }
  return false;
});

ipcMain.handle('get-api-key-hint', () => {
  const key = process.env.GROQ_API_KEY || loadApiKey();
  if (!key || key === 'your_groq_api_key_here') return null;
  if (key.length > 8) {
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  }
  return '****';
});

ipcMain.handle('get-api-key-full', () => {
  const key = process.env.GROQ_API_KEY || loadApiKey();
  if (!key || key === 'your_groq_api_key_here') return null;
  return key;
});

ipcMain.handle('test-api-key', async (_event, apiKey: string) => {
  try {
    const client = new Groq({ apiKey });
    await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Invalid API key' };
  }
});

ipcMain.handle('get-microphones', async () => {
  try {
    return await AudioCapture.getDevices();
  } catch (err) {
    log(`[Main] Failed to get microphones: ${err}`);
    return [];
  }
});

ipcMain.on('save-config', async (_event, config: any) => {
  log(`[Main] Saving config: ${JSON.stringify(config)}`);
  
  const wasMissingApiKey = !process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here';
  
  if (config.apiKey && config.apiKey !== process.env.GROQ_API_KEY) {
    saveApiKey(config.apiKey);
    process.env.GROQ_API_KEY = config.apiKey;
    
    if (sttService) {
      sttService = new GroqSTT(config.apiKey, config.stt?.model);
      if (audioCapture) {
        audioCapture['sttService'] = sttService;
      }
    } else {
      sttService = new GroqSTT(config.apiKey, config.stt?.model);
    }
    
    if (llmService) {
      llmService = new GroqLLM(config.apiKey, config.llm?.model, undefined, config.llm?.preset);
    } else {
      llmService = new GroqLLM(config.apiKey, config.llm?.model, undefined, config.llm?.preset);
    }
  }
  
  const configToSave = { ...config };
  delete configToSave.apiKey;
  
  configManager?.updateConfig(configToSave);
  await configManager?.save();
  
  llmEnabled = configToSave.llm?.enabled !== false;
  
  if (configToSave.llm?.preset && llmService) {
    llmService.setPreset(configToSave.llm.preset);
  }
  
  if (configToSave.hotkey?.key && hotkeyManager) {
    hotkeyManager.setHotkey(configToSave.hotkey.key);
    hotkeyManager.restart();
  }
  
  if (wasMissingApiKey && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    log('[Main] API key saved, initializing services');
    await initializeAfterApiKey(configToSave);
  }
  
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.on('update-audio-device', async (_event, deviceId: number | null) => {
  log(`[Main] Updating audio device to: ${deviceId}`);
  
  stopMicLevelPolling();
  
  let resolvedDeviceId = deviceId;
  let resolvedDeviceName: string | undefined;
  
  if (process.platform === 'win32') {
    const devices = await AudioCapture.getDevices();
    if (deviceId !== null && devices[deviceId]) {
      resolvedDeviceName = devices[deviceId].name;
      log(`[Main] Windows device name: ${resolvedDeviceName}`);
    } else if (deviceId === null) {
      resolvedDeviceName = await AudioCapture.getDefaultDeviceName();
      log(`[Main] Windows default device name: ${resolvedDeviceName}`);
    }
  }
  
  if (deviceId === null) {
    resolvedDeviceId = await AudioCapture.getDefaultDeviceIndex();
    log(`[Main] Resolved system default to device index: ${resolvedDeviceId}`);
  }
  
  audioCapture = new AudioCapture({
    sampleRate: 16000,
    deviceId: resolvedDeviceId ?? undefined,
    deviceName: resolvedDeviceName,
    onAudioLevel: handleAudioLevel,
    onSpeechEnd: stopRecordingRequested,
  });
  
  if (sttService) {
    audioCapture.setSTTService(sttService);
  }
  audioCapture.setTranscriptHandler(handleTranscriptChunk);
  audioCapture.setSpeechStartHandler(stopRecordingRequested);
  audioCapture.setCalibrationHandlers(handleCalibrationProgress, handleCalibrationComplete);
  
  startMicLevelPolling();
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.on('start-hotkey-listen', () => {
  log('[Main] start-hotkey-listen received');
  isRecordingHotkey = true;
  recordedHotkey = null;
});

ipcMain.on('stop-hotkey-listen', () => {
  log('[Main] stop-hotkey-listen received');
  isRecordingHotkey = false;
});

ipcMain.on('capture-hotkey', (_event, key: string) => {
  if (!isRecordingHotkey) return;
  
  log(`[Main] Captured hotkey: ${key}`);
  recordedHotkey = key.toUpperCase();
  settingsWindow?.webContents.send('hotkey-recorded', recordedHotkey);
  isRecordingHotkey = false;
});

ipcMain.on('restart-hotkey', () => {
  log('[Main] Restarting hotkey listener...');
  if (hotkeyManager) {
    const manager = hotkeyManager;
    manager.restart();
    setTimeout(() => {
      const isWorking = manager.isEnabled();
      log(`[Main] Hotkey after restart: ${isWorking ? 'working' : 'not working'}`);
      if (!isWorking && settingsWindow && !settingsWindow.isDestroyed()) {
        createSettingsWindow();
      } else if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('hotkey-status', 'Hotkey is working!');
      }
    }, 2500);
  }
});

function handleRawKey(keyName: string, state: 'DOWN' | 'UP') {
  log(`[Main] handleRawKey: ${keyName} ${state}, isRecordingHotkey=${isRecordingHotkey}`);
  
  if (!isRecordingHotkey || state !== 'DOWN' || recordedHotkey) return;
  
  recordedHotkey = keyName;
  log(`[Main] Recorded hotkey: ${recordedHotkey}`);
  settingsWindow?.webContents.send('hotkey-recorded', recordedHotkey);
}
