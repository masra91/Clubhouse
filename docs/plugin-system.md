# Plugin System

Clubhouse has a plugin system that powers both its built-in features (Hub, Files, Terminal, Automations, Issues, Wiki) and allows community-developed extensions. Plugins can contribute tabs, sidebar items, commands, settings, and access a rich API for interacting with agents, files, git, and the UI.

## Plugin Manifest

Every plugin is defined by a manifest, either as a `plugin.json` file (community) or a TypeScript object (built-in). The manifest declares the plugin's identity, scope, permissions, and UI contributions.

```ts
interface PluginManifest {
  id: string;                // Unique identifier (kebab-case)
  name: string;              // Display name
  version: string;           // Semver
  description?: string;
  author?: string;
  engine: { api: number };   // Required API version (currently 0.5)
  scope: 'project' | 'app' | 'dual';
  main?: string;             // Path to main module (relative to plugin dir)
  permissions?: PluginPermission[];
  contributes?: PluginContributes;
  settingsPanel?: 'declarative' | 'custom';
  externalRoots?: PluginExternalRoot[];  // For files.external permission
  allowedCommands?: string[];             // For process permission
}
```

### Scope

- **project** — Renders as a tab within each project. Gets a `ProjectAPI` scoped to that project.
- **app** — Renders as a rail item visible across all projects. No project-specific context.
- **dual** — Can render in both contexts. Receives a `PluginContextInfo` indicating the current mode.

### Contributions

```ts
interface PluginContributes {
  tab?: {
    label: string;
    icon?: string;                              // SVG string
    layout?: 'sidebar-content' | 'full';        // default: 'sidebar-content'
  };
  railItem?: {
    label: string;
    icon?: string;
    position?: 'top' | 'bottom';
  };
  commands?: Array<{ id: string; title: string }>;
  settings?: PluginSettingDeclaration[];
  storage?: { scope: 'project' | 'project-local' | 'global' };
  help?: { topics?: PluginHelpTopic[] };
}
```

**Tab** — Adds a tab to the explorer rail within each project. `sidebar-content` layout gives you a sidebar panel + main content area. `full` layout uses the entire content area.

**Rail item** — Adds an icon to the project rail (left-most rail). Used by app-scoped plugins like the cross-project Hub.

**Commands** — Registers commands that can be invoked programmatically or from the UI.

**Settings** — Declarative settings rendered automatically. Supports types: `boolean`, `string`, `number`, `select`, `directory`.

**Help** — Contributes topics to the built-in help system.

## Permissions

Plugins must declare which API namespaces they need. The permission system is enforced at invocation time — API proxy methods throw if the plugin lacks the required permission.

| Permission | Grants Access To |
|------------|-----------------|
| `files` | Read/write files within the project directory |
| `files.external` | Access files outside the project (requires `externalRoots`) |
| `git` | Git status, log, branch, diffs |
| `terminal` | Spawn and control PTY sessions |
| `agents` | Spawn, monitor, and manage AI agents |
| `notifications` | Display notices, errors, confirmation dialogs |
| `storage` | Persistent key-value storage |
| `navigation` | Focus agents, switch tabs |
| `projects` | List and access other open projects |
| `commands` | Register and execute commands |
| `events` | Subscribe to the event bus |
| `widgets` | Use shared UI components (AgentTerminal, SleepingAgent, etc.) |
| `logging` | Write to the application log |
| `process` | Execute allowed CLI commands (requires `allowedCommands`) |

## Plugin API

The full `PluginAPI` is passed to the plugin's `activate()` function and component props:

### Files API
```ts
interface FilesAPI {
  readTree(relativePath?, options?): Promise<FileNode[]>;
  readFile(relativePath: string): Promise<string>;
  readBinary(relativePath: string): Promise<string>;
  writeFile(relativePath: string, content: string): Promise<void>;
  stat(relativePath: string): Promise<FileStatInfo>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  mkdir(relativePath: string): Promise<void>;
  delete(relativePath: string): Promise<void>;
  showInFolder(relativePath: string): Promise<void>;
  forRoot(rootName: string): FilesAPI;  // Access external roots
}
```

### Agents API
```ts
interface AgentsAPI {
  list(): AgentInfo[];
  runQuick(mission: string, options?): Promise<string>;  // Returns agent ID
  kill(agentId: string): Promise<void>;
  resume(agentId: string): Promise<void>;
  listCompleted(projectId?): CompletedQuickAgentInfo[];
  dismissCompleted(projectId: string, agentId: string): void;
  getDetailedStatus(agentId: string): PluginAgentDetailedStatus | null;
  getModelOptions(projectId?): Promise<ModelOption[]>;
  onStatusChange(callback): Disposable;
  onAnyChange(callback): Disposable;
}
```

### Terminal API
```ts
interface TerminalAPI {
  spawn(sessionId: string, cwd?: string): Promise<void>;
  write(sessionId: string, data: string): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string): Promise<void>;
  getBuffer(sessionId: string): Promise<string>;
  onData(sessionId: string, callback): Disposable;
  onExit(sessionId: string, callback): Disposable;
  ShellTerminal: React.ComponentType<{ sessionId: string; focused?: boolean }>;
}
```

Terminal session IDs are automatically namespaced as `plugin:{pluginId}:{sessionId}` for isolation.

