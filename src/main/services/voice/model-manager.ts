import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { execFileSync } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { IPC } from '../../../shared/ipc-channels';
import type { VoiceModelInfo } from '../../../shared/voice-types';

const MODELS_DIR = path.join(app.getPath('home'), '.clubhouse', 'voice-models');

const WHISPER_MODEL = {
  name: 'ggml-base.en.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  expectedSize: 147_951_465, // ~141MB
};

const PIPER_VOICE = {
  name: 'en_GB-vctk-medium.onnx',
  url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/vctk/medium/en_GB-vctk-medium.onnx',
  expectedSize: 78_000_000, // ~75MB approximate
};

const PIPER_VOICE_JSON = {
  name: 'en_GB-vctk-medium.onnx.json',
  url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/vctk/medium/en_GB-vctk-medium.onnx.json',
  expectedSize: 5_000, // small config file
};

const PIPER_BINARY = {
  name: process.platform === 'darwin' ? 'piper' : 'piper',
  url: process.platform === 'darwin' && process.arch === 'arm64'
    ? 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz'
    : 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz',
  expectedSize: 15_000_000, // ~15MB archive
};

// The piper release is missing shared libraries — they ship in the piper-phonemize release
const PIPER_PHONEMIZE = {
  url: process.platform === 'darwin' && process.arch === 'arm64'
    ? 'https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_aarch64.tar.gz'
    : 'https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_x64.tar.gz',
  expectedSize: 30_000_000, // ~30MB archive
};

function ensureModelsDir(): void {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

function getModelPath(name: string): string {
  return path.join(MODELS_DIR, name);
}

function isModelReady(name: string): boolean {
  const p = getModelPath(name);
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

export function checkModels(): VoiceModelInfo[] {
  ensureModelsDir();

  return [
    {
      name: WHISPER_MODEL.name,
      path: getModelPath(WHISPER_MODEL.name),
      size: WHISPER_MODEL.expectedSize,
      ready: isModelReady(WHISPER_MODEL.name),
    },
    {
      name: PIPER_VOICE.name,
      path: getModelPath(PIPER_VOICE.name),
      size: PIPER_VOICE.expectedSize,
      ready: isModelReady(PIPER_VOICE.name),
    },
    {
      name: PIPER_BINARY.name,
      path: getModelPath('piper/piper/piper'),
      size: PIPER_BINARY.expectedSize,
      ready: isModelReady('piper/piper/piper'),
    },
  ];
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] || null;
}

function sendProgress(model: string, percent: number, bytesDownloaded: number, bytesTotal: number): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.VOICE.DOWNLOAD_PROGRESS, { model, percent, bytesDownloaded, bytesTotal });
  }
}

export function downloadFile(url: string, destPath: string, modelName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      reject(new Error(`Invalid download URL: ${url}`));
      return;
    }

    const get = parsedUrl.protocol === 'https:' ? https.get : http.get;

    const request = get(parsedUrl, (response) => {
      // Follow redirects (301, 302, 307, 308)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        // Resolve redirect URL against original to handle both absolute and relative locations
        let redirectUrl: string;
        try {
          redirectUrl = new URL(response.headers.location, url).href;
        } catch {
          reject(new Error(`Invalid redirect URL: ${response.headers.location}`));
          return;
        }
        downloadFile(redirectUrl, destPath, modelName).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        sendProgress(modelName, percent, downloadedBytes, totalBytes);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(tmpPath, destPath);
          resolve();
        });
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      reject(err);
    });
  });
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  const { execSync } = await import('child_process');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { timeout: 30000 });
  fs.unlinkSync(archivePath);
}

/**
 * Rewrite @rpath dylib references to @loader_path so piper can find its libs.
 * Same pattern as fixDylibPathsIfNeeded in stt-service.ts for whisper.
 */
