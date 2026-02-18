import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

function createIcoFile(pngPaths: string[]): Buffer {
  const pngBuffers: Buffer[] = [];
  const sizes: { width: number; height: number; offset: number; size: number }[] = [];
  
  let offset = 6 + pngPaths.length * 16;
  
  for (const pngPath of pngPaths) {
    const png = fs.readFileSync(pngPath);
    pngBuffers.push(png);
    
    const width = png.readUInt8(16) || 256;
    const height = png.readUInt8(20) || 256;
    
    sizes.push({
      width: width >= 256 ? 0 : width,
      height: height >= 256 ? 0 : height,
      offset,
      size: png.length
    });
    
    offset += png.length;
  }
  
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngPaths.length, 4);
  
  const entries: Buffer[] = [];
  for (const size of sizes) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size.width, 0);
    entry.writeUInt8(size.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(size.size, 8);
    entry.writeUInt32LE(size.offset, 12);
    entries.push(entry);
  }
  
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

function main() {
  const iconsDir = path.join(__dirname, '../build/icons');
  const outputPath = path.join(__dirname, '../build/icon.ico');
  
  const pngFiles = [
    path.join(iconsDir, 'icon-16.png'),
    path.join(iconsDir, 'icon-32.png'),
    path.join(iconsDir, 'icon-48.png'),
    path.join(iconsDir, 'icon-64.png'),
    path.join(iconsDir, 'icon-128.png'),
    path.join(iconsDir, 'icon-256.png'),
  ];
  
  const ico = createIcoFile(pngFiles);
  fs.writeFileSync(outputPath, ico);
  
  console.log(`Created ${outputPath} (${ico.length} bytes)`);
}

main();
