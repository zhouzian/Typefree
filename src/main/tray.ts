import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let tray: Tray | null = null;
let onOpenSettings: (() => void) | null = null;
let onQuit: (() => void) | null = null;
let isRecording: boolean = false;
let micName: string = 'Default Microphone';
let apiKeyRequired: boolean = false;

function createTrayIcon(recording: boolean = false): Electron.NativeImage {
  const iconPath = recording 
    ? path.join(__dirname, '../assets/icons/tray-recording.png')
    : path.join(__dirname, '../assets/icons/tray.png');
  
  if (fs.existsSync(iconPath)) {
    const image = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      return image.resize({ width: 22, height: 22 });
    }
    return image;
  }
  
  const size = process.platform === 'darwin' ? 22 : 32;
  const color = recording ? '#ef4444' : '#6b7280';
  
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="${color}" opacity="0.9"/>
      <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" fill="white"/>
      <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white"/>
    </svg>
  `;
  
  const image = nativeImage.createFromBuffer(Buffer.from(svg));
  
  if (process.platform === 'darwin') {
    return image.resize({ width: 22, height: 22 });
  }
  
  return image;
}

function buildMenu(): Menu {
  let statusText: string;
  
  if (apiKeyRequired) {
    statusText = 'API Key Required';
  } else if (isRecording) {
    statusText = 'Recording...';
  } else {
    statusText = 'Ready';
  }
  
  return Menu.buildFromTemplate([
    { 
      label: `Typefree - ${statusText}`,
      enabled: false 
    },
    { 
      label: `Microphone: ${micName}`,
      enabled: false,
      visible: !apiKeyRequired
    },
    { type: 'separator' },
    { 
      label: apiKeyRequired ? 'Enter API Key...' : 'Settings...',
      click: () => onOpenSettings?.()
    },
    { type: 'separator' },
    { 
      label: 'Quit',
      accelerator: 'CommandOrControl+Q',
      click: () => onQuit?.()
    }
  ]);
}

export function initTray(options: {
  onOpenSettings?: () => void;
  onQuit?: () => void;
}): Tray {
  onOpenSettings = options.onOpenSettings || null;
  onQuit = options.onQuit || null;
  
  const icon = createTrayIcon(false);
  tray = new Tray(icon);
  
  tray.setToolTip('Typefree - Voice Input');
  tray.setContextMenu(buildMenu());
  
  if (process.platform === 'darwin') {
    tray.setTitle('Typefree');
  }
  
  return tray;
}

export function updateTrayRecording(recording: boolean): void {
  isRecording = recording;
  if (tray) {
    tray.setImage(createTrayIcon(recording));
    tray.setContextMenu(buildMenu());
    
    if (process.platform === 'darwin') {
      tray.setTitle(recording ? 'Recording...' : 'Typefree');
    }
  }
}

export function updateTrayMicName(name: string): void {
  micName = name;
  if (tray) {
    tray.setContextMenu(buildMenu());
  }
}

export function updateTrayApiKeyRequired(): void {
  apiKeyRequired = true;
  if (tray) {
    tray.setImage(createTrayIcon(true));
    tray.setContextMenu(buildMenu());
    if (process.platform === 'darwin') {
      tray.setTitle('API Key Required');
    }
  }
}

export function updateTrayReady(): void {
  apiKeyRequired = false;
  if (tray) {
    tray.setImage(createTrayIcon(false));
    tray.setContextMenu(buildMenu());
    if (process.platform === 'darwin') {
      tray.setTitle('Typefree');
    }
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
