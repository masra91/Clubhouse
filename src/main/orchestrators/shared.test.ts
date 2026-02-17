import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';

const SEP = path.delimiter; // ':' on Unix, ';' on Windows

// Must vi.mock fs at top level for ESM compat
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
  unlinkSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => { throw new Error('not found'); }),
}));

vi.mock('../util/shell', () => ({
  getShellEnvironment: vi.fn(() => ({ PATH: `/usr/local/bin${path.delimiter}/usr/bin` })),
}));

import * as fs from 'fs';
import { execSync } from 'child_process';
import { findBinaryInPath, homePath, buildSummaryInstruction, readQuickSummary } from './shared';

describe('shared orchestrator utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });
  });

  describe('findBinaryInPath', () => {
    it('returns extraPath if file exists there', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      const result = findBinaryInPath(['claude'], ['/custom/path/claude']);
      expect(result).toBe('/custom/path/claude');
    });

    it('checks extraPaths in order, returns first hit', () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      const result = findBinaryInPath(['claude'], ['/first/claude', '/second/claude']);
      expect(result).toBe('/second/claude');
    });

    it('finds binary on shell PATH', () => {
      const expected = path.join('/usr/local/bin', 'claude');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === expected;
      });
      const result = findBinaryInPath(['claude'], ['/nonexistent/claude']);
      expect(result).toBe(expected);
    });

    it('tries multiple binary names on PATH', () => {
      const expected = path.join('/usr/bin', 'code');
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === expected;
      });
      const result = findBinaryInPath(['claude', 'code'], ['/nope/claude']);
      expect(result).toBe(expected);
    });

    it('skips empty PATH entries', async () => {
      const shell = await import('../util/shell');
      vi.mocked(shell.getShellEnvironment).mockReturnValue({ PATH: `${SEP}/usr/bin${SEP}` } as any);
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join('/usr/bin', 'claude');
      });
      const result = findBinaryInPath(['claude'], []);
      expect(result).toBe(path.join('/usr/bin', 'claude'));
    });

    it('falls back to interactive shell which', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === '/found/by/which/claude';
      });
      vi.mocked(execSync).mockReturnValue('/found/by/which/claude\n');
      const result = findBinaryInPath(['claude'], []);
      expect(result).toBe('/found/by/which/claude');
    });

    it('throws when binary not found anywhere', () => {
      expect(() => findBinaryInPath(['claude'], []))
        .toThrowError(/Could not find any of \[claude\] on PATH/);
    });
  });

  describe('homePath', () => {
    it('joins segments under home directory', () => {
      const result = homePath('.local', 'bin', 'claude');
      expect(result).toBe(path.join('/tmp/clubhouse-test-home', '.local', 'bin', 'claude'));
    });

    it('works with single segment', () => {
      const result = homePath('.claude');
      expect(result).toBe(path.join('/tmp/clubhouse-test-home', '.claude'));
    });
  });

  describe('buildSummaryInstruction', () => {
    it('includes agentId in file path', () => {
      const result = buildSummaryInstruction('agent-123');
      expect(result).toContain('clubhouse-summary-agent-123.json');
    });

    it('specifies JSON format with summary and filesModified', () => {
      const result = buildSummaryInstruction('test');
      expect(result).toContain('"summary"');
      expect(result).toContain('"filesModified"');
    });
  });

  describe('readQuickSummary', () => {
    it('reads and parses summary file', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ summary: 'Fixed the bug', filesModified: ['src/app.ts'] })
      );

      const result = await readQuickSummary('agent-1');
      expect(result).toEqual({
        summary: 'Fixed the bug',
        filesModified: ['src/app.ts'],
      });
    });

    it('deletes the file after reading', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ summary: 'Done', filesModified: [] })
      );

      await readQuickSummary('agent-2');
      expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(os.tmpdir(), 'clubhouse-summary-agent-2.json'));
    });

    it('returns null when file does not exist', async () => {
      const result = await readQuickSummary('missing');
      expect(result).toBeNull();
    });

    it('handles malformed JSON gracefully', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not json');
      const result = await readQuickSummary('bad');
      expect(result).toBeNull();
    });

    it('handles missing summary field', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ filesModified: ['a.ts'] })
      );

      const result = await readQuickSummary('agent-3');
      expect(result).toEqual({ summary: null, filesModified: ['a.ts'] });
    });

    it('handles non-array filesModified', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ summary: 'Done', filesModified: 'not-an-array' })
      );

      const result = await readQuickSummary('agent-4');
      expect(result).toEqual({ summary: 'Done', filesModified: [] });
    });
  });
});
