import { AudioCaptureOptions, AudioDevice } from './types';
import { spawn, exec, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/logger';

const MIN_AUDIO_SIZE = 3200;
const MAX_BUFFER_SIZE = 16000 * 2 * 10;
const MIN_CALIBRATION_SAMPLES = 30;
const SILENCE_CHUNKS_NEEDED = 10;
const MIN_TIME_BETWEEN_TRANSCRIPTS = 2000;
const MIN_SPEECH_CHUNKS = 10;
const NOISE_FLOOR_MARGIN = 3.0;
const NOISE_HISTORY_SIZE = 100;
const MIN_SPEECH_THRESHOLD = 0.015;
const MIN_SILENCE_THRESHOLD = 0.008;
const STARTUP_CALIBRATION_SECONDS = 6;
const NOISE_PERCENTILE = 50;

interface STTService {
  transcribe(audioBuffer: Buffer): Promise<string>;
}

function getFfmpegPath(): string {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    let ffmpegPath = ffmpegInstaller.path;
    
    if (process.resourcesPath) {
      const platform = process.platform;
      const arch = process.arch;
      const platformDir = `${platform}-${arch}`;
      
      const packagedPath = path.join(
        process.resourcesPath,
        'ffmpeg',
        platformDir,
        platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
      );
      
      if (fs.existsSync(packagedPath)) {
        ffmpegPath = packagedPath;
        log(`[Audio] Using packaged FFmpeg: ${packagedPath}`);
      }
    }
    
    return ffmpegPath;
  } catch (err) {
    log(`[Audio] FFmpeg installer not found, falling back to system ffmpeg: ${err}`);
    return 'ffmpeg';
  }
}

export function calculateAudioLevel(chunk: Buffer): number {
  let sum = 0;
  const samples = Math.min(Math.floor(chunk.length / 2), 1600);
  
  for (let i = 0; i < samples; i++) {
    const sample = chunk.readInt16LE(i * 2);
    sum += sample * sample;
  }
  
  const rms = Math.sqrt(sum / samples);
  const normalizedLevel = Math.min(rms / 32767, 1);
  
  return normalizedLevel;
}

export class AudioCapture {
  private sampleRate: number;
  private deviceId: number | undefined;
  private channels: number;
  private isRecording: boolean = false;
  private audioBuffer: Buffer[] = [];
  private onTranscript?: (transcript: string) => void;
  private onAudioLevel?: (level: number) => void;
  private sttService?: STTService;
  private ffmpegProcess: ChildProcess | null = null;
  private isProcessingTranscript: boolean = false;
  private chunkCount: number = 0;
  private isSpeaking: boolean = false;
  private speechBuffer: Buffer[] = [];
  private silenceChunkCount: number = 0;
  private lastTranscriptTime: number = 0;
  private speechChunkCount: number = 0;
  private totalSpeechChunks: number = 0;
  
  private noiseHistory: number[] = [];
  private noiseFloor: number = 0;
  private speechThreshold: number = 0;
  private silenceThreshold: number = 0;
  private lastLevel: number = 0;
  
  private isCalibrating: boolean = false;
  private calibrationLevels: number[] = [];
  private calibrationStartTime: number = 0;
  private onCalibrationProgress?: (progress: { remaining: number; isQuiet: boolean }) => void;
  private onCalibrationComplete?: (result: { noiseFloor: number; speechThreshold: number }) => void;
  private onSpeechEnd?: () => void;
  
  private levelPollingProcess: ChildProcess | null = null;

  constructor(options: AudioCaptureOptions = {}) {
    this.sampleRate = options.sampleRate || 16000;
    this.deviceId = options.deviceId;
    this.channels = options.channels || 1;
    this.onTranscript = options.onTranscript;
    this.onAudioLevel = options.onAudioLevel;
    this.onSpeechEnd = options.onSpeechEnd;
    this.sttService = options.sttService;
    this.onCalibrationProgress = options.onCalibrationProgress;
    this.onCalibrationComplete = options.onCalibrationComplete;
  }

  setSTTService(service: STTService): void {
    this.sttService = service;
  }

  setTranscriptHandler(handler: (transcript: string) => void): void {
    this.onTranscript = handler;
  }

  setCalibrationHandlers(
    onProgress: (progress: { remaining: number; isQuiet: boolean }) => void,
    onComplete: (result: { noiseFloor: number; speechThreshold: number }) => void
  ): void {
    this.onCalibrationProgress = onProgress;
    this.onCalibrationComplete = onComplete;
  }

