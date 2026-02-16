import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

function copyNativeModule(srcRoot: string, destRoot: string, moduleName: string): void {
  const src = path.join(srcRoot, 'node_modules', moduleName);
  const dest = path.join(destRoot, 'node_modules', moduleName);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });

  // Also copy transitive native dependencies listed in the module's package.json
  const pkgPath = path.join(src, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const dep of Object.keys(deps)) {
      const depSrc = path.join(srcRoot, 'node_modules', dep);
      const depDest = path.join(destRoot, 'node_modules', dep);
      if (fs.existsSync(depSrc) && !fs.existsSync(depDest)) {
        fs.cpSync(depSrc, depDest, { recursive: true });
      }
    }
  }
}

/**
 * Rewrite hardcoded absolute dylib paths in the whisper native addon to use
 * @loader_path so they resolve relative to the binary at runtime.
 * The upstream package embeds CI build paths (e.g. /Users/runner/work/...).
 */
function fixWhisperDylibPaths(buildPath: string, platform: string, arch: string): void {
  if (platform !== 'darwin') return;

  const addonDir = path.join(
    buildPath, 'node_modules', '@kutalia', 'whisper-node-addon',
    'dist', `mac-${arch}`,
  );
  if (!fs.existsSync(addonDir)) return;

  const dylibs = fs.readdirSync(addonDir).filter(f => f.endsWith('.dylib'));
  const machoBins = [
    ...dylibs.map(f => path.join(addonDir, f)),
    path.join(addonDir, 'whisper.node'),
  ].filter(f => fs.existsSync(f));

  for (const bin of machoBins) {
    // Read current LC_LOAD_DYLIB entries
    let otoolOut: string;
    try {
      otoolOut = execFileSync('otool', ['-L', bin], { encoding: 'utf-8' });
    } catch {
      continue;
    }

    // Match lines with absolute paths that should be @loader_path-relative
    const lines = otoolOut.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s+(.+\.dylib)\s+\(/);
      if (!match) continue;
      const libPath = match[1];

      // Skip system libs and already-relative paths
      if (libPath.startsWith('/usr/lib') || libPath.startsWith('/System')) continue;
      if (libPath.startsWith('@loader_path') || libPath.startsWith('@rpath') || libPath.startsWith('@executable_path')) continue;

      // Extract the filename and rewrite to @loader_path/
      const libName = path.basename(libPath);
      try {
        execFileSync('install_name_tool', ['-change', libPath, `@loader_path/${libName}`, bin]);
      } catch {
        // Best effort — some may be the install name itself, not a dependency
      }
    }

    // Also fix the install name (id) for dylibs to use @loader_path
    if (bin.endsWith('.dylib')) {
      const libName = path.basename(bin);
      try {
        execFileSync('install_name_tool', ['-id', `@loader_path/${libName}`, bin]);
      } catch {
        // Best effort
      }
    }

    // Re-sign after modification (ad-hoc) — macOS invalidates signatures on modification
    try {
      execFileSync('codesign', ['--force', '--sign', '-', bin]);
    } catch {
      // codesign may not be needed in dev, ignore failures
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Clubhouse',
    appBundleId: 'com.mason-allen.clubhouse',
    icon: path.resolve(__dirname, 'assets', 'icon'),
    extendInfo: {
      CFBundleDisplayName: 'Clubhouse',
      NSUserNotificationAlertStyle: 'alert',
    },
    osxSign: {
      identity: '-', // ad-hoc signing
      optionsForFile: () => ({
        entitlements: path.resolve(__dirname, 'entitlements.plist'),
      }),
    },
    asar: {
      unpack: '{**/node_modules/node-pty/**,**/node_modules/@kutalia/whisper-node-addon/**}',
    },
    afterCopy: [
      (buildPath: string, _electronVersion: string, platform: string, arch: string, callback: (err?: Error) => void) => {
        try {
          const projectRoot = path.resolve(__dirname);
          copyNativeModule(projectRoot, buildPath, 'node-pty');
          copyNativeModule(projectRoot, buildPath, '@kutalia/whisper-node-addon');
          fixWhisperDylibPaths(buildPath, platform, arch);
          callback();
        } catch (err) {
          callback(err as Error);
        }
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      iconUrl: 'https://raw.githubusercontent.com/masonallen/Clubhouse/main/assets/icon.ico',
      setupIcon: path.resolve(__dirname, 'assets', 'icon.ico'),
    }),
    new MakerDeb({
      options: {
        icon: path.resolve(__dirname, 'assets', 'icon.png'),
      },
    }),
    new MakerRpm({
      options: {
        icon: path.resolve(__dirname, 'assets', 'icon.png'),
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      port: 3456,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.ts',
            name: 'main_window',
            preload: {
              js: './src/preload/index.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;
