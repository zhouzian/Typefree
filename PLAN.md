# Typefree - Voice Input for CLI Tools

A cross-platform voice input tool for CLI applications like Kilo CLI and Claude Code, with real-time visual feedback during speech.

## Project Overview

**Objective**: Enable voice-driven interaction with CLI-based LLM tools with real-time visual feedback - see your words appear as you speak, then text is automatically pasted at your cursor position.

**Key Differentiator**: 
- Focus on CLI/terminal environments
- Real-time AI-style visual feedback during speech (pulse core, ripples, orbiting particles)
- Auto-paste after processing (no confirmation needed)
- Grace period: 3 seconds after speech end to continue speaking
- Multiple recordings accumulate text at cursor position
- System tray integration - runs in background
- Settings UI for customization

---

## Technical Architecture

### Platform Support
- **macOS**: Apple Silicon (M1/M2/M3 and later)
- **Windows**: Windows 11

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Electron + Node.js 18+ | Cross-platform with overlay window support |
| Language | TypeScript | Type safety, better IDE support |
| Audio Capture | FFmpeg + `@ffmpeg-installer/ffmpeg` | Bundled, no manual installation |
| Global Hotkeys | Electron `globalShortcut` | Built-in, no Accessibility permission needed |
| Visual Overlay | Electron (transparent, non-focusable) | Doesn't steal focus from terminal |
| Speech-to-Text | Groq Whisper (`whisper-large-v3-turbo`) | Fast, free, high quality |
| Text Reorganization | Groq LLM (`llama-3.3-70b-versatile`) | Fast inference, free tier |
| Text Output | `@napi-rs/clipboard` + platform APIs | Paste at cursor position |
| App Packaging | `electron-builder` | macOS .app, Windows .exe |

---

## Core Components

### 1. Audio Capture (`src/audio/`)

**Purpose**: Capture microphone input using FFmpeg

**Key Features**:
- Bundled FFmpeg via `@ffmpeg-installer/ffmpeg`
- Packaged FFmpeg in `resources/ffmpeg/{platform-arch}/`
- Real-time audio streaming at 16kHz
- **VAD (Voice Activity Detection)**:
  - Chunk size: 100ms (1600 samples at 16kHz)
  - Minimum speech: 10 chunks (~1 second) before VAD triggers transcription
  - Silence detection: 10 chunks (~1 second) of silence to detect speech end
  - Grace period: 3 seconds after speech end to continue speaking
- Memory-bounded buffer to prevent unbounded growth
- Real-time audio level calculation for visualizer

### 2. Hotkey Manager (`src/hotkey/`)

**Purpose**: Detect push-to-talk key combination globally

**Default Hotkey**: `Option+Z` on Mac, `Alt+Z` on Windows (hold to record)

**Supported Combinations**:
- Must be: modifier key + regular key (e.g., Option+Z, Command+J, Ctrl+K)
- Not supported: modifier-only keys, multi-modifier combinations

**Features**:
- Global key detection across all apps using Electron's `globalShortcut`
- No Accessibility permission required for modifier+key combinations
- Key-down: Start recording, show overlay
- No key-up detection needed (VAD handles speech end)

### 3. Speech-to-Text Service (`src/stt/`)

**Purpose**: Convert audio to text using Groq Whisper

**Model**: `whisper-large-v3-turbo`
- Free tier available
- 240x real-time speed
- 50+ languages with auto-detection

### 4. Visual Overlay (`src/renderer/`)

**Purpose**: Display real-time transcription without stealing focus

**Visual Design**:
- Modern AI-style visualizer with:
  - **Pulse Core**: Central glowing orb that scales with audio level
  - **Ripple Effects**: 3 concentric ripples expand outward
  - **Orbiting Particles**: 6 particles orbit around the core
- State-dependent colors (purple=recording, green=listening/success, red=error, blue=calibrating)
- Glassmorphism overlay with blur backdrop

**Display States**:
1. **Idle**: Hidden
2. **Calibrating**: Blue theme, countdown with quiet/noise indicator
3. **Recording**: Purple theme, pulse core animation, ripples, particles
4. **Listening**: Green theme (audio detected above threshold)
5. **Grace Period**: Yellow status text
6. **Transcribing**: Status text only
7. **Organizing**: Blue status text
8. **Success**: Green theme, checkmark, auto-hide
9. **Error**: Red theme with error message

