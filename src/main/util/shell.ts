import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const CLAUDE_NAMES = ['claude'];

let cachedShellEnv: Record<string, string> | null = null;

/** Source the user's login shell to get the full environment.
 *  Packaged macOS apps launched from Finder/Dock only get a minimal PATH. */
function getShellEnv(): Record<string, string> {
  if (cachedShellEnv) return cachedShellEnv;
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const raw = execSync(`${shell} -ilc 'env'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const env: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        env[line.slice(0, idx)] = line.slice(idx + 1);
      }
    }
    cachedShellEnv = { ...process.env, ...env } as Record<string, string>;
  } catch {
    cachedShellEnv = { ...process.env } as Record<string, string>;
  }
  return cachedShellEnv;
}

/** Returns the user's full shell environment — use for spawning processes. */
export function getShellEnvironment(): Record<string, string> {
  return getShellEnv();
}

export function findClaudeBinary(): string {
  const home = app.getPath('home');

  // Check common locations first
  const commonPaths = [
    path.join(home, '.local/bin/claude'),
    path.join(home, '.claude/local/claude'),
    path.join(home, '.npm-global/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Resolve from the user's full shell PATH
  const shellPATH = getShellEnv().PATH || process.env.PATH || '';
  for (const dir of shellPATH.split(':')) {
    if (!dir) continue;
    for (const name of CLAUDE_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // Last resort: try which via a login shell
  for (const name of CLAUDE_NAMES) {
    try {
      const shell = process.env.SHELL || '/bin/zsh';
      const result = execSync(`${shell} -ilc 'which ${name}'`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch {
      // continue
    }
  }

  throw new Error(
    'Could not find the claude CLI binary. Make sure it is installed and on your PATH.'
  );
}
