# Clubhouse Annex — Implementation Plan

## Context

Clubhouse Annex is a read-only LAN monitoring server that lets an iOS companion app observe agent activity in real time. It runs in the Electron main process and is **disabled by default** with zero overhead when off — no server, no mDNS, no event listeners.

**Scope (v1):** Viewer only — no agent spawning, killing, terminal input, or config changes from mobile. Just live monitoring.

---

## Architecture

```
┌─────────────┐         ┌──────────────────────────────────┐
│  iOS App    │◄──WS───►│  Annex Server (main process)     │
│  (SwiftUI)  │         │                                  │
└─────────────┘         │  annexServer.ts                  │
       ▲                │    ├── HTTP REST (state queries)  │
       │ mDNS           │    ├── WebSocket (live events)    │
       │ discovery      │    └── mDNS advertisement         │
       │                │                                  │
       │                │  annexEventBus.ts                │
       │                │    ├── ptyManager → emitPtyData   │
       │                │    └── hookServer → emitHookEvent │
       │                │                                  │
       │                │  annexSettings.ts                │
       │                │    └── createSettingsStore        │
       │                └──────────────────────────────────┘
       │
  _clubhouse-annex._tcp.local.
```

When disabled: `annexEventBus.emitPtyData()` and `emitHookEvent()` each hit a single `if (!active) return;` check — no allocations, no iteration.

---

## New Files (7)

### `src/main/services/annex-settings.ts`
Settings store using `createSettingsStore<AnnexSettings>`. Persists to `annex-settings.json` in `app.getPath('userData')`.

```typescript
interface AnnexSettings {
  enabled: boolean;       // default: false
  deviceName: string;     // default: `Clubhouse on ${os.hostname()}`
}
```

### `src/main/services/annex-event-bus.ts`
Lightweight internal pub/sub. Three event types: `ptyData`, `hookEvent`, `ptyExit`. Each has `emit*()` (called by pty-manager/hook-server) and `on*()` (called by annex-server). All emitters gate on a single `active` boolean — zero cost when off.

```typescript
export function setActive(flag: boolean): void;
export function emitPtyData(agentId: string, data: string): void;
export function emitHookEvent(agentId: string, event: AgentHookEvent): void;
export function emitPtyExit(agentId: string, exitCode: number): void;
export function onPtyData(fn): () => void;     // returns unsubscribe
export function onHookEvent(fn): () => void;
export function onPtyExit(fn): () => void;
```

### `src/main/services/annex-server.ts`
The core server. Module-level singleton following `hook-server.ts` pattern.

**Lifecycle:**
- `start()` — creates HTTP server on `0.0.0.0:0` (OS-assigned port), attaches `ws.WebSocketServer`, publishes mDNS, subscribes to event bus, generates PIN
- `stop()` — unsubscribes from event bus, closes all WS clients, closes HTTP server, un-publishes mDNS, clears all state
- `getStatus()` — returns `{ advertising, port, pin, connectedCount }`
- `regeneratePin()` — invalidates all session tokens, generates new PIN

**HTTP Endpoints (all except `/pair` require `Authorization: Bearer <token>`):**

| Method | Path | Response |
|--------|------|----------|
| `POST` | `/pair` | `{ pin: "123456" }` → `{ token: "<uuid>" }` or 401 |
| `GET` | `/api/v1/status` | `{ version: "1", deviceName, agentCount }` |
| `GET` | `/api/v1/projects` | `Project[]` |
| `GET` | `/api/v1/projects/:id/agents` | Durable agent configs + runtime status |
| `GET` | `/api/v1/agents/:id/buffer` | Raw PTY buffer (ANSI text, up to 512KB) |

**WebSocket (`ws://host:port/ws?token=<token>`):**

On connect: send `snapshot` message with full state. Then stream:
- `{ type: "pty:data", agentId, data }` — terminal output chunks
- `{ type: "pty:exit", agentId, exitCode }` — agent terminal exited
- `{ type: "hook:event", agentId, event }` — tool activity (AgentHookEvent)

**Auth:** 6-digit PIN generated via `crypto.randomInt`. Exchanged for a UUID session token via `/pair`. Tokens held in-memory `Set<string>` — lost on restart (re-pair required). No rate-limiting in v1.

### `src/main/ipc/annex-handlers.ts`
IPC handler registration. Four handlers:
- `annex:get-settings` → returns settings
- `annex:save-settings` → saves + conditionally starts/stops server
- `annex:get-status` → returns server status
- `annex:regenerate-pin` → regenerates PIN, broadcasts status change

