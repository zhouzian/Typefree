import * as fs from 'fs';
import * as path from 'path';

function rimraf(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mkdirp(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function cp(src: string, dest: string): void {
  if (fs.statSync(src).isDirectory()) {
    mkdirp(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        cp(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('Cleaning dist...');
rimraf(distDir);

console.log('Compiling TypeScript...');
const { execSync } = require('child_process');
execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });
execSync('npx tsc -p tsconfig.renderer.json', { cwd: rootDir, stdio: 'inherit' });
execSync('npx tsc -p tsconfig.settings.json', { cwd: rootDir, stdio: 'inherit' });

console.log('Copying assets...');
mkdirp(path.join(distDir, 'renderer'));
mkdirp(path.join(distDir, 'settings'));
mkdirp(path.join(distDir, 'assets/icons'));
mkdirp(path.join(distDir, 'assets/sounds'));

cp(
  path.join(rootDir, 'src/renderer/index.html'),
  path.join(distDir, 'renderer/index.html')
);
cp(
  path.join(rootDir, 'src/renderer/styles.css'),
  path.join(distDir, 'renderer/styles.css')
);
cp(
  path.join(rootDir, 'src/settings/index.html'),
  path.join(distDir, 'settings/index.html')
);
cp(
  path.join(rootDir, 'src/settings/styles.css'),
  path.join(distDir, 'settings/styles.css')
);
cp(
  path.join(rootDir, 'src/assets/sounds'),
  path.join(distDir, 'assets/sounds')
);

const buildIconsDir = path.join(rootDir, 'build/icons');
if (fs.existsSync(buildIconsDir)) {
  cp(
    path.join(buildIconsDir, 'tray.png'),
    path.join(distDir, 'assets/icons/tray.png')
  );
  cp(
    path.join(buildIconsDir, 'tray-recording.png'),
    path.join(distDir, 'assets/icons/tray-recording.png')
  );
}

console.log('Build complete!');