### 5. Text Reorganization (`src/llm/`)

**Purpose**: Transform raw transcript into structured, LLM-friendly prompts

**Model**: `llama-3.3-70b-versatile` via Groq (free tier)

**Rewrite Presets**:

| Preset | Description | Use Case |
|--------|-------------|----------|
| **None** | No reorganization, output raw transcript | When you want exact words preserved |
| **General** | Clean up filler words, fix grammar, basic structure | Everyday use, notes, chat |
| **Email** | Format as professional email with greeting/sign-off | Email composition |
| **Technical** | Concise, direct language for technical prompts | Coding agents, CLI tools, technical docs |

### 6. Text Output (`src/output/`)

**Purpose**: Insert text at cursor position in active application

**Platform Support**:
- **macOS**: Uses clipboard + AppleScript for paste
- **Windows**: Uses clipboard + PowerShell SendKeys

### 7. System Tray (`src/main/tray.ts`)

**Purpose**: Background app management

**Features**:
- Tray icon shows recording state (purple/red)
- Menu shows status, microphone name
- Quick access to Settings
- Quit option
- App hidden from dock on macOS

### 8. Settings Window (`src/settings/`)

**Purpose**: User configuration UI

**Features**:
- API Key management with test button (key not displayed for security)
- Hotkey recorder
- Microphone selection with level preview
- Language selection (18+ languages)
- LLM preset selection with descriptions
- Overlay position and width settings
- Sound feedback toggle

### 9. Logger (`src/utils/logger.ts`)

**Purpose**: Centralized logging

**Features**:
- Logs to `~/.typefree/typefree.log` or Electron's userData directory
- Cross-platform path handling
- Used by all modules

---

## Project Structure

```
typefree/
├── package.json
├── tsconfig.json
├── README.md
├── PLAN.md
├── .gitignore
├── build/
│   ├── icon.icns              # macOS app icon
│   ├── icon.ico               # Windows app icon
│   ├── icon.svg               # Master SVG icon
│   ├── icons/                 # PNG icons in various sizes
│   │   ├── icon-16.png
│   │   ├── icon-512.png
│   │   ├── tray.png
│   │   └── tray-recording.png
│   └── entitlements.mac.plist # macOS entitlements
├── scripts/
│   ├── build.ts               # Cross-platform build script
│   ├── generate-assets.ts     # Generate sound files
│   ├── generate-icons.ts      # Generate PNG icons
│   └── create-ico.ts          # Create Windows .ico
├── src/
│   ├── main/
│   │   ├── index.ts           # Electron main process
│   │   └── tray.ts            # Tray icon management
│   ├── renderer/
│   │   ├── index.html         # Overlay HTML
│   │   ├── index.ts           # Overlay logic
│   │   └── styles.css         # Overlay styling (AI visualizer)
│   ├── settings/
│   │   ├── index.html         # Settings window HTML
│   │   ├── index.ts           # Settings window logic
│   │   └── styles.css         # Settings window styling
│   ├── audio/
│   │   ├── index.ts           # Module exports
│   │   ├── capture.ts         # FFmpeg audio recording
│   │   └── types.ts           # Audio interfaces
│   ├── hotkey/
│   │   ├── index.ts           # Module exports
│   │   └── listener.ts        # Global hotkey detection
│   ├── stt/
│   │   ├── index.ts           # Module exports
│   │   ├── groq.ts            # Groq Whisper client
│   │   └── types.ts           # STT interfaces
│   ├── llm/
│   │   ├── index.ts           # Module exports
│   │   ├── groq.ts            # Groq LLM client with presets
│   │   └── types.ts           # LLM interfaces
│   ├── output/
│   │   ├── index.ts           # Module exports
│   │   └── insert.ts          # Text insertion (macOS/Windows)
│   ├── config/
│   │   ├── index.ts           # Module exports
│   │   ├── manager.ts         # Config read/write
│   │   ├── apikey.ts          # API key management
│   │   └── defaults.ts        # Default configuration
│   ├── utils/
│   │   ├── audio.ts           # Sound playback
│   │   └── logger.ts          # Centralized logging
│   └── assets/
│       ├── sounds/
│       │   ├── start.wav      # Recording start sound
│       │   └── end.wav        # Recording end sound
│       └── icons/
│           ├── tray.svg
│           └── tray-recording.svg
└── tests/
    ├── audio.test.ts
    ├── config.test.ts
    ├── hotkey.test.ts
    ├── logger.test.ts
    ├── llm.test.ts
    └── stt.test.ts
```