### `src/renderer/stores/annexStore.ts`
Zustand store holding `settings` and `status`. Methods: `loadSettings`, `saveSettings`, `regeneratePin`. Listens for `annex:status-changed` push from main process.

### `src/renderer/features/settings/AnnexSettingsView.tsx`
Settings panel following `UpdateSettingsView.tsx` pattern exactly (same Toggle component, same layout structure). Shows:
- Enable/disable toggle
- When enabled: status line, connected client count, PIN display with "Regenerate" button

### `src/main/services/annex-server.test.ts`
Unit tests covering: start/stop lifecycle, PIN pairing (success + failure), token auth enforcement, WebSocket connection + snapshot delivery, event forwarding from bus to WS clients.

---

## Modified Files (9)

### `src/shared/types.ts` (line ~180)
- Add `'annex'` to `SettingsSubPage` union
- Add `AnnexSettings` and `AnnexStatus` interfaces

### `src/shared/ipc-channels.ts`
Add `ANNEX` namespace to the `IPC` const:
```typescript
ANNEX: {
  GET_SETTINGS:    'annex:get-settings',
  SAVE_SETTINGS:   'annex:save-settings',
  GET_STATUS:      'annex:get-status',
  REGENERATE_PIN:  'annex:regenerate-pin',
  STATUS_CHANGED:  'annex:status-changed',
},
```

### `src/main/ipc/index.ts`
- Import and call `registerAnnexHandlers()` inside `registerAllHandlers()`
- After hook server start, conditionally start Annex if settings.enabled

### `src/main/index.ts`
- Call `annexServer.stop()` in the `before-quit` handler

### `src/main/services/pty-manager.ts`
Add one line in `proc.onData` callback (after `broadcastToAllWindows`):
```typescript
annexEventBus.emitPtyData(agentId, data);
```
Add one line in `proc.onExit` callback:
```typescript
annexEventBus.emitPtyExit(agentId, exitCode);
```

### `src/main/services/hook-server.ts`
Add one line after the `broadcastToAllWindows(IPC.AGENT.HOOK_EVENT, ...)` call:
```typescript
annexEventBus.emitHookEvent(agentId, { kind, toolName, toolInput, message, toolVerb, timestamp });
```

### `src/preload/index.ts`
Add `annex` namespace to the exposed API object with: `getSettings`, `saveSettings`, `getStatus`, `regeneratePin`, `onStatusChanged`.

### `src/renderer/panels/AccessoryPanel.tsx` (line ~47)
Add nav button in the app settings section:
```tsx
{navButton('Annex', 'annex')}
```

### `src/renderer/panels/MainContentView.tsx`
Add import for `AnnexSettingsView` and route for `settingsSubPage === 'annex'`.

---

## Dependencies

Add to `package.json`:
```json
"dependencies": {
  "bonjour-service": "^1.3.0",
  "ws": "^8.17.1"
},
"devDependencies": {
  "@types/ws": "^8.5.13"
}
```

`bonjour-service` is pure JS (no native bindings). `ws` is the standard Node.js WebSocket library.

---

## Implementation Order

1. **Types + IPC channels** — `types.ts`, `ipc-channels.ts`
2. **Event bus** — `annex-event-bus.ts` + tests
3. **Settings** — `annex-settings.ts`
4. **Server** — `annex-server.ts` + tests
5. **IPC handlers** — `annex-handlers.ts`
6. **Wire into existing services** — one-line additions to `pty-manager.ts`, `hook-server.ts`, `index.ts` files
7. **Preload** — add annex API surface
8. **Renderer** — `annexStore.ts`, `AnnexSettingsView.tsx`, nav/route additions
9. **Dependencies** — `npm install bonjour-service ws @types/ws`

---

## Verification

1. **Feature off (default):** Start app, confirm no listening port, no mDNS advertisement, no errors in logs
2. **Enable via settings:** Toggle on, confirm port appears in status, mDNS service is browseable (`dns-sd -B _clubhouse-annex._tcp`)
3. **Pairing:** POST to `/pair` with correct PIN → get token. Wrong PIN → 401.
4. **REST endpoints:** GET `/api/v1/projects`, `/api/v1/projects/:id/agents` with valid token → correct data. No token → 401.
5. **WebSocket:** Connect with token → receive snapshot. Start an agent → receive `hook:event` and `pty:data` messages.
6. **Disable:** Toggle off → server closes, mDNS un-published, WS clients disconnected, subsequent requests refused
7. **App quit:** Quit while enabled → clean shutdown, no orphaned mDNS records
8. **Tests pass:** `npm test` — all new and existing tests green
9. **Build:** `npm run build` succeeds with no type errors
