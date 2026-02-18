# Typefree

Voice input for CLI tools like Kilo CLI and Claude Code. Speak naturally and see your words transformed into well-structured prompts, auto-pasted at your cursor position.

## Features

- **AI-style visual feedback**: Modern pulse core with ripples and orbiting particles
- **System tray integration**: Runs in background, accessible from menu bar/taskbar
- **Settings UI**: Configure API key, hotkey, microphone, language, and LLM presets
- **LLM-powered reorganization**: Transcripts are automatically formatted for clarity
- **Push-to-talk**: Hold `Option+Z` (Mac) or `Alt+Z` (Windows) to record
- **VAD-based recording**: Speech detection automatically ends recording after silence
- **Grace period**: 3 seconds after speech ends (speak again to continue)
- **Auto-paste**: Text is automatically inserted at cursor position
- **Multiple recordings**: Each session adds text at current cursor location
- **Cross-platform**: Works on macOS (Apple Silicon) and Windows 11

## Prerequisites

**Groq API Key** (free): Get one at https://console.groq.com

FFmpeg is bundled - no manual installation needed.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Typefree

# Install dependencies
npm install

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

## Usage

```bash
npm run start
```

### How to use

1. Start Typefree - it runs in the system tray/menu bar
2. **Hold `Option+Z`** (Mac) or `Alt+Z` (Windows)
3. Speak - see real-time transcription with AI-style visualizer
4. **Release** - wait 3s (or speak again to continue)
5. Text is auto-pasted at your cursor position
6. Repeat for more input

### Settings

Click the tray icon and select "Settings..." to:
- Configure your Groq API key
- Change the push-to-talk hotkey (modifier + key, e.g., Option+Z)
- Select microphone
- Choose language for transcription
- Set LLM rewrite preset (None, General, Email, Technical)
- Adjust overlay position and size
- Toggle sound feedback

### LLM Rewrite Presets

| Preset | Description |
|--------|-------------|
| **None** | Output raw transcript without modifications |
| **General** | Clean up filler words, fix grammar |
| **Email** | Format as professional email |
| **Technical** | Concise prompts for coding agents |

### How Recording Works

1. **Press hotkey** (Option+Z / Alt+Z) → Recording starts
2. **VAD (Voice Activity Detection)** monitors audio:
   - After ~1 second of continuous speech → Real-time transcription begins
   - After ~1 second of silence → Speech end detected
3. **Grace period** (3 seconds) → Speak again to continue recording
4. **Auto-paste** → Final text inserted at cursor

### Multiple Recordings

Each recording session inserts text at your cursor:
```
Record 1 → "Create a function" → Paste
Record 2 → "that handles auth" → Paste
Record 3 → "and returns a token" → Paste
```

## Configuration

Configuration is stored in platform-appropriate locations:

| Mode | macOS Location | Windows Location |
|------|----------------|------------------|
| **Development** (`npm start`) | `~/Library/Application Support/Electron/` | `%APPDATA%/Electron/` |
| **Packaged App** | `~/Library/Application Support/Typefree/` | `%APPDATA%/Typefree/` |

**Note:** Development and packaged apps use different locations. Your first run of the packaged app will automatically migrate existing `~/.typefree/` data.

Files stored:
- `config.json` - User configuration
- `.env` - API key storage
- `typefree.log` - Application logs

**Config file (`config.json`):**

```json
{
  "hotkey": {
    "key": "Option+Z"
  },
  "audio": {
    "deviceId": null,
    "sampleRate": 16000,
    "vad": {
      "silenceDurationMs": 2000
    }
  },
  "stt": {
    "model": "whisper-large-v3-turbo",
    "language": "auto"
  },
  "llm": {
    "model": "llama-3.3-70b-versatile",
    "enabled": true,
    "preset": "general"
  },
  "overlay": {
    "position": "bottom-center",
    "width": 600
  },
  "feedback": {
    "soundOnRecord": false
  }
}
```

## Permissions

### macOS (Apple Silicon)
- **Microphone**: System will prompt on first use

### Windows
- **Microphone**: System will prompt on first use

## Development

```bash
# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Generate assets (icons, sounds)
npm run generate-assets
```

## Building for Distribution

```bash
# macOS (DMG + ZIP for Apple Silicon)
npm run dist:mac

# Windows (NSIS installer + portable)
npm run dist:win

# Both platforms
npm run dist:all
```

Output goes to `release/` directory.

## Architecture

See [PLAN.md](./PLAN.md) for detailed architecture documentation.

## License

MIT
