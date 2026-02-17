# Architecture

Clubhouse is an Electron application built with React, TypeScript, and Zustand. It follows Electron's multi-process model with a clean separation between the main process (Node.js), the renderer process (browser/React), and a preload bridge that safely exposes IPC methods.

## Process Model

```
┌─────────────────────────────────────────────────────┐
│                   Main Process                       │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Orchestrator │  │   Services   │  │    IPC     │  │
│  │  Providers   │  │  (PTY, Git,  │  │  Handlers  │  │
│  │             │  │  Files, etc) │  │            │  │
│  └─────────────┘  └──────────────┘  └───────────┘  │
│         │                │                │         │
│  ┌──────┴────────────────┴────────────────┘         │
│  │              Hook Server (HTTP)                   │
│  └──────────────────────────────────────────────────│
└─────────────────┬───────────────────────────────────┘
                  │ IPC (contextBridge)
┌─────────────────┴───────────────────────────────────┐
│              Preload (window.clubhouse)               │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────┐
│                 Renderer Process                     │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  React   │  │  Zustand  │  │     Plugin       │  │
│  │   UI     │  │  Stores   │  │     System       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Main Process (`src/main/`)

The main process runs in Node.js and handles all system-level operations:

- **Orchestrator providers** — Abstractions over CLI tools (Claude Code, Copilot CLI, OpenCode)
- **Services** — PTY management, git operations, file I/O, logging, plugin storage
- **IPC handlers** — Respond to renderer requests via typed channels
- **Hook server** — HTTP server that receives real-time events from running agents

Key files:
- `index.ts` — App entry point, window creation, menu setup
- `ipc/` — Handler modules organized by domain (agent, file, git, plugin, etc.)
- `services/` — Business logic decoupled from IPC
- `orchestrators/` — Provider implementations and registry

### Renderer Process (`src/renderer/`)

The renderer is a React 19 application with Zustand for state management:

- **Features** — UI feature modules (agents, settings, terminal, projects, plugins, help)
- **Stores** — Zustand stores for agents, projects, orchestrators, UI state, themes, etc.
- **Panels** — Layout components (ExplorerRail, ProjectRail, AccessoryPanel, MainContentView)
- **Plugins** — Plugin loader, API factory, event bus, and built-in plugins

Key files:
- `index.tsx` — React root
- `App.tsx` — Top-level component wiring IPC listeners and global state
- `panels/` — Layout shell
- `features/` — Domain-specific UI
- `stores/` — State containers

### Preload Bridge (`src/preload/`)

The preload script uses Electron's `contextBridge` to expose a safe `window.clubhouse` API to the renderer. This is the only interface between the renderer and main process.

```ts
window.clubhouse = {
  pty:     { spawnShell, write, resize, kill, getBuffer, onData, onExit },
  project: { list, add, remove, pickDirectory, update, ... },
  agent:   { spawnAgent, killAgent, getModelOptions, onHookEvent, ... },
  git:     { info, checkout, stage, commit, push, pull, diff, ... },
  file:    { readTree, read, write, delete, rename, stat, ... },
  plugin:  { discoverCommunity, storageRead, storageWrite, ... },
  app:     { getTheme, saveTheme, getVersion, ... },
  log:     { write, getSettings, saveSettings, ... },
  process: { exec },
}
```

### Shared (`src/shared/`)

Types, constants, and utilities used by both processes:

- `types.ts` — Core data types (Agent, Project, CompletedQuickAgent, etc.)
- `ipc-channels.ts` — All IPC channel name constants
- `plugin-types.ts` — Plugin manifest and API type definitions
- `name-generator.ts` — Agent name and color generation
- `template-engine.ts` — `{{VAR}}` expansion for system prompts

## IPC Communication

All IPC channels are defined as constants in `src/shared/ipc-channels.ts` and organized by domain:

| Namespace | Purpose | Examples |
|-----------|---------|----------|
| `pty:*` | Terminal management | `spawn-shell`, `write`, `resize`, `data` (event) |
| `project:*` | Project CRUD | `list`, `add`, `remove`, `check-git` |
| `agent:*` | Agent lifecycle | `spawn-agent`, `kill-agent`, `hook-event` (event) |
| `file:*` | File system | `read-tree`, `read`, `write`, `delete` |
| `git:*` | Git operations | `info`, `checkout`, `commit`, `push`, `diff` |
| `app:*` | App settings | `get-theme`, `save-theme`, `get-version` |
| `plugin:*` | Plugin storage/files | `storage-read`, `storage-write`, `discover-community` |
| `log:*` | Logging | `write`, `get-settings`, `get-path` |
| `process:*` | CLI execution | `exec` |

Channels ending in events (like `pty:data`, `pty:exit`, `agent:hook-event`) use `ipcMain.emit` / `webContents.send` for push-based communication from main to renderer.

## Main Process Services

The `src/main/services/` directory contains the core business logic:

| Service | Purpose |
|---------|---------|
| `agent-system.ts` | Central orchestration — resolves provider, spawns agents (PTY or headless) |
| `agent-config.ts` | Durable agent persistence (`.clubhouse/agents.json`) |
| `pty-manager.ts` | node-pty lifecycle, 512KB circular buffer, graceful kill |
| `headless-manager.ts` | Headless agent spawning with JSONL output parsing |
| `hook-server.ts` | HTTP server for agent hook events (nonce-authenticated) |
| `config-pipeline.ts` | Snapshot/restore of config files before/after agent runs |
| `git-service.ts` | Git operations (status, log, diff, branch, stash) |
| `file-service.ts` | File system operations (read, write, tree, stat) |
| `project-store.ts` | Project list persistence |
| `plugin-discovery.ts` | Community plugin scanning (`~/.clubhouse/plugins/`) |
| `plugin-storage.ts` | Scoped key-value storage for plugins |
| `log-service.ts` | Structured logging with namespace filtering and retention |
| `theme-service.ts` | Theme persistence |
| `notification-service.ts` | Desktop notification dispatch |
| `safe-mode.ts` | Crash detection and plugin auto-disable |
| `transcript-parser.ts` | Extract summary/cost/tools from headless JSONL transcripts |

## Renderer Stores

State management uses Zustand with separate stores per domain:

| Store | Key State |
|-------|-----------|
| `agentStore` | Running agents, active agent, detailed status, spawn/kill/delete |
| `projectStore` | Project list, active project, git status, project icons |
| `orchestratorStore` | Enabled orchestrators, availability, capabilities |
| `headlessStore` | Global headless toggle + per-project overrides |
| `quickAgentStore` | Completed quick agent records with summaries |
| `uiStore` | Active tab, settings page, navigation state |
| `themeStore` | Current theme ID and applied theme definition |
| `notificationStore` | Notification settings, visibility-aware dispatch |
| `loggingStore` | Log settings, namespace filters |
| `plugin-store` | Plugin registry, enabled state, settings, permissions |

### Zustand Patterns

**Selectors** — Always select primitive values or stable references. Never call methods that return new arrays/objects inside a selector, as this causes infinite re-render loops:

```ts
// WRONG — creates new array every render
const agents = useAgentStore(s => s.getAgentList());