---

## Configuration

**Data Storage Locations:**

| Mode | macOS Location | Windows Location |
|------|----------------|------------------|
| **Development** (`npm start`) | `~/Library/Application Support/Electron/` | `%APPDATA%/Electron/` |
| **Packaged App** | `~/Library/Application Support/Typefree/` | `%APPDATA%/Typefree/` |

**Note:** Development and packaged apps use different locations due to Electron's default behavior. The app name in development is "Electron", not "Typefree".

**Files stored:**
- `config.json` - User configuration and API key
- `typefree.log` - Application logs

**Migration:** Existing `~/.typefree/` data is automatically migrated to the new location on first run of the packaged app.

**Config File**: `{userData}/config.json`

```json
{
  "hotkey": {
    "key": "Option+Z"
  },
  "audio": {
    "deviceId": null,
    "sampleRate": 16000,
    "channels": 1,
    "vad": {
      "type": "webrtc",
      "silenceDurationMs": 2000
    }
  },
  "stt": {
    "provider": "groq",
    "model": "whisper-large-v3-turbo",
    "language": "auto"
  },
  "llm": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "enabled": true,
    "preset": "general"
  },
  "overlay": {
    "position": "bottom-center",
    "width": 600,
    "maxHeight": 200
  },
  "feedback": {
    "soundOnRecord": false
  }
}
```

---

## Implementation Status

### Completed
- [x] Electron project setup with TypeScript
- [x] Audio capture with FFmpeg (bundled)
- [x] Global hotkey detection (macOS, Windows, Linux)
- [x] Groq Whisper STT integration
- [x] Transparent overlay window (non-focusable)
- [x] AI-style visual feedback (pulse core, ripples, particles)
- [x] Real-time transcription display
- [x] Grace period for continued speaking
- [x] Auto-paste after processing
- [x] Multiple session support
- [x] Configuration system
- [x] System tray integration
- [x] Settings window with all options
- [x] LLM preset system (None, General, Email, Technical)
- [x] App packaging (macOS .app, Windows .exe)
- [x] Cross-platform build scripts
- [x] Linux support
- [x] Centralized logging

### Future Enhancements
- [ ] Universal App Integration (context-aware preset suggestions)
- [ ] Multiple language optimization
- [ ] Custom vocabulary/dictionary
- [ ] Recording history view
- [ ] Auto-start on login

---

## Build Commands

```bash
# Development
npm run build          # Build TypeScript and copy assets
npm run start          # Build and run
npm run dev            # Watch mode for TypeScript
npm run typecheck      # Type checking
npm test               # Run tests

# Asset Generation
npm run generate-assets  # Generate icons and sounds

# Packaging
npm run dist:mac       # Build macOS DMG/ZIP (arm64 + x64)
npm run dist:win       # Build Windows NSIS + portable
npm run dist:all       # Build both platforms
```

---

## System Requirements

### macOS
- Apple Silicon (M1/M2/M3 and later)
- macOS 11.0 (Big Sur) or later
- Microphone permissions

### Windows
- Windows 11
- Microphone permissions

---

## Latency Targets

| Operation | Target Latency |
|-----------|----------------|
| Hotkey detection | < 50ms |
| Audio capture start | < 100ms |
| STT transcription | < 1s |
| LLM reorganization | < 500ms |
| Text insertion | < 100ms |
| **Total (release to paste)** | **< 2s** |

---

## References

- [Groq API Documentation](https://console.groq.com/docs)
- [ffmpeg-installer](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg)
- [electron-builder](https://www.electron.build/)
