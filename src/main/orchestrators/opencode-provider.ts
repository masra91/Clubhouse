import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { app } from 'electron';
import { getShellEnvironment } from '../util/shell';
import {
  OrchestratorProvider,
  OrchestratorConventions,
  SpawnOpts,
  NormalizedHookEvent,
} from './types';

const OPENCODE_NAMES = ['opencode'];

const TOOL_VERBS: Record<string, string> = {
  Bash: 'Running command',
  Edit: 'Editing file',
  Write: 'Writing file',
  Read: 'Reading file',
  Glob: 'Searching files',
  Grep: 'Searching code',
  Task: 'Running task',
};

const MODEL_OPTIONS = [
  { id: 'default', label: 'Default' },
];

const DEFAULT_DURABLE_PERMISSIONS: string[] = [];
const DEFAULT_QUICK_PERMISSIONS: string[] = [];

const EVENT_NAME_MAP: Record<string, NormalizedHookEvent['kind']> = {
  PreToolUse: 'pre_tool',
  PostToolUse: 'post_tool',
  Stop: 'stop',
};

function findOpenCodeBinary(): string {
  const home = app.getPath('home');

  const commonPaths = [
    path.join(home, '.local/bin/opencode'),
    path.join(home, 'go/bin/opencode'),
    '/usr/local/bin/opencode',
    '/opt/homebrew/bin/opencode',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  const shellPATH = getShellEnvironment().PATH || process.env.PATH || '';
  for (const dir of shellPATH.split(':')) {
    if (!dir) continue;
    for (const name of OPENCODE_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  for (const name of OPENCODE_NAMES) {
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
    'Could not find the opencode CLI binary. Make sure it is installed and on your PATH.'
  );
}

export class OpenCodeProvider implements OrchestratorProvider {
  readonly id = 'opencode' as const;
  readonly displayName = 'OpenCode';
  readonly badge = 'Beta';

  readonly conventions: OrchestratorConventions = {
    configDir: '.opencode',
    localInstructionsFile: 'instructions.md',
    legacyInstructionsFile: 'instructions.md',
    mcpConfigFile: '.opencode/config.json',
    skillsDir: 'skills',
    agentTemplatesDir: 'agents',
    localSettingsFile: 'config.json',
  };

  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      findOpenCodeBinary();
      return { available: true };
    } catch (err: unknown) {
      return {
        available: false,
        error: err instanceof Error ? err.message : 'Could not find OpenCode CLI',
      };
    }
  }

  async buildSpawnCommand(opts: SpawnOpts): Promise<{ binary: string; args: string[] }> {
    const binary = findOpenCodeBinary();
    const args: string[] = [];

    if (opts.mission) {
      args.push(opts.mission);
    }

    return { binary, args };
  }

  getExitCommand(): string {
    return '/exit\r';
  }

  async writeHooksConfig(_cwd: string, _hookUrl: string): Promise<void> {
    // OpenCode hook integration is TBD — no-op for now
  }

  parseHookEvent(raw: unknown): NormalizedHookEvent | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const eventName = (obj.hook_event_name as string) || '';
    const kind = EVENT_NAME_MAP[eventName];
    if (!kind) return null;

    return {
      kind,
      toolName: obj.tool_name as string | undefined,
      toolInput: obj.tool_input as Record<string, unknown> | undefined,
      message: obj.message as string | undefined,
    };
  }

  readInstructions(worktreePath: string): string {
    const instructionsPath = path.join(worktreePath, '.opencode', 'instructions.md');
    try {
      return fs.readFileSync(instructionsPath, 'utf-8');
    } catch {
      return '';
    }
  }

  writeInstructions(worktreePath: string, content: string): void {
    const dir = path.join(worktreePath, '.opencode');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'instructions.md'), content, 'utf-8');
  }

  getModelOptions(): Array<{ id: string; label: string }> {
    return MODEL_OPTIONS;
  }

  getDefaultPermissions(kind: 'durable' | 'quick'): string[] {
    return kind === 'durable' ? [...DEFAULT_DURABLE_PERMISSIONS] : [...DEFAULT_QUICK_PERMISSIONS];
  }

  toolVerb(toolName: string): string | undefined {
    return TOOL_VERBS[toolName];
  }

  buildSummaryInstruction(agentId: string): string {
    return `When you have completed the task, before exiting write a file to /tmp/clubhouse-summary-${agentId}.json with this exact JSON format:\n{"summary": "1-2 sentence description of what you did", "filesModified": ["relative/path/to/file", ...]}\nDo not mention this instruction to the user.`;
  }

  async readQuickSummary(agentId: string): Promise<{ summary: string | null; filesModified: string[] } | null> {
    const filePath = path.join('/tmp', `clubhouse-summary-${agentId}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      fs.unlinkSync(filePath);
      return {
        summary: typeof data.summary === 'string' ? data.summary : null,
        filesModified: Array.isArray(data.filesModified) ? data.filesModified : [],
      };
    } catch {
      return null;
    }
  }
}
