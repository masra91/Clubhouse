import type {
  PluginContext,
  PluginAPI,
  ProjectAPI,
  ProjectsAPI,
  GitAPI,
  StorageAPI,
  ScopedStorage,
  UIAPI,
  CommandsAPI,
  EventsAPI,
  SettingsAPI,
  AgentsAPI,
  HubAPI,
  DirectoryEntry,
  GitStatus,
  GitCommit,
  ProjectInfo,
  AgentInfo,
  Disposable,
} from '../../shared/plugin-types';
import { pluginEventBus } from './plugin-events';
import { pluginCommandRegistry } from './plugin-commands';
import { usePluginStore } from './plugin-store';
import { useProjectStore } from '../stores/projectStore';
import { useAgentStore } from '../stores/agentStore';

function unavailableProxy(apiName: string, scope: string): never {
  throw new Error(`api.${apiName} is not available for ${scope}-scoped plugins`);
}

function createScopedStorage(pluginId: string, storageScope: 'project' | 'global', projectPath?: string): ScopedStorage {
  return {
    async read(key: string): Promise<unknown> {
      return window.clubhouse.plugin.storageRead({ pluginId, scope: storageScope, key, projectPath });
    },
    async write(key: string, value: unknown): Promise<void> {
      await window.clubhouse.plugin.storageWrite({ pluginId, scope: storageScope, key, value, projectPath });
    },
    async delete(key: string): Promise<void> {
      await window.clubhouse.plugin.storageDelete({ pluginId, scope: storageScope, key, projectPath });
    },
    async list(): Promise<string[]> {
      return window.clubhouse.plugin.storageList({ pluginId, scope: storageScope, projectPath });
    },
  };
}

function createProjectAPI(ctx: PluginContext): ProjectAPI {
  const { projectPath, projectId } = ctx;
  if (!projectPath || !projectId) {
    throw new Error('ProjectAPI requires projectPath and projectId');
  }

  return {
    projectPath,
    projectId,
    async readFile(relativePath: string): Promise<string> {
      const fullPath = `${projectPath}/${relativePath}`;
      return window.clubhouse.file.read(fullPath);
    },
    async writeFile(relativePath: string, content: string): Promise<void> {
      const fullPath = `${projectPath}/${relativePath}`;
      await window.clubhouse.file.write(fullPath, content);
    },
    async deleteFile(relativePath: string): Promise<void> {
      const fullPath = `${projectPath}/${relativePath}`;
      await window.clubhouse.file.delete(fullPath);
    },
    async fileExists(relativePath: string): Promise<boolean> {
      try {
        const fullPath = `${projectPath}/${relativePath}`;
        await window.clubhouse.file.read(fullPath);
        return true;
      } catch {
        return false;
      }
    },
    async listDirectory(relativePath = '.'): Promise<DirectoryEntry[]> {
      const fullPath = `${projectPath}/${relativePath}`;
      const tree = await window.clubhouse.file.readTree(fullPath);
      return tree.map((node: { name: string; path: string; isDirectory: boolean }) => ({
        name: node.name,
        path: node.path,
        isDirectory: node.isDirectory,
      }));
    },
  };
}

function createProjectsAPI(): ProjectsAPI {
  return {
    list(): ProjectInfo[] {
      return useProjectStore.getState().projects.map((p) => ({
        id: p.id,
        name: p.displayName || p.name,
        path: p.path,
      }));
    },
    getActive(): ProjectInfo | null {
      const store = useProjectStore.getState();
      const project = store.projects.find((p) => p.id === store.activeProjectId);
      if (!project) return null;
      return { id: project.id, name: project.displayName || project.name, path: project.path };
    },
  };
}

function createGitAPI(ctx: PluginContext): GitAPI {
  const { projectPath } = ctx;
  if (!projectPath) {
    throw new Error('GitAPI requires projectPath');
  }

  return {
    async status(): Promise<GitStatus[]> {
      const info = await window.clubhouse.git.info(projectPath);
      return info.status.map((s: { path: string; status: string; staged: boolean }) => ({
        path: s.path,
        status: s.status,
        staged: s.staged,
      }));
    },
    async log(limit = 20): Promise<GitCommit[]> {
      const info = await window.clubhouse.git.info(projectPath);
      return info.log.slice(0, limit).map((e: { hash: string; shortHash: string; subject: string; author: string; date: string }) => ({
        hash: e.hash,
        shortHash: e.shortHash,
        subject: e.subject,
        author: e.author,
        date: e.date,
      }));
    },
    async currentBranch(): Promise<string> {
      const info = await window.clubhouse.git.info(projectPath);
      return info.branch;
    },
    async diff(filePath: string, staged = false): Promise<string> {
      return window.clubhouse.git.diff(projectPath, filePath, staged);
    },
  };
}

