import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { LogEntry } from '../../shared/types';
import * as logSettings from './log-settings';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const RETENTION_DAYS = 7;
const FLUSH_INTERVAL_MS = 1_000;
const FLUSH_ENTRY_THRESHOLD = 50;

let logDir: string;
let sessionBase: string;
let currentChunk = 0;
let currentFilePath: string;
let currentFileSize = 0;
let buffer: string[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
const seenNamespaces = new Set<string>();

function ensureLogDir(): void {
  if (!logDir) {
    logDir = path.join(app.getPath('home'), '.clubhouse', 'logs');
  }
  fs.mkdirSync(logDir, { recursive: true });
}

function buildFilePath(chunk: number): string {
  if (chunk === 0) return path.join(logDir, `session-${sessionBase}.jsonl`);
  return path.join(logDir, `session-${sessionBase}.${chunk}.jsonl`);
}

function openSessionFile(): void {
  currentFilePath = buildFilePath(currentChunk);
  try {
    const stat = fs.statSync(currentFilePath);
    currentFileSize = stat.size;
  } catch {
    currentFileSize = 0;
  }
}

function rotate(): void {
  currentChunk += 1;
  openSessionFile();
}

function cleanup(): void {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(logDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('session-') || !entry.name.endsWith('.jsonl')) {
      continue;
    }
    const filePath = path.join(logDir, entry.name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

export function flush(): void {
  if (buffer.length === 0) return;
  const data = buffer.join('\n') + '\n';
  buffer = [];
  try {
    fs.appendFileSync(currentFilePath, data, 'utf-8');
    currentFileSize += Buffer.byteLength(data, 'utf-8');
    if (currentFileSize >= MAX_FILE_SIZE) {
      rotate();
    }
  } catch {
    // If we can't write, drop the entries rather than crashing
  }
}

export function log(entry: LogEntry): void {
  const settings = logSettings.getSettings();
  if (!settings.enabled) return;

  seenNamespaces.add(entry.ns);

  // Check namespace filter: if explicitly set to false, skip
  if (settings.namespaces[entry.ns] === false) return;

  const line = JSON.stringify(entry);
  buffer.push(line);

  if (buffer.length >= FLUSH_ENTRY_THRESHOLD) {
    flush();
  }
}

export function appLog(
  ns: string,
  level: LogEntry['level'],
  msg: string,
  opts?: { projectId?: string; meta?: Record<string, unknown> },
): void {
  log({
    ts: new Date().toISOString(),
    ns,
    level,
    msg,
    projectId: opts?.projectId,
    meta: opts?.meta,
  });
}

export function getLogPath(): string {
  return logDir;
}

export function getNamespaces(): string[] {
  return [...seenNamespaces].sort();
}

export function init(): void {
  ensureLogDir();
  sessionBase = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
  currentChunk = 0;
  openSessionFile();
  cleanup();

  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  app.on('before-quit', () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    flush();
  });
}
