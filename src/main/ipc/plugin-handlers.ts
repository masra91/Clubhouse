import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import * as pluginStorage from '../services/plugin-storage';
import * as pluginDiscovery from '../services/plugin-discovery';
import * as gitignoreManager from '../services/gitignore-manager';
import * as safeMode from '../services/safe-mode';

export function registerPluginHandlers(): void {
  // ── Discovery ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.DISCOVER_COMMUNITY, () => {
    return pluginDiscovery.discoverCommunityPlugins();
  });

  // ── KV Storage ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.STORAGE_READ, (_event, req) => {
    return pluginStorage.readKey(req);
  });

  ipcMain.handle(IPC.PLUGIN.STORAGE_WRITE, (_event, req) => {
    pluginStorage.writeKey(req);
  });

  ipcMain.handle(IPC.PLUGIN.STORAGE_DELETE, (_event, req) => {
    pluginStorage.deleteKey(req);
  });

  ipcMain.handle(IPC.PLUGIN.STORAGE_LIST, (_event, req) => {
    return pluginStorage.listKeys(req);
  });

  // ── File Storage ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.FILE_READ, (_event, req) => {
    return pluginStorage.readPluginFile(req);
  });

  ipcMain.handle(IPC.PLUGIN.FILE_WRITE, (_event, req) => {
    pluginStorage.writePluginFile(req);
  });

  ipcMain.handle(IPC.PLUGIN.FILE_DELETE, (_event, req) => {
    pluginStorage.deletePluginFile(req);
  });

  ipcMain.handle(IPC.PLUGIN.FILE_EXISTS, (_event, req) => {
    return pluginStorage.pluginFileExists(req);
  });

  ipcMain.handle(IPC.PLUGIN.FILE_LIST_DIR, (_event, req) => {
    return pluginStorage.listPluginDir(req);
  });

  // ── Gitignore ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.GITIGNORE_ADD, (_event, projectPath: string, pluginId: string, patterns: string[]) => {
    gitignoreManager.addEntries(projectPath, pluginId, patterns);
  });

  ipcMain.handle(IPC.PLUGIN.GITIGNORE_REMOVE, (_event, projectPath: string, pluginId: string) => {
    gitignoreManager.removeEntries(projectPath, pluginId);
  });

  ipcMain.handle(IPC.PLUGIN.GITIGNORE_CHECK, (_event, projectPath: string, pattern: string) => {
    return gitignoreManager.isIgnored(projectPath, pattern);
  });

  // ── Safe Mode / Startup Marker ───────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.STARTUP_MARKER_READ, () => {
    return safeMode.readMarker();
  });

  ipcMain.handle(IPC.PLUGIN.STARTUP_MARKER_WRITE, (_event, enabledPlugins: string[]) => {
    safeMode.writeMarker(enabledPlugins);
  });

  ipcMain.handle(IPC.PLUGIN.STARTUP_MARKER_CLEAR, () => {
    safeMode.clearMarker();
  });

  // ── Misc ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGIN.MKDIR, (_event, pluginId: string, scope: string, relativePath: string, projectPath?: string) => {
    pluginStorage.mkdirPlugin(pluginId, scope as 'project' | 'global', relativePath, projectPath);
  });

  ipcMain.handle(IPC.PLUGIN.UNINSTALL, (_event, pluginId: string) => {
    pluginDiscovery.uninstallPlugin(pluginId);
  });
}