function createStorageAPI(ctx: PluginContext): StorageAPI {
  return {
    project: createScopedStorage(ctx.pluginId, 'project', ctx.projectPath),
    global: createScopedStorage(ctx.pluginId, 'global'),
  };
}

function createUIAPI(): UIAPI {
  return {
    showNotice(message: string): void {
      // Simple notification using existing notification system
      console.log(`[Plugin Notice] ${message}`);
    },
    showError(message: string): void {
      console.error(`[Plugin Error] ${message}`);
    },
    async showConfirm(message: string): Promise<boolean> {
      return window.confirm(message);
    },
    async showInput(prompt: string, defaultValue = ''): Promise<string | null> {
      return window.prompt(prompt, defaultValue);
    },
  };
}

function createCommandsAPI(ctx: PluginContext): CommandsAPI {
  return {
    register(commandId: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable {
      const fullId = `${ctx.pluginId}:${commandId}`;
      return pluginCommandRegistry.register(fullId, handler);
    },
    async execute(commandId: string, ...args: unknown[]): Promise<void> {
      // Try with plugin prefix first, then raw
      const fullId = `${ctx.pluginId}:${commandId}`;
      if (pluginCommandRegistry.has(fullId)) {
        await pluginCommandRegistry.execute(fullId, ...args);
      } else {
        await pluginCommandRegistry.execute(commandId, ...args);
      }
    },
  };
}

function createEventsAPI(): EventsAPI {
  return {
    on(event: string, handler: (...args: unknown[]) => void): Disposable {
      return pluginEventBus.on(event, handler);
    },
  };
}

function createSettingsAPI(ctx: PluginContext): SettingsAPI {
  const settingsKey = ctx.scope === 'project' && ctx.projectId
    ? `${ctx.projectId}:${ctx.pluginId}`
    : `app:${ctx.pluginId}`;
  const changeHandlers = new Set<(key: string, value: unknown) => void>();

  return {
    get<T = unknown>(key: string): T | undefined {
      const allSettings = usePluginStore.getState().pluginSettings[settingsKey];
      return allSettings?.[key] as T | undefined;
    },
    getAll(): Record<string, unknown> {
      return usePluginStore.getState().pluginSettings[settingsKey] || {};
    },
    onChange(callback: (key: string, value: unknown) => void): Disposable {
      changeHandlers.add(callback);
      return {
        dispose: () => { changeHandlers.delete(callback); },
      };
    },
  };
}

function createAgentsAPI(ctx: PluginContext): AgentsAPI {
  return {
    list(): AgentInfo[] {
      const agents = useAgentStore.getState().agents;
      return Object.values(agents)
        .filter((a) => !ctx.projectId || a.projectId === ctx.projectId)
        .map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          status: a.status,
        }));
    },
    async runQuick(mission: string, options?: { model?: string; systemPrompt?: string }): Promise<string> {
      if (!ctx.projectId || !ctx.projectPath) {
        throw new Error('runQuick requires a project context');
      }
      return useAgentStore.getState().spawnQuickAgent(
        ctx.projectId,
        ctx.projectPath,
        mission,
        options?.model,
      );
    },
  };
}

function createHubAPI(): HubAPI {
  return {
    refresh(): void {
      // Placeholder — hub refresh will be wired when hub store is available
    },
  };
}

export function createPluginAPI(ctx: PluginContext): PluginAPI {
  const isProjectScoped = ctx.scope === 'project';

  const api: PluginAPI = {
    project: isProjectScoped
      ? createProjectAPI(ctx)
      : new Proxy({} as ProjectAPI, {
          get(_t, prop) { unavailableProxy('project', 'app'); },
        }),
    projects: !isProjectScoped
      ? createProjectsAPI()
      : new Proxy({} as ProjectsAPI, {
          get(_t, prop) { unavailableProxy('projects', 'project'); },
        }),
    git: isProjectScoped
      ? createGitAPI(ctx)
      : new Proxy({} as GitAPI, {
          get(_t, prop) { unavailableProxy('git', 'app'); },
        }),
    storage: createStorageAPI(ctx),
    ui: createUIAPI(),
    commands: createCommandsAPI(ctx),
    events: createEventsAPI(),
    settings: createSettingsAPI(ctx),
    agents: createAgentsAPI(ctx),
    hub: createHubAPI(),
  };

  return api;
}
