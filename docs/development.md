# Development Guide

## Prerequisites

- **Node.js** (LTS recommended)
- **npm**
- **macOS** (primary target; Electron supports Windows/Linux but packaging is macOS-focused)

## Getting Started

```bash
git clone <repo-url>
cd Clubhouse
npm install
npm start
```

`npm start` launches Electron Forge's dev server with webpack hot reload.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Development mode with hot reload |
| `npm test` | Run all Vitest tests |
| `npm run test:unit` | Unit tests (main + shared projects) |
| `npm run test:components` | React component tests (renderer project) |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run package` | Package as .app (no installer) |
| `npm run make` | Build distributable installer |
| `npm run validate` | Full pipeline: typecheck + test + make + e2e |

## Project Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts             # App entry, window creation, menu
│   ├── ipc/                 # IPC handler modules
│   │   ├── agent-handlers.ts
│   │   ├── file-handlers.ts
│   │   ├── git-handlers.ts
│   │   ├── plugin-handlers.ts
│   │   └── ...
│   ├── services/            # Core business logic
│   │   ├── agent-system.ts     # Central agent orchestration
│   │   ├── agent-config.ts     # Durable agent persistence
│   │   ├── pty-manager.ts      # node-pty terminal management
│   │   ├── headless-manager.ts # Headless agent spawning
│   │   ├── hook-server.ts      # HTTP hook event server
│   │   ├── config-pipeline.ts  # Config snapshot/restore
│   │   ├── git-service.ts      # Git operations
│   │   ├── file-service.ts     # File system operations
│   │   ├── log-service.ts      # Structured logging
│   │   └── ...
│   ├── orchestrators/       # Provider implementations
│   │   ├── types.ts            # OrchestratorProvider interface
│   │   ├── registry.ts         # Provider registration
│   │   ├── claude-code-provider.ts
│   │   ├── copilot-cli-provider.ts
│   │   ├── opencode-provider.ts
│   │   └── shared.ts           # Shared utilities
│   └── util/                # Main process utilities
│
├── renderer/                # React UI (browser process)
│   ├── index.tsx            # React root
│   ├── App.tsx              # Top-level component
│   ├── features/            # Feature modules
│   │   ├── agents/             # Agent UI (terminal, avatar, list, dialogs)
│   │   ├── settings/           # Settings pages
│   │   ├── projects/           # Project dashboard, git banner
│   │   ├── terminal/           # ShellTerminal (xterm.js)
│   │   ├── plugins/            # Plugin management UI
│   │   └── help/               # Help system
│   ├── stores/              # Zustand state management
│   │   ├── agentStore.ts
│   │   ├── projectStore.ts
│   │   ├── orchestratorStore.ts
│   │   ├── uiStore.ts
│   │   └── ...
│   ├── panels/              # Layout components
│   │   ├── ProjectRail.tsx
│   │   ├── ExplorerRail.tsx
│   │   ├── AccessoryPanel.tsx
│   │   └── MainContentView.tsx
│   ├── plugins/             # Plugin system
│   │   ├── plugin-api-factory.ts
│   │   ├── plugin-loader.ts
│   │   ├── plugin-store.ts
│   │   ├── manifest-validator.ts
│   │   └── builtin/            # Built-in plugins
│   │       ├── hub/
│   │       ├── terminal/
│   │       ├── files/
│   │       ├── automations/
│   │       ├── issues/
│   │       └── wiki/
│   ├── hooks/               # Custom React hooks
│   └── themes/              # Theme definitions
│
├── preload/
│   └── index.ts             # IPC bridge (window.clubhouse)
│
└── shared/                  # Cross-process types and utilities
    ├── types.ts
    ├── ipc-channels.ts
    ├── plugin-types.ts
    ├── name-generator.ts
    └── template-engine.ts
```

## Testing

### Test Framework

The project uses **Vitest** with three test projects:

- **main** — Tests for main process services and orchestrator providers
- **renderer** — React component tests using `@testing-library/react` and jsdom
- **shared** — Tests for shared utilities

### Important: `mockReset: true`

The Vitest config enables `mockReset: true`, which auto-resets mock implementations between tests. Always set `mockReturnValue` / `mockResolvedValue` in `beforeEach`, not at module level:

```ts
// WRONG — will be reset before tests run
vi.mocked(someModule.someFunc).mockReturnValue('value');

// RIGHT — set in beforeEach
beforeEach(() => {
  vi.mocked(someModule.someFunc).mockReturnValue('value');
});
```

### Writing Tests

Tests live alongside their source files with a `.test.ts` suffix:

```
src/main/services/agent-system.ts
src/main/services/agent-system.test.ts
```

Run a specific test file:
```bash
npx vitest run src/main/services/agent-system.test.ts
```

### E2E Tests

Playwright tests are in the `e2e/` directory and test the full Electron application. Run with:

```bash
npm run test:e2e
```

## Build System

- **Electron Forge** — Handles packaging and distribution
- **Webpack** — Bundles main and renderer processes with TypeScript
- **Monaco Editor Webpack Plugin** — Bundles Monaco editor workers
- **node-loader** — Handles native Node.js modules (node-pty)
- **Tailwind CSS** — PostCSS plugin for utility classes

### Output

- `npm run package` → `out/Clubhouse-darwin-arm64/Clubhouse.app`
- `npm run make` → `out/make/` (ZIP on macOS)

## Conventions

### IPC

- All channel names are constants in `src/shared/ipc-channels.ts`
- Handlers are organized by domain in `src/main/ipc/`
- The preload bridge exposes them as `window.clubhouse.{namespace}.{method}()`

### State Management

- One Zustand store per domain concern
- Select primitive values in components to avoid re-render loops
- Use optimistic updates with error rollback for async actions
- Never call methods returning new arrays/objects inside Zustand selectors

### Orchestrator Providers

- Each provider owns its binary discovery, command building, and hook parsing
- Shared utilities go in `src/main/orchestrators/shared.ts`
- File conventions are declared in the `conventions` property

### Plugins

- Built-in plugins live in `src/renderer/plugins/builtin/`
- Each plugin has `manifest.ts` and `main.ts` at minimum
- Manifests declare permissions, contributions, and settings
- The plugin API version is `0.5` — manifests declaring older versions are rejected

### Naming

- Agent names are generated: `{adjective}-{animal}` for durable, `{adjective}-{noun}` for quick
- Agent colors cycle through 8 predefined options (indigo, emerald, amber, rose, cyan, violet, orange, teal)
- File names use kebab-case

## Data Storage

| Data | Location |
|------|----------|
| Project list | `~/Library/Application Support/Clubhouse/projects.json` |
| Orchestrator settings | `~/Library/Application Support/Clubhouse/orchestrator-settings.json` |
| Headless settings | `~/Library/Application Support/Clubhouse/headless-settings.json` |
| Theme | `~/Library/Application Support/Clubhouse/theme.json` |
| Notification settings | `~/Library/Application Support/Clubhouse/notifications.json` |
| Log settings | `~/Library/Application Support/Clubhouse/log-settings.json` |
| Application logs | `~/Library/Application Support/Clubhouse/logs/` |
| Agent transcripts | `~/.clubhouse/agent-logs/` |
| Plugin data (global) | `~/.clubhouse/plugin-data/{pluginId}/` |
| Plugin data (project) | `{project}/.clubhouse/plugin-data/{pluginId}/` |
| Plugin data (local) | `{project}/.clubhouse/plugin-data-local/{pluginId}/` |
| Community plugins | `~/.clubhouse/plugins/` |
| Project icons | `~/.clubhouse/project-icons/` |
| Durable agent configs | `{project}/.clubhouse/agents.json` |
| Startup marker | `~/.clubhouse/startup-marker.json` |
