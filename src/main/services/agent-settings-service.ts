import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { McpServerEntry, SkillEntry } from '../../shared/types';

export function readClaudeMd(worktreePath: string): string {
  const filePath = path.join(worktreePath, 'CLAUDE.md');
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function writeClaudeMd(worktreePath: string, content: string): void {
  const filePath = path.join(worktreePath, 'CLAUDE.md');
  fs.writeFileSync(filePath, content, 'utf-8');
}

function parseMcpServers(filePath: string, scope: 'project' | 'global'): McpServerEntry[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const servers = parsed.mcpServers || {};
    return Object.entries(servers).map(([name, config]: [string, Record<string, unknown>]) => ({
      name,
      command: (config.command as string) || '',
      args: config.args as string[] | undefined,
      env: config.env as Record<string, string> | undefined,
      scope,
    }));
  } catch {
    return [];
  }
}

export function readMcpConfig(worktreePath: string): McpServerEntry[] {
  const projectServers = parseMcpServers(path.join(worktreePath, '.mcp.json'), 'project');
  const globalServers = parseMcpServers(path.join(os.homedir(), '.claude.json'), 'global');

  // Dedupe: project-scoped servers take priority over global ones with the same name
  const seen = new Set(projectServers.map((s) => s.name));
  const uniqueGlobal = globalServers.filter((s) => !seen.has(s.name));

  return [...projectServers, ...uniqueGlobal];
}

export function listSkills(worktreePath: string): SkillEntry[] {
  const skillsDir = path.join(worktreePath, '.claude', 'skills');
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const skillPath = path.join(skillsDir, e.name);
        const hasReadme = fs.existsSync(path.join(skillPath, 'README.md'));
        return { name: e.name, path: skillPath, hasReadme };
      });
  } catch {
    return [];
  }
}