### Storage API
```ts
interface StorageAPI {
  project: ScopedStorage;       // .clubhouse/plugin-data/{pluginId}/
  projectLocal: ScopedStorage;  // .clubhouse/plugin-data-local/{pluginId}/ (gitignored)
  global: ScopedStorage;        // ~/.clubhouse/plugin-data/{pluginId}/
}

interface ScopedStorage {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

### Other APIs

| API | Key Methods |
|-----|-------------|
| `project` | `readFile`, `writeFile`, `listDirectory`, `projectPath`, `projectId` |
| `projects` | `list()`, `getActive()` |
| `git` | `status()`, `log()`, `currentBranch()`, `diff()` |
| `ui` | `showNotice()`, `showError()`, `showConfirm()`, `showInput()` |
| `commands` | `register(id, handler)`, `execute(id, ...args)` |
| `events` | `on(event, handler)` |
| `settings` | `get(key)`, `getAll()`, `onChange(callback)` |
| `navigation` | `focusAgent(id)`, `setExplorerTab(tabId)` |
| `widgets` | `AgentTerminal`, `SleepingAgent`, `AgentAvatar`, `QuickAgentGhost` |
| `logging` | `debug()`, `info()`, `warn()`, `error()`, `fatal()` |
| `process` | `exec(command, args, options?)` |
| `context` | `{ mode: 'project' | 'app', projectId?, projectPath? }` |

## Plugin Module

A plugin's main module exports an object implementing `PluginModule`:

```ts
interface PluginModule {
  activate?(ctx: PluginContext, api: PluginAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  MainPanel?: React.ComponentType<{ api: PluginAPI }>;
  SidebarPanel?: React.ComponentType<{ api: PluginAPI }>;
  HubPanel?: React.ComponentType<HubPanelProps>;
  SettingsPanel?: React.ComponentType<{ api: PluginAPI }>;
}
```

- **activate** — Called when the plugin is first loaded. Use for setup, registering commands, initializing state.
- **deactivate** — Called on shutdown. Clean up subscriptions.
- **MainPanel** — The primary content view for the plugin's tab.
- **SidebarPanel** — Optional sidebar shown alongside MainPanel (for `sidebar-content` layout).
- **HubPanel** — Optional panel for rendering inside Hub panes.
- **SettingsPanel** — Custom settings UI (alternative to declarative settings).

## Plugin Lifecycle

1. **Discovery** — Built-in plugins are registered from `src/renderer/plugins/builtin/index.ts`. Community plugins are discovered by scanning `~/.clubhouse/plugins/` for valid `plugin.json` manifests.

2. **Validation** — Manifests are validated against the supported API version (`SUPPORTED_API_VERSIONS`). Invalid manifests are marked as `incompatible`.

3. **Registration** — Valid plugins are added to the plugin store with status `registered`.

4. **Enabling** — Users enable plugins via Settings → Plugins. Default-enabled built-in plugins: `hub`, `terminal`, `files`.

5. **Activation** — When a plugin's tab or rail item is first rendered, `activate()` is called with a `PluginContext` and `PluginAPI`. The context includes a `subscriptions` array for tracking disposables.

6. **Deactivation** — On app shutdown or plugin disable, `deactivate()` is called and all subscriptions are disposed.

### Safe Mode

If Clubhouse crashes twice on startup with the same set of enabled plugins, it enters safe mode: all plugins are disabled and a banner is shown. This prevents a broken plugin from making the app unusable.

The startup marker tracks crash attempts in `~/.clubhouse/startup-marker.json`.

## Built-in Plugins

| Plugin | Scope | Description |
|--------|-------|-------------|
| **Hub** | dual | Split-pane workspace for managing agents side-by-side, per-project or cross-project |
| **Terminal** | project | Interactive shell session per project with xterm.js |
| **Files** | project | File tree browser with Monaco editor, markdown preview, and image display |
| **Automations** | project | Schedule recurring quick-agent tasks with cron expressions |
| **Issues** | project | Browse, view, and file GitHub issues (requires `gh` CLI) |
| **Wiki** | project | Browse and edit markdown wikis from external directories |

Default-enabled on fresh install: Hub, Terminal, Files.

## Writing a Community Plugin

1. Create a directory in `~/.clubhouse/plugins/{your-plugin-id}/`

2. Add a `plugin.json` manifest:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something cool",
  "engine": { "api": 0.5 },
  "scope": "project",
  "permissions": ["files", "notifications"],
  "main": "main.js",
  "contributes": {
    "tab": {
      "label": "My Plugin",
      "layout": "full"
    }
  }
}
```

3. Create `main.js` exporting a `PluginModule`:
```js
exports.activate = (ctx, api) => {
  api.ui.showNotice('My plugin activated!');
};

exports.MainPanel = ({ api }) => {
  // React component
  return React.createElement('div', null, 'Hello from my plugin');
};
```

4. Enable the plugin in Settings → Plugins.

### Guidelines

- Declare only the permissions you need
- Use `storage.projectLocal` for data that shouldn't be committed to git
- Clean up subscriptions in `deactivate()` or via the `ctx.subscriptions` array
- Use the `widgets` API for consistent agent display rather than building custom views
- Handle errors gracefully — plugin crashes are caught by error boundaries but degrade the experience
