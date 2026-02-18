import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

import * as fs from 'fs';
import { readClaudeMd, writeClaudeMd, readPermissions, writePermissions } from './agent-settings-service';

const WORKTREE = '/test/worktree';

describe('readClaudeMd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads from CLAUDE.md at project root', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p) === path.join(WORKTREE, 'CLAUDE.md')) return '# Project content';
      throw new Error('not found');
    });

    const result = readClaudeMd(WORKTREE);
    expect(result).toBe('# Project content');
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(
      path.join(WORKTREE, 'CLAUDE.md'),
      'utf-8',
    );
  });

  it('does not read from .claude/CLAUDE.local.md', () => {
    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p).includes('CLAUDE.local.md')) return '# Local content';
      throw new Error('not found');
    });

    const result = readClaudeMd(WORKTREE);
    expect(result).toBe('');
  });

  it('returns empty string when file does not exist', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('not found');
    });

    const result = readClaudeMd(WORKTREE);
    expect(result).toBe('');
  });
});

describe('writeClaudeMd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to CLAUDE.md at project root', () => {
    writeClaudeMd(WORKTREE, '# New content');
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      path.join(WORKTREE, 'CLAUDE.md'),
      '# New content',
      'utf-8',
    );
  });

  it('does not create .claude directory', () => {
    writeClaudeMd(WORKTREE, '# Content');
    expect(vi.mocked(fs.mkdirSync)).not.toHaveBeenCalled();
  });
});

describe('readPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads allow and deny from settings.local.json', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      permissions: {
        allow: ['Bash(git:*)', 'Read'],
        deny: ['WebFetch'],
      },
      hooks: { PreToolUse: [] },
    }));

    const result = readPermissions(WORKTREE);
    expect(result.allow).toEqual(['Bash(git:*)', 'Read']);
    expect(result.deny).toEqual(['WebFetch']);
  });

  it('returns empty object when file does not exist', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });

    const result = readPermissions(WORKTREE);
    expect(result).toEqual({});
  });

  it('returns empty object when permissions key is missing', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: { PreToolUse: [] },
    }));

    const result = readPermissions(WORKTREE);
    expect(result).toEqual({});
  });

  it('handles missing allow or deny arrays', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      permissions: { allow: ['Read'] },
    }));

    const result = readPermissions(WORKTREE);
    expect(result.allow).toEqual(['Read']);
    expect(result.deny).toBeUndefined();
  });
});

describe('writePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes permissions to settings.local.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

    writePermissions(WORKTREE, { allow: ['Read', 'Write'], deny: ['WebFetch'] });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.allow).toEqual(['Read', 'Write']);
    expect(written.permissions.deny).toEqual(['WebFetch']);
  });

  it('preserves existing hooks when writing permissions', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'echo test' }] }] },
    }));

    writePermissions(WORKTREE, { allow: ['Bash(git:*)'] });

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.allow).toEqual(['Bash(git:*)']);
    expect(written.hooks.PreToolUse).toHaveLength(1);
  });

  it('removes permissions key when both arrays are empty', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      permissions: { allow: ['Read'] },
      hooks: {},
    }));

    writePermissions(WORKTREE, { allow: [], deny: [] });

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions).toBeUndefined();
    expect(written.hooks).toBeDefined();
  });

  it('creates .claude directory if it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });

    writePermissions(WORKTREE, { allow: ['Read'] });

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join(WORKTREE, '.claude'),
      { recursive: true },
    );
  });

  it('handles only allow without deny', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

    writePermissions(WORKTREE, { allow: ['Bash(git:*)'] });

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.allow).toEqual(['Bash(git:*)']);
    expect(written.permissions.deny).toBeUndefined();
  });

  it('handles only deny without allow', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

    writePermissions(WORKTREE, { deny: ['WebFetch'] });

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.permissions.deny).toEqual(['WebFetch']);
    expect(written.permissions.allow).toBeUndefined();
  });
});
