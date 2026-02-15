import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
  PluginStorageReadRequest,
  PluginStorageWriteRequest,
  PluginStorageDeleteRequest,
  PluginStorageListRequest,
  PluginFileRequest,
} from '../../shared/plugin-types';

function getGlobalPluginDataDir(): string {
  return path.join(app.getPath('home'), '.clubhouse', 'plugin-data');
}

function getStorageDir(pluginId: string, scope: 'project' | 'global', projectPath?: string): string {
  if (scope === 'project' && projectPath) {
    return path.join(projectPath, '.clubhouse', 'plugin-data', pluginId);
  }
  return path.join(getGlobalPluginDataDir(), pluginId);
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertSafePath(base: string, target: string): void {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) {
    throw new Error(`Path traversal detected: ${target}`);
  }
}

// ── Key-Value Storage ──────────────────────────────────────────────────

export function readKey(req: PluginStorageReadRequest): unknown {
  const dir = path.join(getStorageDir(req.pluginId, req.scope, req.projectPath), 'kv');
  const file = path.join(dir, `${req.key}.json`);
  assertSafePath(dir, `${req.key}.json`);
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeKey(req: PluginStorageWriteRequest): void {
  const dir = path.join(getStorageDir(req.pluginId, req.scope, req.projectPath), 'kv');
  assertSafePath(dir, `${req.key}.json`);
  ensureDir(dir);
  const file = path.join(dir, `${req.key}.json`);
  fs.writeFileSync(file, JSON.stringify(req.value), 'utf-8');
}

export function deleteKey(req: PluginStorageDeleteRequest): void {
  const dir = path.join(getStorageDir(req.pluginId, req.scope, req.projectPath), 'kv');
  const file = path.join(dir, `${req.key}.json`);
  assertSafePath(dir, `${req.key}.json`);
  try {
    fs.unlinkSync(file);
  } catch {
    // File doesn't exist, that's fine
  }
}

export function listKeys(req: PluginStorageListRequest): string[] {
  const dir = path.join(getStorageDir(req.pluginId, req.scope, req.projectPath), 'kv');
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

// ── Raw File Operations ────────────────────────────────────────────────

export function readPluginFile(req: PluginFileRequest): string {
  const base = getStorageDir(req.pluginId, req.scope, req.projectPath);
  assertSafePath(base, req.relativePath);
  const filePath = path.join(base, req.relativePath);
  return fs.readFileSync(filePath, 'utf-8');
}

export function writePluginFile(req: PluginFileRequest & { content: string }): void {
  const base = getStorageDir(req.pluginId, req.scope, req.projectPath);
  assertSafePath(base, req.relativePath);
  const filePath = path.join(base, req.relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, req.content, 'utf-8');
}

export function deletePluginFile(req: PluginFileRequest): void {
  const base = getStorageDir(req.pluginId, req.scope, req.projectPath);
  assertSafePath(base, req.relativePath);
  const filePath = path.join(base, req.relativePath);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File doesn't exist
  }
}

export function pluginFileExists(req: PluginFileRequest): boolean {
  const base = getStorageDir(req.pluginId, req.scope, req.projectPath);
  assertSafePath(base, req.relativePath);
  const filePath = path.join(base, req.relativePath);
  return fs.existsSync(filePath);
}

export function listPluginDir(req: PluginFileRequest): Array<{ name: string; isDirectory: boolean }> {
  const base = getStorageDir(req.pluginId, req.scope, req.projectPath);
  assertSafePath(base, req.relativePath);
  const dirPath = path.join(base, req.relativePath);
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  } catch {
    return [];
  }
}

export function mkdirPlugin(pluginId: string, scope: 'project' | 'global', relativePath: string, projectPath?: string): void {
  const base = getStorageDir(pluginId, scope, projectPath);
  assertSafePath(base, relativePath);
  const dirPath = path.join(base, relativePath);
  ensureDir(dirPath);
}
