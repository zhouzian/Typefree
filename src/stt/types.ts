export interface STTService {
  transcribe(audioBuffer: Buffer): Promise<string>;
}
