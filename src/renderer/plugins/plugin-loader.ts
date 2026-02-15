import type { PluginContext, PluginModule, PluginManifest } from '../../shared/plugin-types';
import { usePluginStore } from './plugin-store';
import { validateManifest } from './manifest-validator';
import { createPluginAPI } from './plugin-api-factory';
import { injectStyles, removeStyles } from './plugin-styles';

const activeContexts = new Map<string, PluginContext>();

export async function initializePluginSystem(): Promise<void> {
  const store = usePluginStore.getState();

  // Check safe mode
  const marker = await window.clubhouse.plugin.startupMarkerRead();
  if (marker && marker.attempt >= 2) {
    store.setSafeModeActive(true);
    console.warn('[Plugins] Safe mode active — no plugins will be loaded');
    return;
  }

  // Discover community plugins
  const communityPlugins = await window.clubhouse.plugin.discoverCommunity();
  for (const { manifest: rawManifest, pluginPath } of communityPlugins) {
    const result = validateManifest(rawManifest);
    if (result.valid && result.manifest) {
      store.registerPlugin(result.manifest, 'community', pluginPath, 'registered');
    } else {
      // Register as incompatible so it appears in settings
      const partialManifest: PluginManifest = {
        id: (rawManifest as Record<string, unknown>)?.id as string || pluginPath.split('/').pop() || 'unknown',
        name: (rawManifest as Record<string, unknown>)?.name as string || 'Unknown Plugin',
        version: (rawManifest as Record<string, unknown>)?.version as string || '0.0.0',
        engine: { api: 0 },
        scope: 'project',
      };
      store.registerPlugin(partialManifest, 'community', pluginPath, 'incompatible', result.errors.join('; '));
    }
  }

  // Load persisted enabled lists
  // App-level config
  try {
    const appConfig = await window.clubhouse.plugin.storageRead({
      pluginId: '_system',
      scope: 'global',
      key: 'app-enabled',
    }) as string[] | undefined;
    if (Array.isArray(appConfig)) {
      store.loadAppPluginConfig(appConfig);
    }
  } catch {
    // No saved config
  }

  // Clear startup marker after successful init
  await window.clubhouse.plugin.startupMarkerClear();
}

export async function activatePlugin(
  pluginId: string,
  projectId?: string,
  projectPath?: string,
): Promise<void> {
  const store = usePluginStore.getState();
  const entry = store.plugins[pluginId];
  if (!entry) {
    console.error(`[Plugins] Cannot activate unknown plugin: ${pluginId}`);
    return;
  }

  if (entry.status === 'incompatible' || entry.status === 'errored') {
    console.warn(`[Plugins] Skipping activation of ${pluginId}: ${entry.status}`);
    return;
  }

  const contextKey = projectId ? `${pluginId}:${projectId}` : pluginId;
  if (activeContexts.has(contextKey)) {
    return; // Already activated
  }

  const ctx: PluginContext = {
    pluginId,
    pluginPath: entry.pluginPath,
    scope: entry.manifest.scope,
    projectId,
    projectPath,
    subscriptions: [],
    settings: {},
  };

  // Load settings
  const settingsKey = projectId ? `${projectId}:${pluginId}` : `app:${pluginId}`;
  const savedSettings = store.pluginSettings[settingsKey];
  if (savedSettings) {
    ctx.settings = { ...savedSettings };
  }

  try {
    // Load the module
    let mod: PluginModule;
    const mainPath = entry.manifest.main || 'main.js';
    const fullModulePath = `${entry.pluginPath}/${mainPath}`;

    try {
      // Dynamic import for community plugins — use indirect eval to
      // prevent webpack from analyzing the expression and emitting a
      // "Critical dependency" warning.
      const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<PluginModule>;
      mod = await dynamicImport(fullModulePath);
    } catch (err) {
      console.error(`[Plugins] Failed to load module for ${pluginId}:`, err);
      store.setPluginStatus(pluginId, 'errored', `Failed to load: ${err}`);
      return;
    }

    // Create the API
    const api = createPluginAPI(ctx);

    // Call activate if it exists
    if (mod.activate) {
      await mod.activate(ctx, api);
    }

    // Store the module and update status
    store.setPluginModule(pluginId, mod);
    store.setPluginStatus(pluginId, 'activated');
    activeContexts.set(contextKey, ctx);
  } catch (err) {
    console.error(`[Plugins] Error activating ${pluginId}:`, err);
    store.setPluginStatus(pluginId, 'errored', `Activation failed: ${err}`);
  }
}

export async function deactivatePlugin(pluginId: string, projectId?: string): Promise<void> {
  const store = usePluginStore.getState();
  const contextKey = projectId ? `${pluginId}:${projectId}` : pluginId;
  const ctx = activeContexts.get(contextKey);

  if (!ctx) return;

  // Dispose subscriptions in reverse order
  const subs = [...ctx.subscriptions].reverse();
  for (const sub of subs) {
    try {
      sub.dispose();
    } catch (err) {
      console.error(`[Plugins] Error disposing subscription for ${pluginId}:`, err);
    }
  }

  // Call deactivate on the module
  const mod = store.modules[pluginId];
  if (mod?.deactivate) {
    try {
      await mod.deactivate();
    } catch (err) {
      console.error(`[Plugins] Error in deactivate for ${pluginId}:`, err);
    }
  }

  // Clean up
  removeStyles(pluginId);
  store.removePluginModule(pluginId);
  store.setPluginStatus(pluginId, 'deactivated');
  activeContexts.delete(contextKey);
}

export async function handleProjectSwitch(
  oldProjectId: string | null,
  newProjectId: string,
  newProjectPath: string,
): Promise<void> {
  const store = usePluginStore.getState();

  // Deactivate all project-scoped plugins for the old project
  if (oldProjectId) {
    const oldEnabled = store.projectEnabled[oldProjectId] || [];
    for (const pluginId of oldEnabled) {
      const entry = store.plugins[pluginId];
      if (entry?.manifest.scope === 'project') {
        await deactivatePlugin(pluginId, oldProjectId);
      }
    }
  }

  // Activate project-scoped plugins for the new project
  const newEnabled = store.projectEnabled[newProjectId] || [];
  for (const pluginId of newEnabled) {
    const entry = store.plugins[pluginId];
    if (entry?.manifest.scope === 'project') {
      await activatePlugin(pluginId, newProjectId, newProjectPath);
    }
  }
}

export function getActiveContext(pluginId: string, projectId?: string): PluginContext | undefined {
  const contextKey = projectId ? `${pluginId}:${projectId}` : pluginId;
  return activeContexts.get(contextKey);
}
