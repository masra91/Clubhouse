import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPluginAPI } from './plugin-api-factory';
import { pluginEventBus } from './plugin-events';
import { pluginCommandRegistry } from './plugin-commands';
import { usePluginStore } from './plugin-store';
import type { PluginContext, PluginAPI } from '../../shared/plugin-types';

// Mock window.clubhouse for IPC calls
const mockPlugin = {
  storageRead: vi.fn(),
  storageWrite: vi.fn(),
  storageDelete: vi.fn(),
  storageList: vi.fn(),
};
const mockFile = {
  read: vi.fn(),
  write: vi.fn(),
  delete: vi.fn(),
  readTree: vi.fn(),
};
const mockGit = {
  info: vi.fn(),
  diff: vi.fn(),
};

Object.defineProperty(globalThis, 'window', {
  value: {
    clubhouse: {
      plugin: mockPlugin,
      file: mockFile,
      git: mockGit,
    },
    confirm: vi.fn(),
    prompt: vi.fn(),
  },
  writable: true,
});

function makeCtx(overrides?: Partial<PluginContext>): PluginContext {
  return {
    pluginId: 'test-plugin',
    pluginPath: '/plugins/test-plugin',
    scope: 'project',
    projectId: 'proj-1',
    projectPath: '/projects/my-project',
    subscriptions: [],
    settings: {},
    ...overrides,
  };
}

