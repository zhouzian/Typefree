export interface AudioDevice {
  id: number;
  name: string;
  isDefault?: boolean;
}

export interface AudioCaptureOptions {
  sampleRate?: number;
  deviceId?: number;
  channels?: number;
  onTranscript?: (transcript: string) => void;
  onAudioLevel?: (level: number) => void;
  onSpeechEnd?: () => void;
  sttService?: {
    transcribe(audioBuffer: Buffer): Promise<string>;
  };
  onCalibrationProgress?: (progress: { remaining: number; isQuiet: boolean }) => void;
  onCalibrationComplete?: (result: { noiseFloor: number; speechThreshold: number }) => void;
}
