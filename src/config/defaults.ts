export interface AppConfig {
  hotkey?: {
    key: string;
  };
  audio?: {
    deviceId?: number | null;
    sampleRate?: number;
    channels?: number;
    vad?: {
      type?: string;
      silenceDurationMs?: number;
    };
  };
  stt?: {
    provider?: string;
    model?: string;
    language?: string;
  };
  llm?: {
    provider?: string;
    model?: string;
    enabled?: boolean;
    preset?: 'none' | 'general' | 'email' | 'technical';
  };
  overlay?: {
    position?: string;
    width?: number;
    maxHeight?: number;
  };
  feedback?: {
    soundOnRecord?: boolean;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  hotkey: {
    key: '',  // Will be set based on platform
  },
  audio: {
    deviceId: null,
    sampleRate: 16000,
    channels: 1,
    vad: {
      type: 'webrtc',
      silenceDurationMs: 2000,
    },
  },
  stt: {
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
    language: 'auto',
  },
  llm: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    enabled: true,
    preset: 'general',
  },
  overlay: {
    position: 'bottom-center',
    width: 600,
    maxHeight: 200,
  },
  feedback: {
    soundOnRecord: false,
  },
};