function fixPiperDylibPaths(piperDir: string): void {
  if (os.platform() !== 'darwin') return;

  const marker = path.join(piperDir, '.dylib-paths-fixed');
  if (fs.existsSync(marker)) return;

  const dylibs = fs.readdirSync(piperDir).filter(f => f.endsWith('.dylib'));
  const bins = [
    ...dylibs.map(f => path.join(piperDir, f)),
    path.join(piperDir, 'piper'),
    path.join(piperDir, 'piper_phonemize'),
  ].filter(f => fs.existsSync(f));

  for (const bin of bins) {
    let otoolOut: string;
    try {
      otoolOut = execFileSync('otool', ['-L', bin], { encoding: 'utf-8' });
    } catch {
      continue;
    }

    for (const line of otoolOut.split('\n')) {
      const match = line.match(/^\s+(.+\.dylib)\s+\(/);
      if (!match) continue;
      const libPath = match[1];
      if (libPath.startsWith('/usr/lib') || libPath.startsWith('/System')) continue;
      if (libPath.startsWith('@loader_path') || libPath.startsWith('@executable_path')) continue;

      const libName = path.basename(libPath);
      try {
        execFileSync('install_name_tool', ['-change', libPath, `@loader_path/${libName}`, bin]);
      } catch { /* best effort */ }
    }

    if (bin.endsWith('.dylib')) {
      try {
        execFileSync('install_name_tool', ['-id', `@loader_path/${path.basename(bin)}`, bin]);
      } catch { /* best effort */ }
    }

    try {
      execFileSync('codesign', ['--force', '--sign', '-', bin]);
    } catch { /* ad-hoc signing */ }
  }

  try { fs.writeFileSync(marker, ''); } catch { /* ignore */ }
}

export async function downloadModels(): Promise<void> {
  ensureModelsDir();

  // Download whisper model
  if (!isModelReady(WHISPER_MODEL.name)) {
    await downloadFile(WHISPER_MODEL.url, getModelPath(WHISPER_MODEL.name), WHISPER_MODEL.name);
  }

  // Download piper voice model + config
  if (!isModelReady(PIPER_VOICE.name)) {
    await downloadFile(PIPER_VOICE.url, getModelPath(PIPER_VOICE.name), PIPER_VOICE.name);
  }
  if (!isModelReady(PIPER_VOICE_JSON.name)) {
    await downloadFile(PIPER_VOICE_JSON.url, getModelPath(PIPER_VOICE_JSON.name), PIPER_VOICE_JSON.name);
  }

  // Download and extract piper binary
  if (!isModelReady('piper/piper/piper')) {
    const archivePath = getModelPath('piper.tar.gz');
    await downloadFile(PIPER_BINARY.url, archivePath, 'piper');
    await extractTarGz(archivePath, getModelPath('piper'));

    // The piper release is missing shared libraries — download piper-phonemize for them
    const phonemizePath = getModelPath('piper-phonemize.tar.gz');
    await downloadFile(PIPER_PHONEMIZE.url, phonemizePath, 'piper (libs)');
    await extractTarGz(phonemizePath, getModelPath('piper-phonemize-tmp'));

    // Copy dylibs next to the piper binary
    const libDir = getModelPath('piper-phonemize-tmp/piper-phonemize/lib');
    const piperDir = getModelPath('piper/piper');
    if (fs.existsSync(libDir)) {
      for (const file of fs.readdirSync(libDir)) {
        if (file.endsWith('.dylib')) {
          const src = path.join(libDir, file);
          const dest = path.join(piperDir, file);
          fs.copyFileSync(src, dest);
        }
      }
    }
    // Clean up temp extraction
    fs.rmSync(getModelPath('piper-phonemize-tmp'), { recursive: true, force: true });

    // Fix @rpath → @loader_path in piper binary and dylibs (same pattern as whisper)
    fixPiperDylibPaths(piperDir);

    // Make binaries executable
    for (const bin of ['piper', 'piper_phonemize']) {
      const binPath = path.join(piperDir, bin);
      if (fs.existsSync(binPath)) {
        fs.chmodSync(binPath, 0o755);
      }
    }
  }
}

export function deleteModels(): void {
  if (fs.existsSync(MODELS_DIR)) {
    fs.rmSync(MODELS_DIR, { recursive: true });
  }
}

export function getModelUrls(): string[] {
  return [WHISPER_MODEL.url, PIPER_VOICE.url, PIPER_VOICE_JSON.url, PIPER_BINARY.url];
}

export function getModelPaths(): { whisper: string; piperBinary: string; piperVoice: string; piperVoiceConfig: string } {
  return {
    whisper: getModelPath(WHISPER_MODEL.name),
    piperBinary: getModelPath('piper/piper/piper'),
    piperVoice: getModelPath(PIPER_VOICE.name),
    piperVoiceConfig: getModelPath(PIPER_VOICE_JSON.name),
  };
}
