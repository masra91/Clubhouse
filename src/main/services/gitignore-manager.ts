import * as fs from 'fs';
import * as path from 'path';

function getGitignorePath(projectPath: string): string {
  return path.join(projectPath, '.gitignore');
}

function tagFor(pluginId: string): string {
  return `# clubhouse-plugin: ${pluginId}`;
}

export function addEntries(projectPath: string, pluginId: string, patterns: string[]): void {
  const gitignorePath = getGitignorePath(projectPath);
  const tag = tagFor(pluginId);
  const newLines = patterns.map((p) => `${p} ${tag}`);

  let existing = '';
  try {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist yet
  }

  const linesToAdd = newLines.filter((line) => !existing.includes(line));
  if (linesToAdd.length === 0) return;

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, existing + separator + linesToAdd.join('\n') + '\n', 'utf-8');
}

export function removeEntries(projectPath: string, pluginId: string): void {
  const gitignorePath = getGitignorePath(projectPath);
  const tag = tagFor(pluginId);

  let existing: string;
  try {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    return; // No .gitignore
  }

  const lines = existing.split('\n');
  const filtered = lines.filter((line) => !line.includes(tag));

  // Remove trailing blank lines that were left behind
  while (filtered.length > 0 && filtered[filtered.length - 1] === '') {
    filtered.pop();
  }

  fs.writeFileSync(gitignorePath, filtered.join('\n') + (filtered.length > 0 ? '\n' : ''), 'utf-8');
}

export function isIgnored(projectPath: string, pattern: string): boolean {
  const gitignorePath = getGitignorePath(projectPath);
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content.split('\n').some((line) => line.trim().startsWith(pattern));
  } catch {
    return false;
  }
}
