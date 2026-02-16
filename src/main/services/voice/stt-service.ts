import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { execFileSync } from 'child_process';
import { app } from 'electron';
import { getModelPaths } from './model-manager';

// Lazy-load the native addon to avoid crashing the app at startup.
// We bypass the addon's own loadAddon() because:
// 1. It has a platform mapping bug (constructs "darwin-arm64" but ships "mac-arm64")
// 2. webpack transforms require.resolve() into a numeric module ID, not a path
// 3. The .node binary lives in app.asar.unpacked/ in the packaged app
let whisperTranscribe: ((opts: Record<string, unknown>) => Promise<any>) | null = null;

const PLATFORM_DIR: Record<string, string> = {
  darwin: 'mac',
  win32: 'win32',
  linux: 'linux',
};

/**
 * Rewrite hardcoded absolute dylib paths in Mach-O binaries to use @loader_path.
 * The upstream @kutalia/whisper-node-addon package embeds CI build paths.
 * This is a no-op if paths are already correct or if not on macOS.
 */
function fixDylibPathsIfNeeded(addonDir: string): void {
  if (os.platform() !== 'darwin') return;

  // Marker file so we only fix once per directory
  const marker = path.join(addonDir, '.dylib-paths-fixed');
  if (fs.existsSync(marker)) return;

  const dylibs = fs.readdirSync(addonDir).filter(f => f.endsWith('.dylib'));
  const bins = [
    ...dylibs.map(f => path.join(addonDir, f)),
    path.join(addonDir, 'whisper.node'),
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

      // Rewrite absolute paths AND @rpath references to use @loader_path.
      // @rpath resolves via RPATH entries baked into the binary, which point to
      // the CI runner's build directory (/Users/runner/work/...).
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
    } catch { /* ad-hoc signing, ignore failures */ }
  }

  // Write marker so we don't repeat on next launch
  try { fs.writeFileSync(marker, ''); } catch { /* ignore */ }
}

function getWhisper() {
  if (!whisperTranscribe) {
    const platformDir = PLATFORM_DIR[os.platform()];
    if (!platformDir) throw new Error(`Unsupported platform: ${os.platform()}`);

    const basePath = app.getAppPath().replace('app.asar', 'app.asar.unpacked');
    const addonDir = path.join(
      basePath, 'node_modules', '@kutalia', 'whisper-node-addon',
      'dist', `${platformDir}-${os.arch()}`,
    );
    const nodePath = path.join(addonDir, 'whisper.node');

    // Fix hardcoded CI paths in dylibs (first run only, writes a marker file)
    fixDylibPathsIfNeeded(addonDir);

    const mod = { exports: {} } as any;
    process.dlopen(mod, nodePath);
    whisperTranscribe = promisify(mod.exports.whisper);
  }
  return whisperTranscribe!;
}

/**
 * Transcribe raw PCM audio using Whisper.
 * Input: Float32Array of 16kHz mono PCM samples.
 * Returns: Transcribed text string.
 */
export async function transcribe(pcmBuffer: Float32Array): Promise<string> {
  if (pcmBuffer.length === 0) {
    return '';
  }

  const paths = getModelPaths();

  try {
    // We bypass the addon's JS wrapper (which applies defaults) and call the
    // native binary directly, so we must supply ALL expected parameters.
    const result = await getWhisper()({
      pcmf32: pcmBuffer,
      model: paths.whisper,
      language: 'en',
      use_gpu: true,
      flash_attn: false,
      no_prints: true,
      comma_in_time: false,
      translate: false,
      no_timestamps: true,
      detect_language: false,
      audio_ctx: 0,
      max_len: 0,
    });

    // result.transcription is string[] (no_timestamps: true) or string[][] (with timestamps)
    const segments: (string | string[])[] = result.transcription;
    if (!segments || segments.length === 0) {
      return '';
    }

    // With no_timestamps, each entry is a string; join them
    const text = segments
      .map((s: string | string[]) => (Array.isArray(s) ? s[s.length - 1] : s))
      .join(' ')
      .trim();

    return text;
  } catch (err) {
    throw new Error(
      `Whisper transcription failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
