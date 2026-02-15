/**
 * Frozen API snapshot for plugin API v0.1.
 *
 * DO NOT MODIFY these interfaces — they are the compile-time contract for
 * plugins targeting engine.api: 0.1. Any structural change here intentionally
 * breaks `tsc --noEmit` so we catch backward-compat regressions before runtime.
 */

import type { Disposable, DirectoryEntry, GitStatus, GitCommit, ProjectInfo, PluginAPI } from '../plugin-types';

// ── v0.1 scoped types ─────────────────────────────────────────────────

export interface ScopedStorage_V0_1 {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface AgentInfo_V0_1 {
  id: string;
  name: string;
  kind: 'durable' | 'quick';
  status: 'running' | 'sleeping' | 'error';
}

// ── v0.1 sub-API interfaces ───────────────────────────────────────────

export interface ProjectAPI_V0_1 {
  readonly projectPath: string;
  readonly projectId: string;
  readFile(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  deleteFile(relativePath: string): Promise<void>;
  fileExists(relativePath: string): Promise<boolean>;
  listDirectory(relativePath?: string): Promise<DirectoryEntry[]>;
}

export interface ProjectsAPI_V0_1 {
  list(): ProjectInfo[];
  getActive(): ProjectInfo | null;
}

export interface GitAPI_V0_1 {
  status(): Promise<GitStatus[]>;
  log(limit?: number): Promise<GitCommit[]>;
  currentBranch(): Promise<string>;
  diff(filePath: string, staged?: boolean): Promise<string>;
}

export interface StorageAPI_V0_1 {
  project: ScopedStorage_V0_1;
  global: ScopedStorage_V0_1;
}

export interface UIAPI_V0_1 {
  showNotice(message: string): void;
  showError(message: string): void;
  showConfirm(message: string): Promise<boolean>;
  showInput(prompt: string, defaultValue?: string): Promise<string | null>;
}

export interface CommandsAPI_V0_1 {
  register(commandId: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  execute(commandId: string, ...args: unknown[]): Promise<void>;
}

export interface EventsAPI_V0_1 {
  on(event: string, handler: (...args: unknown[]) => void): Disposable;
}

export interface SettingsAPI_V0_1 {
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  onChange(callback: (key: string, value: unknown) => void): Disposable;
}

export interface AgentsAPI_V0_1 {
  list(): AgentInfo_V0_1[];
  runQuick(mission: string, options?: { model?: string; systemPrompt?: string }): Promise<string>;
}

export interface HubAPI_V0_1 {
  refresh(): void;
}

// ── Composite v0.1 API ────────────────────────────────────────────────

export interface PluginAPI_V0_1 {
  project: ProjectAPI_V0_1;
  projects: ProjectsAPI_V0_1;
  git: GitAPI_V0_1;
  storage: StorageAPI_V0_1;
  ui: UIAPI_V0_1;
  commands: CommandsAPI_V0_1;
  events: EventsAPI_V0_1;
  settings: SettingsAPI_V0_1;
  agents: AgentsAPI_V0_1;
  hub: HubAPI_V0_1;
}

// ── Compile-time backward-compat guard ────────────────────────────────
// Fails to compile if the current PluginAPI drops or changes any v0.1 member.
type _V0_1_BackCompat = PluginAPI extends PluginAPI_V0_1 ? true : never;
const _v0_1_check: _V0_1_BackCompat = true;
void _v0_1_check;
