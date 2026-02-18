import * as fs from 'fs';
import * as path from 'path';

const assetsDir = path.join(__dirname, '../src/assets/sounds');
const buildDir = path.join(__dirname, '../build/icons');

function generateWav(frequency: number, durationMs: number, volume: number, fadeInMs: number, fadeOutMs: number): Buffer {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const fadeInSamples = Math.floor(sampleRate * fadeInMs / 1000);
  const fadeOutSamples = Math.floor(sampleRate * fadeOutMs / 1000);
  
  const samples: number[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amplitude = Math.sin(2 * Math.PI * frequency * t);
    
    if (i < fadeInSamples) {
      amplitude *= i / fadeInSamples;
    }
    if (i > numSamples - fadeOutSamples) {
      amplitude *= (numSamples - i) / fadeOutSamples;
    }
    
    samples.push(amplitude * volume * 32767);
  }
  
  const dataLength = numSamples * 2;
  const fileSize = 36 + dataLength;
  
  const buffer = Buffer.alloc(44 + dataLength);
  
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  let offset = 44;
  for (const sample of samples) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample))), offset);
    offset += 2;
  }
  
  return buffer;
}

function generateStartSound(): Buffer {
  const buffers: Buffer[] = [];
  
  buffers.push(generateWav(880, 60, 0.15, 10, 30));
  buffers.push(generateWav(1100, 60, 0.12, 10, 30));
  buffers.push(generateWav(1320, 100, 0.10, 10, 50));
  
  return Buffer.concat(buffers);
}

function generateEndSound(): Buffer {
  const buffers: Buffer[] = [];
  
  buffers.push(generateWav(1320, 60, 0.12, 10, 30));
  buffers.push(generateWav(1100, 60, 0.10, 10, 30));
  buffers.push(generateWav(880, 120, 0.08, 10, 60));
  
  return Buffer.concat(buffers);
}

function main() {
  console.log('Generating sound assets...');
  
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  console.log('Generating start.wav...');
  const startSound = generateStartSound();
  fs.writeFileSync(path.join(assetsDir, 'start.wav'), startSound);
  
  console.log('Generating end.wav...');
  const endSound = generateEndSound();
  fs.writeFileSync(path.join(assetsDir, 'end.wav'), endSound);
  
  console.log('Sounds generated successfully!');
  console.log('');
  console.log('To generate icons, you can:');
  console.log('1. Use an online SVG to PNG converter with the SVGs in build/');
  console.log('2. Install librsvg: brew install librsvg');
  console.log('   Then run: rsvg-convert -w 512 build/icon.svg -o build/icon-512.png');
}

main();