describe('plugin-api-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginCommandRegistry.clear();
    pluginEventBus.clear();
    usePluginStore.setState({
      plugins: {},
      projectEnabled: {},
      appEnabled: [],
      modules: {},
      safeModeActive: false,
      pluginSettings: {},
    });
  });

  describe('createPluginAPI', () => {
    it('returns an object with all required API namespaces', () => {
      const api = createPluginAPI(makeCtx());
      expect(api.project).toBeDefined();
      expect(api.projects).toBeDefined();
      expect(api.git).toBeDefined();
      expect(api.storage).toBeDefined();
      expect(api.ui).toBeDefined();
      expect(api.commands).toBeDefined();
      expect(api.events).toBeDefined();
      expect(api.settings).toBeDefined();
      expect(api.agents).toBeDefined();
      expect(api.hub).toBeDefined();
    });
  });

  // ── Scope restrictions ────────────────────────────────────────────────

  describe('scope restrictions (project-scoped plugin)', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx({ scope: 'project' }));
    });

    it('provides a working project API', () => {
      expect(api.project.projectPath).toBe('/projects/my-project');
      expect(api.project.projectId).toBe('proj-1');
    });

    it('provides a working git API', () => {
      expect(api.git).toBeDefined();
      expect(typeof api.git.status).toBe('function');
    });

    it('throws when accessing api.projects on project-scoped plugin', () => {
      expect(() => api.projects.list()).toThrow('not available for project-scoped');
    });
  });

  describe('scope restrictions (app-scoped plugin)', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx({ scope: 'app', projectId: undefined, projectPath: undefined }));
    });

    it('provides a working projects API', () => {
      expect(typeof api.projects.list).toBe('function');
      expect(typeof api.projects.getActive).toBe('function');
    });

    it('throws when accessing api.project on app-scoped plugin', () => {
      expect(() => api.project.projectPath).toThrow('not available for app-scoped');
    });

    it('throws when accessing api.git on app-scoped plugin', () => {
      expect(() => api.git.status()).toThrow('not available for app-scoped');
    });
  });

  // ── ProjectAPI ────────────────────────────────────────────────────────

  describe('project API', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx());
    });

    it('readFile calls window.clubhouse.file.read with full path', async () => {
      mockFile.read.mockResolvedValue('file content');
      const result = await api.project.readFile('src/main.ts');
      expect(mockFile.read).toHaveBeenCalledWith('/projects/my-project/src/main.ts');
      expect(result).toBe('file content');
    });

    it('writeFile calls window.clubhouse.file.write with full path', async () => {
      await api.project.writeFile('out.txt', 'hello');
      expect(mockFile.write).toHaveBeenCalledWith('/projects/my-project/out.txt', 'hello');
    });

    it('deleteFile calls window.clubhouse.file.delete with full path', async () => {
      await api.project.deleteFile('tmp.txt');
      expect(mockFile.delete).toHaveBeenCalledWith('/projects/my-project/tmp.txt');
    });

    it('fileExists returns true when read succeeds', async () => {
      mockFile.read.mockResolvedValue('data');
      expect(await api.project.fileExists('exists.txt')).toBe(true);
    });

    it('fileExists returns false when read throws', async () => {
      mockFile.read.mockRejectedValue(new Error('not found'));
      expect(await api.project.fileExists('nope.txt')).toBe(false);
    });

    it('listDirectory maps tree nodes to DirectoryEntry', async () => {
      mockFile.readTree.mockResolvedValue([
        { name: 'src', path: '/projects/my-project/src', isDirectory: true },
        { name: 'index.ts', path: '/projects/my-project/index.ts', isDirectory: false },
      ]);
      const entries = await api.project.listDirectory('.');
      expect(entries).toEqual([
        { name: 'src', path: '/projects/my-project/src', isDirectory: true },
        { name: 'index.ts', path: '/projects/my-project/index.ts', isDirectory: false },
      ]);
    });
  });

  // ── StorageAPI ────────────────────────────────────────────────────────

  describe('storage API', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx());
    });

    it('project storage passes correct scope and projectPath', async () => {
      await api.storage.project.read('my-key');
      expect(mockPlugin.storageRead).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        scope: 'project',
        key: 'my-key',
        projectPath: '/projects/my-project',
      });
    });

    it('global storage passes correct scope without projectPath', async () => {
      await api.storage.global.write('key', { data: true });
      expect(mockPlugin.storageWrite).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        scope: 'global',
        key: 'key',
        value: { data: true },
        projectPath: undefined,
      });
    });

    it('project storage delete calls storageDelete', async () => {
      await api.storage.project.delete('old-key');
      expect(mockPlugin.storageDelete).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin', key: 'old-key', scope: 'project' }),
      );
    });

    it('global storage list calls storageList', async () => {
      mockPlugin.storageList.mockResolvedValue(['a', 'b']);
      const keys = await api.storage.global.list();
      expect(keys).toEqual(['a', 'b']);
    });
  });

  // ── CommandsAPI ───────────────────────────────────────────────────────

  describe('commands API', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx());
    });

    it('register prefixes command id with pluginId', () => {
      const handler = vi.fn();
      api.commands.register('do-thing', handler);
      expect(pluginCommandRegistry.has('test-plugin:do-thing')).toBe(true);
    });

    it('execute resolves prefixed command', async () => {
      const handler = vi.fn();
      api.commands.register('do-thing', handler);
      await api.commands.execute('do-thing', 'arg');
      expect(handler).toHaveBeenCalledWith('arg');
    });

    it('execute falls back to raw command id if prefixed not found', async () => {
      const handler = vi.fn();
      pluginCommandRegistry.register('global.cmd', handler);
      await api.commands.execute('global.cmd', 42);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it('register returns a disposable', () => {
      const d = api.commands.register('temp', vi.fn());
      expect(typeof d.dispose).toBe('function');
      d.dispose();
      expect(pluginCommandRegistry.has('test-plugin:temp')).toBe(false);
    });
  });

  // ── EventsAPI ─────────────────────────────────────────────────────────

  describe('events API', () => {
    it('on subscribes to pluginEventBus', () => {
      const api = createPluginAPI(makeCtx());
      const handler = vi.fn();
      api.events.on('agent:completed', handler);
      pluginEventBus.emit('agent:completed', { id: 'a1' });
      expect(handler).toHaveBeenCalledWith({ id: 'a1' });
    });

    it('on returns a disposable that unsubscribes', () => {
      const api = createPluginAPI(makeCtx());
      const handler = vi.fn();
      const d = api.events.on('test', handler);
      d.dispose();
      pluginEventBus.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── SettingsAPI ───────────────────────────────────────────────────────

  describe('settings API', () => {
    it('get returns setting value for project-scoped plugin', () => {
      usePluginStore.setState({
        pluginSettings: { 'proj-1:test-plugin': { theme: 'dark', size: 14 } },
      });
      const api = createPluginAPI(makeCtx());
      expect(api.settings.get('theme')).toBe('dark');
      expect(api.settings.get('size')).toBe(14);
    });

    it('get returns undefined for missing key', () => {
      const api = createPluginAPI(makeCtx());
      expect(api.settings.get('nonexistent')).toBeUndefined();
    });

    it('getAll returns all settings', () => {
      usePluginStore.setState({
        pluginSettings: { 'proj-1:test-plugin': { a: 1, b: 2 } },
      });
      const api = createPluginAPI(makeCtx());
      expect(api.settings.getAll()).toEqual({ a: 1, b: 2 });
    });

    it('getAll returns empty object when no settings exist', () => {
      const api = createPluginAPI(makeCtx());
      expect(api.settings.getAll()).toEqual({});
    });

    it('uses app: prefix for app-scoped plugins', () => {
      usePluginStore.setState({
        pluginSettings: { 'app:test-plugin': { mode: 'zen' } },
      });
      const api = createPluginAPI(makeCtx({ scope: 'app', projectId: undefined }));
      expect(api.settings.get('mode')).toBe('zen');
    });

    it('onChange returns a disposable', () => {
      const api = createPluginAPI(makeCtx());
      const cb = vi.fn();
      const d = api.settings.onChange(cb);
      expect(typeof d.dispose).toBe('function');
      d.dispose(); // Should not throw
    });
  });

  // ── UIAPI ─────────────────────────────────────────────────────────────

  describe('ui API', () => {
    let api: PluginAPI;

    beforeEach(() => {
      api = createPluginAPI(makeCtx());
    });

    it('showNotice logs to console', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      api.ui.showNotice('Hello');
      expect(spy).toHaveBeenCalledWith('[Plugin Notice] Hello');
      spy.mockRestore();
    });

    it('showError logs to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.ui.showError('Oops');
      expect(spy).toHaveBeenCalledWith('[Plugin Error] Oops');
      spy.mockRestore();
    });

    it('showConfirm delegates to window.confirm', async () => {
      (window as any).confirm = vi.fn(() => true);
      const result = await api.ui.showConfirm('Are you sure?');
      expect(result).toBe(true);
      expect((window as any).confirm).toHaveBeenCalledWith('Are you sure?');
    });

    it('showInput delegates to window.prompt', async () => {
      (window as any).prompt = vi.fn(() => 'user input');
      const result = await api.ui.showInput('Enter name:', 'default');
      expect(result).toBe('user input');
      expect((window as any).prompt).toHaveBeenCalledWith('Enter name:', 'default');
    });
  });

  // ── HubAPI ────────────────────────────────────────────────────────────

  describe('hub API', () => {
    it('refresh is callable without error', () => {
      const api = createPluginAPI(makeCtx());
      expect(() => api.hub.refresh()).not.toThrow();
    });
  });
});