// RIGHT — select raw state, compute in component
const agents = useAgentStore(s => s.agents);
const agentList = useMemo(() => Object.values(agents), [agents]);
```

**Optimistic updates** — Async actions update local state immediately, then revert on error:

```ts
setEnabled: async (enabled) => {
  const prev = get().enabled;
  set({ enabled });            // optimistic
  try {
    await window.clubhouse.app.saveSettings({ enabled });
  } catch {
    set({ enabled: prev });    // revert
  }
}
```

## Layout Structure

The renderer UI is organized into a panel-based layout:

```
┌──────────┬─────────────┬──────────────────────────┐
│ Project  │  Explorer   │                          │
│  Rail    │   Rail      │     Main Content View    │
│          │             │                          │
│ (icons)  │  Agents     │   Agent terminal, or     │
│          │  Settings   │   Settings page, or      │
│          │  Help       │   Plugin content          │
│          │  Plugins    │                          │
│          │             │                          │
│          ├─────────────┤                          │
│          │  Accessory  │                          │
│          │   Panel     │                          │
│          │  (list/nav) │                          │
└──────────┴─────────────┴──────────────────────────┘
```

- **ProjectRail** — Left-most rail with project icons and app-level plugin entries
- **ExplorerRail** — Tab navigation (Agents, Settings, Help, plugin tabs)
- **AccessoryPanel** — Contextual sidebar (agent list, settings nav, plugin sidebar)
- **MainContentView** — Primary content area (agent view, settings form, plugin main panel)

## Data Flow Example: Spawning a Quick Agent

1. User clicks "Add Agent" in the AccessoryPanel → `AddAgentDialog` opens
2. User enters mission, selects model/orchestrator, clicks "Run"
3. `agentStore.spawnQuickAgent()` generates ID, name, color
4. IPC call: `window.clubhouse.agent.spawnAgent({ agentId, mission, kind: 'quick', ... })`
5. Main process: `agent-system.spawnAgent()` resolves orchestrator provider
6. Provider decides PTY vs headless based on `headless-settings`
7. **PTY path**: writes hooks config → spawns node-pty with CLI binary and args
8. **Headless path**: spawns child process with stdio pipes, parses JSONL
9. Hook events flow back via HTTP POST → `hook-server` → IPC → renderer
10. `agentStore.handleHookEvent()` updates detailed status ("Reading file...", "Editing code...")
11. On exit: transcript parsed for summary, cost, files modified → `quickAgentStore.addCompleted()`