  async runStartupCalibration(): Promise<{ noiseFloor: number; speechThreshold: number }> {
    return new Promise((resolve, reject) => {
      if (this.deviceId === undefined) {
        AudioCapture.getDefaultDeviceIndex().then((deviceId) => {
          this.deviceId = deviceId;
          this.startCalibrationProcess(resolve, reject);
        });
      } else {
        this.startCalibrationProcess(resolve, reject);
      }
    });
  }

  private startCalibrationProcess(
    resolve: (value: { noiseFloor: number; speechThreshold: number }) => void,
    reject: (reason: Error) => void
  ): void {
    this.isCalibrating = true;
    this.calibrationLevels = [];
    this.calibrationStartTime = Date.now();
    
    const calibrationTimeout = setTimeout(() => {
      reject(new Error('Calibration timed out'));
      this.stopCalibration();
    }, STARTUP_CALIBRATION_SECONDS * 1000 + 5000);

    this.onCalibrationComplete = (result) => {
      clearTimeout(calibrationTimeout);
      resolve(result);
    };

    this.captureAudioForCalibration();
  }

  private captureAudioForCalibration(): void {
    const ffmpegPath = getFfmpegPath();
    const osPlatform = process.platform;
    let ffmpegArgs: string[];

    if (osPlatform === 'darwin') {
      const deviceIndex = this.deviceId !== undefined ? this.deviceId : 0;
      ffmpegArgs = [
        '-f', 'avfoundation',
        '-i', `:${deviceIndex}`,
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else if (osPlatform === 'win32') {
      ffmpegArgs = [
        '-f', 'dshow',
        '-i', 'audio=Default',
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else {
      throw new Error(`Unsupported platform: ${osPlatform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
    }

    log('[Audio] Starting calibration...');
    this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    const ffmpeg = this.ffmpegProcess;

    ffmpeg.on('error', (err: Error) => {
      log(`[Audio] Calibration FFmpeg error: ${err}`);
      this.isCalibrating = false;
    });

    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      if (!this.isCalibrating) return;
      
      const level = calculateAudioLevel(chunk);
      
      if (this.onAudioLevel) {
        const displayLevel = Math.min(level * 100, 1);
        this.onAudioLevel(displayLevel);
      }
      
      this.processCalibration(level);
    });
  }

  private processCalibration(level: number): void {
    const elapsed = (Date.now() - this.calibrationStartTime) / 1000;
    const remaining = Math.max(0, Math.ceil(STARTUP_CALIBRATION_SECONDS - elapsed));
    
    const isQuiet = level < 0.003;
    
    this.calibrationLevels.push(level);
    
    if (this.onCalibrationProgress) {
      this.onCalibrationProgress({ remaining, isQuiet });
    }
    
    if (elapsed >= STARTUP_CALIBRATION_SECONDS) {
      this.completeCalibration();
    }
  }

  private completeCalibration(): void {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    
    this.isCalibrating = false;
    
    const levels = [...this.calibrationLevels];
    levels.sort((a, b) => a - b);
    
    const medianIndex = Math.floor(levels.length / 2);
    const median = levels[medianIndex];
    
    const quietLevels = levels.slice(0, Math.floor(levels.length * 0.5));
    let sumSquaredDiff = 0;
    for (const l of quietLevels) {
      sumSquaredDiff += (l - median) * (l - median);
    }
    const stdDev = Math.sqrt(sumSquaredDiff / quietLevels.length);
    
    this.noiseFloor = median;
    
    const adaptiveSpeechThreshold = median + NOISE_FLOOR_MARGIN * stdDev;
    const adaptiveSilenceThreshold = median + stdDev;
    
    this.speechThreshold = Math.max(adaptiveSpeechThreshold, MIN_SPEECH_THRESHOLD);
    this.silenceThreshold = Math.max(adaptiveSilenceThreshold, MIN_SILENCE_THRESHOLD);
    
    log(`[Audio] Calibration complete: median=${median.toFixed(4)} stdDev=${stdDev.toFixed(4)} speechThreshold=${this.speechThreshold.toFixed(4)} silenceThreshold=${this.silenceThreshold.toFixed(4)}`);
    
    if (this.onCalibrationComplete) {
      this.onCalibrationComplete({
        noiseFloor: this.noiseFloor,
        speechThreshold: this.speechThreshold,
      });
    }
  }

  private stopCalibration(): void {
    this.isCalibrating = false;
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
  }

  static async getDevices(): Promise<AudioDevice[]> {
    const ffmpegPath = getFfmpegPath();
    
    return new Promise((resolve) => {
      const platform = process.platform;

      if (platform === 'darwin') {
        exec(`"${ffmpegPath}" -f avfoundation -list_devices true -i "" 2>&1`, (_err: any, stdout: string, stderr: string) => {
          const output = stdout + stderr;
          const lines = output.split('\n');
          const devices: AudioDevice[] = [];
          let captureSection = false;

          for (const line of lines) {
            if (line.includes('AVFoundation audio devices')) {
              captureSection = true;
              continue;
            }
            if (captureSection && line.includes('[AVFoundation')) {
              const match = line.match(/\[(\d+)\]\s+(.+)/);
              if (match) {
                devices.push({
                  id: parseInt(match[1]),
                  name: match[2].trim(),
                });
              }
            }
            if (captureSection && line.includes('video devices')) {
              break;
            }
          }
          resolve(devices.length > 0 ? devices : [{ id: 0, name: 'Default Microphone', isDefault: true }]);
        });
      } else if (platform === 'win32') {
        exec(`"${ffmpegPath}" -f dshow -list_devices true -i "" 2>&1`, (_err: any, stdout: string, stderr: string) => {
          const output = stdout + stderr;
          const lines = output.split('\n');
          const devices: AudioDevice[] = [];

          for (const line of lines) {
            const match = line.match(/\[dshow.*\]\s+"(.+)"\s+\(audio\)/);
            if (match) {
              devices.push({
                id: devices.length,
                name: match[1].trim(),
              });
            }
          }
          resolve(devices.length > 0 ? devices : [{ id: 0, name: 'Default Microphone', isDefault: true }]);
        });
      } else {
        resolve([{ id: 0, name: 'Default Microphone', isDefault: true }]);
      }
    });
  }

  static async getDefaultDeviceIndex(): Promise<number> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return new Promise((resolve) => {
        exec('system_profiler SPAudioDataType 2>/dev/null', async (_err: any, stdout: string) => {
          try {
            const devices = await AudioCapture.getDevices();
            const lines = stdout.split('\n');
            
            let currentDeviceName = '';
            let isInInputSection = false;
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.endsWith(':') && !line.includes(': ') && line.length > 1) {
                if (line.includes('Input') || line.includes('Microphone')) {
                  isInInputSection = true;
                } else if (line.includes('Output') || line.includes('Speaker')) {
                  isInInputSection = false;
                }
                currentDeviceName = line.replace(':', '').trim();
              }
              
              if (isInInputSection && line.includes('Default Input Device: Yes')) {
                log(`[Audio] Found default input device: "${currentDeviceName}"`);
                const deviceIndex = devices.findIndex(d => {
                  const deviceLower = d.name.toLowerCase();
                  const currentLower = currentDeviceName.toLowerCase();
                  return deviceLower.includes(currentLower) || currentLower.includes(deviceLower);
                });
                if (deviceIndex >= 0) {
                  log(`[Audio] Using device index ${deviceIndex}: "${devices[deviceIndex].name}"`);
                  resolve(deviceIndex);
                  return;
                }
              }
            }
            
            log('[Audio] Could not detect default device, using index 0');
            resolve(0);
          } catch (e) {
            log(`[Audio] Error detecting default device: ${e}`);
            resolve(0);
          }
        });
      });
    }

    if (platform === 'win32') {
      log('[Audio] Windows: using default audio device');
      return 0;
    }

    throw new Error(`Unsupported platform: ${platform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    this.isRecording = true;
    this.audioBuffer = [];
    this.isProcessingTranscript = false;
    this.isSpeaking = false;
    this.speechBuffer = [];
    this.silenceChunkCount = 0;
    this.lastTranscriptTime = 0;
    this.chunkCount = 0;
    this.speechChunkCount = 0;
    this.totalSpeechChunks = 0;
    
    this.noiseHistory = [];
    this.noiseFloor = 0.01;
    this.speechThreshold = 0.03;
    this.silenceThreshold = 0.015;
    this.lastLevel = 0;

    if (this.deviceId === undefined) {
      this.deviceId = await AudioCapture.getDefaultDeviceIndex();
    }

    await this.captureAudio();
  }

  private async captureAudio(): Promise<void> {
    const osPlatform = process.platform;
    const ffmpegPath = getFfmpegPath();
    let ffmpegArgs: string[];

    if (osPlatform === 'darwin') {
      const deviceIndex = this.deviceId !== undefined ? this.deviceId : 0;
      ffmpegArgs = [
        '-f', 'avfoundation',
        '-i', `:${deviceIndex}`,
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else if (osPlatform === 'win32') {
      ffmpegArgs = [
        '-f', 'dshow',
        '-i', 'audio=Default',
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else {
      throw new Error(`Unsupported platform: ${osPlatform}. Typefree supports macOS (Apple Silicon) and Windows 11.`);
    }

    log(`[Audio] Starting FFmpeg`);
    this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    const ffmpeg = this.ffmpegProcess;
    
    ffmpeg.on('error', (err: Error) => {
      log(`[Audio] FFmpeg error: ${err}`);
      this.isRecording = false;
    });

    ffmpeg.on('close', () => {
      log('[Audio] FFmpeg process closed');
      this.isRecording = false;
      if (this.onAudioLevel) {
        this.onAudioLevel(0);
      }
    });

    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      this.chunkCount++;
      this.audioBuffer.push(chunk);
      this.trimBuffer();
      
      const level = calculateAudioLevel(chunk);
      
      if (this.onAudioLevel) {
        const displayLevel = Math.min(level * 100, 1);
        this.onAudioLevel(displayLevel);
      }
      
      this.processSpeechDetection(chunk, level);
    });
  }

  private processSpeechDetection(chunk: Buffer, level: number): void {
    this.lastLevel = level;
    
    if (level < this.speechThreshold * 0.5) {
      this.noiseHistory.push(level);
      if (this.noiseHistory.length > NOISE_HISTORY_SIZE) {
        this.noiseHistory.shift();
      }
      
      if (this.noiseHistory.length >= MIN_CALIBRATION_SAMPLES) {
        this.updateThresholds();
      }
    }
    
    if (!this.isSpeaking) {
      if (level >= this.speechThreshold) {
        log(`[Audio] Speech started, level=${level.toFixed(4)} (threshold: ${this.speechThreshold.toFixed(4)})`);
        this.isSpeaking = true;
        this.silenceChunkCount = 0;
        this.speechChunkCount = 0;
        this.speechBuffer = [...this.audioBuffer.slice(-10)];
      }
    } else {
      this.speechBuffer.push(chunk);
      this.speechChunkCount++;
      this.totalSpeechChunks++;
      
      if (level < this.silenceThreshold) {
        this.silenceChunkCount++;
        if (this.silenceChunkCount === 1) {
          log(`[Audio] Silence detected, level=${level.toFixed(4)} threshold=${this.silenceThreshold.toFixed(4)}`);
        }
        if (this.silenceChunkCount >= SILENCE_CHUNKS_NEEDED) {
          log(`[Audio] Speech ended after ${this.silenceChunkCount} silent chunks, total speech chunks: ${this.speechChunkCount}`);
          this.isSpeaking = false;
          this.silenceChunkCount = 0;
          
          this.onSpeechEnd?.();
          
          if (this.speechChunkCount >= MIN_SPEECH_CHUNKS) {
            this.triggerVadTranscription();
          } else {
            log(`[Audio] Skipping VAD - not enough speech chunks (${this.speechChunkCount} < ${MIN_SPEECH_CHUNKS})`);
          }
        }
      } else {
        this.silenceChunkCount = 0;
      }
    }
  }

  private updateThresholds(): void {
    const levels = [...this.noiseHistory];
    
    levels.sort((a, b) => a - b);
    const median = levels[Math.floor(levels.length / 2)];
    
    let sumSquaredDiff = 0;
    for (const l of levels) {
      sumSquaredDiff += (l - median) * (l - median);
    }
    const stdDev = Math.sqrt(sumSquaredDiff / levels.length);
    
    this.noiseFloor = median;
    
    const adaptiveSpeechThreshold = median + NOISE_FLOOR_MARGIN * stdDev;
    const adaptiveSilenceThreshold = median + stdDev;
    
    this.speechThreshold = Math.max(adaptiveSpeechThreshold, MIN_SPEECH_THRESHOLD);
    this.silenceThreshold = Math.max(adaptiveSilenceThreshold, MIN_SILENCE_THRESHOLD);
  }

  private triggerVadTranscription(): void {
    const now = Date.now();
    if (now - this.lastTranscriptTime < MIN_TIME_BETWEEN_TRANSCRIPTS) {
      log('[Audio] Skipping VAD - too soon since last transcript');
      return;
    }
    
    if (this.speechBuffer.length === 0 || !this.sttService || this.isProcessingTranscript) {
      return;
    }

    const audioData = Buffer.concat(this.speechBuffer);
    this.speechBuffer = [];
    
    if (audioData.length < MIN_AUDIO_SIZE) {
      log(`[Audio] Speech audio too small: ${audioData.length} bytes`);
      return;
    }
    
    this.lastTranscriptTime = now;
    this.isProcessingTranscript = true;
    const wavBuffer = this.createWavBuffer(audioData);
    
    (async () => {
      try {
        log('[Audio] Starting VAD transcription...');
        const transcript = await this.sttService!.transcribe(wavBuffer);
        log(`[Audio] VAD transcript: "${transcript}"`);
        if (transcript && this.onTranscript && this.isRecording) {
          this.onTranscript(transcript);
        }
      } catch (error) {
        log(`[Audio] Transcription error: ${error}`);
      } finally {
        this.isProcessingTranscript = false;
      }
    })();
  }

  private trimBuffer(): void {
    let totalSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    while (totalSize > MAX_BUFFER_SIZE && this.audioBuffer.length > 1) {
      const removed = this.audioBuffer.shift();
      totalSize -= removed?.length || 0;
    }
    
    totalSize = this.speechBuffer.reduce((sum, buf) => sum + buf.length, 0);
    while (totalSize > MAX_BUFFER_SIZE && this.speechBuffer.length > 1) {
      const removed = this.speechBuffer.shift();
      totalSize -= removed?.length || 0;
    }
  }

  private createWavBuffer(audioData: Buffer): Buffer {
    const wavHeader = Buffer.alloc(44);
    const dataSize = audioData.length;
    const fileSize = dataSize + 36;

    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(fileSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(this.channels, 22);
    wavHeader.writeUInt32LE(this.sampleRate, 24);
    wavHeader.writeUInt32LE(this.sampleRate * this.channels * 2, 28);
    wavHeader.writeUInt16LE(this.channels * 2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    return Buffer.concat([wavHeader, audioData]);
  }

  async stopRecording(): Promise<Buffer> {
    if (!this.isRecording) {
      return Buffer.alloc(0);
    }

    this.isRecording = false;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }

    while (this.isProcessingTranscript) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
    
    if (audioData.length < MIN_AUDIO_SIZE) {
      return Buffer.alloc(0);
    }
    
    return this.createWavBuffer(audioData);
  }

  getTotalSpeechChunks(): number {
    return this.totalSpeechChunks;
  }

  getThresholds(): { noiseFloor: number; speechThreshold: number; silenceThreshold: number } {
    return {
      noiseFloor: this.noiseFloor,
      speechThreshold: this.speechThreshold,
      silenceThreshold: this.silenceThreshold,
    };
  }

  startLevelPolling(): void {
    if (this.levelPollingProcess) return;
    if (this.isRecording) return;
    
    const ffmpegPath = getFfmpegPath();
    const osPlatform = process.platform;
    let ffmpegArgs: string[];

    if (osPlatform === 'darwin') {
      const deviceIndex = this.deviceId != null ? this.deviceId : 0;
      ffmpegArgs = [
        '-f', 'avfoundation',
        '-i', `:${deviceIndex}`,
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else if (osPlatform === 'win32') {
      ffmpegArgs = [
        '-f', 'dshow',
        '-i', 'audio=Default',
        '-acodec', 'pcm_s16le',
        '-ar', String(this.sampleRate),
        '-ac', String(this.channels),
        '-f', 's16le',
        'pipe:1'
      ];
    } else {
      return;
    }

    this.levelPollingProcess = spawn(ffmpegPath, ffmpegArgs);
    const ffmpeg = this.levelPollingProcess;

    ffmpeg.on('error', (err: Error) => {
      log(`[Audio] Level polling FFmpeg error: ${err}`);
      this.levelPollingProcess = null;
    });

    ffmpeg.on('close', () => {
      this.levelPollingProcess = null;
    });

    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      if (this.onAudioLevel && !this.isRecording) {
        const level = calculateAudioLevel(chunk);
        const displayLevel = Math.min(level * 100, 1);
        this.onAudioLevel(displayLevel);
      }
    });
  }

  stopLevelPolling(): void {
    if (this.levelPollingProcess) {
      this.levelPollingProcess.kill('SIGTERM');
      this.levelPollingProcess = null;
    }
  }
}
