import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

import * as fs from 'fs';
import { discoverCommunityPlugins, uninstallPlugin } from './plugin-discovery';

const PLUGINS_DIR = '/tmp/clubhouse-test-home/.clubhouse/plugins';

describe('plugin-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discoverCommunityPlugins', () => {
    it('returns empty array when plugins dir does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(discoverCommunityPlugins()).toEqual([]);
    });

    it('discovers plugins with valid manifest.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        const s = String(p);
        if (s === PLUGINS_DIR) return true;
        if (s.endsWith('manifest.json')) return true;
        return false;
      });
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'my-plugin', isDirectory: () => true },
      ] as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        id: 'my-plugin',
        name: 'My Plugin',
        version: '1.0.0',
        engine: { api: 1 },
        scope: 'project',
      }));

      const result = discoverCommunityPlugins();
      expect(result).toHaveLength(1);
      expect(result[0].manifest.id).toBe('my-plugin');
      expect(result[0].pluginPath).toBe(`${PLUGINS_DIR}/my-plugin`);
    });

    it('skips non-directory entries', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'readme.md', isDirectory: () => false },
      ] as any);

      const result = discoverCommunityPlugins();
      expect(result).toEqual([]);
    });

    it('skips directories without manifest.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        const s = String(p);
        if (s === PLUGINS_DIR) return true;
        if (s.endsWith('manifest.json')) return false;
        return false;
      });
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'incomplete', isDirectory: () => true },
      ] as any);

      const result = discoverCommunityPlugins();
      expect(result).toEqual([]);
    });

    it('skips plugins with invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'bad-json', isDirectory: () => true },
      ] as any);
      vi.mocked(fs.readFileSync).mockReturnValue('{{not valid json');

      const result = discoverCommunityPlugins();
      expect(result).toEqual([]);
    });

    it('discovers multiple plugins', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'plugin-a', isDirectory: () => true },
        { name: 'plugin-b', isDirectory: () => true },
      ] as any);
      vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
        const s = String(p);
        if (s.includes('plugin-a')) {
          return JSON.stringify({ id: 'plugin-a', name: 'A', version: '1.0.0', engine: { api: 1 }, scope: 'project' });
        }
        return JSON.stringify({ id: 'plugin-b', name: 'B', version: '2.0.0', engine: { api: 1 }, scope: 'app' });
      });

      const result = discoverCommunityPlugins();
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.manifest.id)).toEqual(['plugin-a', 'plugin-b']);
    });

    it('handles unreadable plugins dir gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('EACCES'); });
      expect(discoverCommunityPlugins()).toEqual([]);
    });
  });

  describe('uninstallPlugin', () => {
    it('removes plugin directory recursively', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      uninstallPlugin('my-plugin');
      expect(fs.rmSync).toHaveBeenCalledWith(
        `${PLUGINS_DIR}/my-plugin`,
        { recursive: true, force: true },
      );
    });

    it('does nothing when plugin directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      uninstallPlugin('nonexistent');
      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });
});
