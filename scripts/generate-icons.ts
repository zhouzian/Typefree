import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

async function createPngFromSvg(svgPath: string, outputPath: string, size: number): Promise<void> {
  const svgBuffer = fs.readFileSync(svgPath);
  
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
}

async function createRecordingIcon(svgPath: string, outputPath: string, size: number): Promise<void> {
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  
  const recordingSvg = svgContent
    .replace(/stop-color:#6366F1/g, 'stop-color:#EF4444')
    .replace(/stop-color:#8B5CF6/g, 'stop-color:#DC2626')
    .replace(/stop-color:#A855F7/g, 'stop-color:#B91C1C');
  
  await sharp(Buffer.from(recordingSvg))
    .resize(size, size)
    .png()
    .toFile(outputPath);
}

async function main() {
  const buildDir = path.join(__dirname, '../build/icons');
  const svgPath = path.join(__dirname, '../build/icon.svg');
  
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  
  console.log('Generating PNG icons from SVG...');
  
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  
  for (const size of sizes) {
    console.log(`  icon-${size}.png`);
    await createPngFromSvg(svgPath, path.join(buildDir, `icon-${size}.png`), size);
  }
  
  console.log('  tray.png');
  await createPngFromSvg(svgPath, path.join(buildDir, 'tray.png'), 22);
  
  console.log('  tray-recording.png');
  await createRecordingIcon(svgPath, path.join(buildDir, 'tray-recording.png'), 22);
  
  const distAssetsDir = path.join(__dirname, '../dist/assets/icons');
  if (fs.existsSync(distAssetsDir)) {
    await createPngFromSvg(svgPath, path.join(distAssetsDir, 'tray.png'), 22);
    await createRecordingIcon(svgPath, path.join(distAssetsDir, 'tray-recording.png'), 22);
  }
  
  console.log('Icons generated successfully!');
}

main().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
