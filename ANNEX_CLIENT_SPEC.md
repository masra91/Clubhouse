# Clubhouse Annex — iOS Client Specification

This document describes the server-side API that the Annex server exposes on the local network. The iOS client connects to this API to monitor Clubhouse agents in real time.

---

## Discovery

The Annex server advertises itself via **Bonjour/mDNS**.

| Field | Value |
|-------|-------|
| Service type | `_clubhouse-annex._tcp` |
| Domain | `local.` |
| TXT records | `v=1`, `port=<number>` |
| Name | User-configurable device name (default: `Clubhouse on <hostname>`) |

Browse for `_clubhouse-annex._tcp.local.` using `NWBrowser` or `NetServiceBrowser`. The resolved host + port is the Annex server.

---

## Pairing

Before any authenticated request, the client must exchange a PIN for a session token.

### `POST /pair`

The user reads a 6-digit PIN from the Clubhouse desktop app (Settings > Annex) and enters it in the iOS app.

**Request:**
```json
{
  "pin": "123456"
}
```

**Success (200):**
```json
{
  "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Failure (401):**
```json
{
  "error": "invalid_pin"
}
```

**Notes:**
- The PIN changes every time Annex is enabled or the user regenerates it
- Tokens are held in memory only — they do not survive an app restart on the desktop, so the iOS app should handle re-pairing gracefully
- Store the token in Keychain for the session; discard it on 401 from any authenticated endpoint

---

## Authentication

All endpoints (except `POST /pair`) require:

```
Authorization: Bearer <token>
```

A `401` response on any authenticated endpoint means the token is invalid (likely the desktop app restarted or the user regenerated the PIN). The iOS app should prompt for re-pairing.

---

## REST Endpoints

### `GET /api/v1/status`

Health check and server identity.

**Response:**
```json
{
  "version": "1",
  "deviceName": "Clubhouse on Mason's Mac",
  "agentCount": 3
}
```

---

### `GET /api/v1/projects`

List all open projects in Clubhouse.

**Response:**
```json
[
  {
    "id": "proj_abc123",
    "name": "my-app",
    "path": "/Users/mason/source/my-app",
    "color": "emerald",
    "icon": null
  }
]
```

**Key fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable project identifier |
| `name` | string | Display name |
| `path` | string | Absolute filesystem path |
| `color` | string? | Color token (e.g. `"emerald"`, `"rose"`) |

---

### `GET /api/v1/projects/:projectId/agents`

List all durable agents for a project, with their runtime status.

**Response:**
```json
[
  {
    "id": "durable_1737000000000_abc123",
    "name": "faithful-urchin",
    "kind": "durable",
    "color": "emerald",
    "status": "running",
    "branch": "faithful-urchin/standby",
    "model": "claude-opus-4-5",
    "detailedStatus": {
      "state": "working",
      "message": "Editing file",
      "toolName": "Edit",
      "timestamp": 1708531200000
    },
    "mission": null,
    "quickAgents": [
      {
        "id": "quick_1737000100000_def456",
        "name": "quick-agent-1",
        "kind": "quick",
        "status": "running",
        "mission": "Fix the login bug",
        "model": "claude-sonnet-4-5",
        "detailedStatus": {
          "state": "idle",
          "message": "",
          "toolName": null,
          "timestamp": 1708531190000
        }
      }
    ]
  }
]
```

**Agent fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique agent identifier |
| `name` | string | Display name |
| `kind` | `"durable"` \| `"quick"` | Durable = persistent worktree; Quick = ephemeral |
| `color` | string | Color token for UI theming |
| `status` | `"running"` \| `"sleeping"` \| `"error"` | Runtime lifecycle state |
| `branch` | string? | Git branch (durable agents only) |
| `model` | string? | AI model in use (e.g. `"claude-opus-4-5"`) |
| `mission` | string? | The task/prompt the agent is working on |
| `detailedStatus` | object? | Current tool-level activity (see below) |
| `quickAgents` | array | Child quick agents (durable agents only) |

**`detailedStatus` fields:**
| Field | Type | Description |
|-------|------|-------------|
| `state` | `"idle"` \| `"working"` \| `"needs_permission"` \| `"tool_error"` | What the agent is doing right now |
| `message` | string | Human-readable description (e.g. `"Editing src/main.ts"`) |
| `toolName` | string? | Tool being used (e.g. `"Edit"`, `"Bash"`, `"Read"`) |
| `timestamp` | number | Unix ms when this status was set |

**Status semantics:**
- `idle` — agent is thinking or waiting for model response
- `working` — actively executing a tool
- `needs_permission` — blocked waiting for user approval on the desktop
- `tool_error` — last tool execution failed

---

### `GET /api/v1/agents/:agentId/buffer`

Fetch the terminal scrollback buffer for a running agent. This is raw terminal output including ANSI escape sequences.

**Response:**
```
Content-Type: text/plain; charset=utf-8
```

Body is the raw terminal buffer (up to 512KB). Contains ANSI escape codes for colors, cursor movement, etc.

**Usage:** Call this on initial view of an agent to populate the terminal history. Live updates come via WebSocket.

**Note:** If you want to render this in a terminal view, you'll need an ANSI parser (e.g. a stripped-down xterm.js in WKWebView, or a native ANSI-attributed-string renderer). For a simpler v1, you could skip raw terminal rendering and rely solely on the structured `hook:event` stream for activity display.

---

## WebSocket

### Connection

```
ws://<host>:<port>/ws?token=<session-token>
```

The connection is rejected with HTTP 401 if the token is invalid.

### Message Format

All messages are JSON with this envelope:

```typescript
{
  type: string,
  payload: object
}
```

### Message Types

#### `snapshot` (server → client, sent once on connect)

Full current state. The client should use this to initialize its UI.

```json
{
  "type": "snapshot",
  "payload": {
    "projects": [ /* same shape as GET /api/v1/projects */ ],
    "agents": {
      "proj_abc123": [ /* same shape as GET /api/v1/projects/:id/agents */ ]
    }
  }
}
```

#### `hook:event` (server → client, live stream)

Real-time agent tool activity. This is the primary signal for showing what agents are doing.

```json
{
  "type": "hook:event",
  "payload": {
    "agentId": "durable_1737000000000_abc123",
    "event": {
      "kind": "pre_tool",
      "toolName": "Edit",
      "toolInput": {
        "file_path": "/src/main.ts",
        "old_string": "foo",
        "new_string": "bar"
      },
      "toolVerb": "Editing file",
      "timestamp": 1708531200000
    }
  }
}
```

**`event.kind` values:**
| Kind | Meaning | Useful fields |
|------|---------|---------------|
| `pre_tool` | Tool is about to execute | `toolName`, `toolInput`, `toolVerb` |
| `post_tool` | Tool finished executing | `toolName` |
| `tool_error` | Tool execution failed | `toolName`, `message` |
| `stop` | Agent stopped (completed or errored) | `message` |
| `notification` | Agent wants to notify the user | `message` |
| `permission_request` | Agent is blocked waiting for approval | `toolName`, `toolInput`, `message` |

**Common `toolName` values:** `Edit`, `Read`, `Write`, `Bash`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `Task`

#### `pty:data` (server → client, live stream)

Raw terminal output chunk. High frequency — multiple messages per second during active agent work.

```json
{
  "type": "pty:data",
  "payload": {
    "agentId": "durable_1737000000000_abc123",
    "data": "\u001b[32m✓\u001b[0m Tests passed\r\n"
  }
}
```

`data` contains raw ANSI terminal text. This is the same data that drives the desktop terminal view.

#### `pty:exit` (server → client)

An agent's terminal process exited.

```json
{
  "type": "pty:exit",
  "payload": {
    "agentId": "durable_1737000000000_abc123",
    "exitCode": 0
  }
}
```

After receiving this, the agent's status will transition to `"sleeping"` (exitCode 0) or `"error"` (non-zero). A subsequent `snapshot` or REST call will reflect the new status.

---

## Recommended iOS Implementation Approach

### Minimum viable viewer

For a v1 viewer, you do **not** need to render raw terminal output. A structured activity feed built from `hook:event` messages is simpler and more mobile-friendly:

1. **Project list** — from `snapshot` or `GET /api/v1/projects`
2. **Agent cards** — from `snapshot` agents, showing name, color, status badge, model
3. **Activity feed per agent** — append `hook:event` messages as they arrive:
   - `pre_tool` → "Editing src/main.ts" (use `toolVerb`)
   - `permission_request` → "Needs permission: Run bash command" (highlighted)
   - `stop` → "Agent stopped"
4. **Status badges** — derive from `detailedStatus.state`:
   - `idle` → gray/neutral
   - `working` → green/active with the `toolVerb` as subtitle
   - `needs_permission` → yellow/amber (this is actionable on desktop only in v1)
   - `tool_error` → red

### Connection lifecycle

```
1. Browse mDNS for _clubhouse-annex._tcp
2. Show discovered devices (by name)
3. User selects device → prompt for PIN
4. POST /pair → store token
5. Connect WebSocket → receive snapshot → populate UI
6. Stream events → update UI in real time
7. On 401 or disconnect → prompt for re-pair
```

### Reconnection

- On WebSocket close: attempt reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- On reconnect success: the server sends a fresh `snapshot`, so the client can fully re-sync
- On 401 during reconnect: the token is stale, prompt for re-pairing

### Data considerations

- `pty:data` messages are high-frequency and high-volume. If you're not rendering a terminal, you can **ignore** these entirely and rely on `hook:event` for the activity feed.
- `hook:event` messages are moderate frequency (roughly one per tool call, so a few per minute during typical agent work, potentially faster during active coding).
- The `snapshot` payload includes all projects and agents — it should be small (a few KB) unless the user has dozens of projects.

---

## Color Tokens

Agent and project colors use named tokens. Map these to your iOS palette:

`emerald`, `rose`, `sky`, `amber`, `violet`, `teal`, `pink`, `indigo`, `lime`, `orange`, `cyan`, `fuchsia`, `red`, `blue`, `green`, `yellow`

---

## API Versioning

All REST endpoints are under `/api/v1/`. The `snapshot` message includes the same data shapes. If the API changes incompatibly in the future, we'll bump to `/api/v2/` and add a `v` field to the WebSocket snapshot. The mDNS TXT record `v=1` indicates the current protocol version.
