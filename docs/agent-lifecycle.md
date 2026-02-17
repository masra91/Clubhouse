# Agent Lifecycle

Clubhouse manages two kinds of AI agents — **durable** agents that persist across sessions and **quick** agents that run a single task and complete. Both can run in interactive (PTY) or headless mode, and both receive real-time status updates through the hook system.

## Agent Types

### Durable Agents

Long-lived agents tied to a project. They have persistent configuration, can be assigned to dedicated git worktrees/branches, and can be put to sleep and woken up.

**Configuration** is stored in `.clubhouse/agents.json`:

```ts
interface DurableAgentConfig {
  id: string;
  name: string;               // Generated name (e.g. "swift-leopard")
  color: string;               // Color ID (indigo, emerald, amber, etc.)
  emoji?: string;
  branch?: string;             // Dedicated git branch
  worktreePath?: string;       // Git worktree path for branch isolation
  createdAt: string;
  model?: string;              // Preferred model
  quickAgentDefaults?: {       // Defaults for child quick agents
    systemPrompt?: string;
    allowedTools?: string[];
    defaultModel?: string;
  };
  orchestrator?: OrchestratorId;  // Override project default
}
```

**States**: `running` → `sleeping` (on exit code 0) or `error` (on non-zero exit)

**Lifecycle**:
1. **Create** — User creates via UI. Config written to `agents.json`. Optional git worktree created.
2. **Spawn** — Agent started via CLI in its worktree (or project root). Session can resume.
3. **Sleep** — Agent exits normally. Can be woken up (re-spawned with `resume: true`).
4. **Delete** — Multiple deletion modes (see below).

### Quick Agents

One-shot agents that execute a mission and terminate. They run with a predefined permission set and produce a summary on completion.

**Default permissions** (Claude Code):
```
Bash(git:*), Bash(npm:*), Bash(npx:*), Read, Write, Edit, Glob, Grep
```

**Lifecycle**:
1. **Spawn** — User provides a mission prompt. Agent gets a generated name and color.
2. **Run** — Executes in PTY or headless mode.
3. **Complete** — On exit, transcript is parsed for summary, files modified, cost, and duration.
4. **Ghost** — Completed agent appears as a `QuickAgentGhost` card showing results.
5. **Dismiss** — User dismisses the ghost card.

**Parent-child relationship**: Quick agents can be spawned as children of a durable agent, inheriting the parent's worktree and system prompt defaults.

## Spawn Modes

### Interactive (PTY)

The default mode. Agents run in a pseudo-terminal via `node-pty`, giving them a full interactive shell environment.

**Flow**:
1. Config pipeline snapshots the existing hooks config file
2. Provider writes its hook config to the project (e.g. `.claude/settings.local.json`)
3. Hook server ensures it's running and provides a callback URL
4. Provider builds the CLI command with all arguments
5. `pty-manager.spawn()` creates the PTY process
6. Terminal output is buffered (512KB circular buffer) and streamed to the renderer
7. Hook events arrive via HTTP POST to the hook server
8. On exit: config pipeline restores the original hooks config

### Headless

Quick agents can optionally run in headless mode (Claude Code `-p` flag), which skips the terminal and parses structured JSON output directly.

**Flow**:
1. Provider builds the headless command: `claude -p '{mission}' --output-format stream-json --verbose --dangerously-skip-permissions`
2. `headless-manager.ts` spawns a child process with stdio pipes
3. stdout is piped through a `JsonlParser` that emits line events
4. Each JSONL event is mapped to a `NormalizedHookEvent` and sent to the renderer
5. Raw events are persisted to `~/.clubhouse/agent-logs/{agentId}.jsonl`
6. On exit: `transcript-parser.ts` analyzes the JSONL for summary, cost, files, and tools

**Headless settings** are managed globally and per-project:
- Global toggle: enables headless for all projects
- Per-project override: force headless or interactive for specific projects
- Settings stored in `~/Library/Application Support/Clubhouse/headless-settings.json`

**Benefits of headless mode**:
- Lower resource usage (no PTY allocation)
- Structured output with cost tracking
- Full transcript with tool-level detail
- Faster startup

**Tradeoffs**:
- No interactive terminal (can't manually intervene)
- No permission prompts (runs with `--dangerously-skip-permissions`)
- Only available for quick agents

## Hook Events

Running agents emit real-time status events that Clubhouse normalizes and displays in the UI.

### Event Kinds

| Kind | Meaning | UI Display |
|------|---------|------------|
| `pre_tool` | Agent is about to use a tool | "Reading file...", "Editing code..." |
| `post_tool` | Tool execution completed | Clears to "Thinking..." |
| `tool_error` | Tool execution failed | Shows error with tool name |
| `stop` | Agent finished a turn | Updates status |
| `notification` | Agent-generated notification | Shows notice |
| `permission_request` | Agent needs permission | "Needs permission" overlay |

### Hook Server

For interactive (PTY) agents, hook events are received via an HTTP server running in the main process:

- Listens on a random port (discovered at startup)
- URL pattern: `http://127.0.0.1:{port}/hook/{agentId}/{eventHint?}`
- Each agent gets a UUID nonce for authentication (sent as `X-Clubhouse-Nonce` header)
- Events are routed through the provider's `parseHookEvent()` to normalize CLI-specific formats

### Headless Events

For headless agents, events are extracted from the JSONL output stream. The headless manager maps event types (`assistant`, `user`, `result`, `content_block_*`) to normalized hook events and emits them via IPC.

### Tool Verbs

Each provider maps tool names to human-readable verbs for the UI:

```ts
// Claude Code
toolVerb('Read')  → 'Reading file'
toolVerb('Edit')  → 'Editing file'
toolVerb('Bash')  → 'Running command'
toolVerb('Task')  → 'Running subtask'

// Copilot CLI
toolVerb('shell') → 'Running command'
toolVerb('read')  → 'Reading file'
```

## Config Pipeline

When Clubhouse spawns an interactive agent, it needs to write hook configuration to the project directory (so the CLI knows to send events back). The config pipeline ensures this doesn't permanently modify the user's config:

1. **Snapshot** — Before writing, the original file content is saved in memory
2. **Reference counting** — Multiple agents sharing a config increment a ref count
3. **Write** — Hook configuration is merged into the file
4. **Restore** — On agent exit, the original content is restored (or file deleted if it didn't exist)

This prevents Clubhouse from polluting `.claude/settings.local.json` or `.github/hooks/hooks.json` after agents finish.

## Agent Deletion

Durable agents support multiple deletion modes, chosen via a dialog that inspects the agent's git worktree status:

| Mode | Behavior |
|------|----------|
| **Commit & Push** | Commits uncommitted changes, pushes the branch, then deletes worktree and config |
| **Cleanup Branch** | Deletes the worktree and branch without preserving changes |
| **Save Patch** | Generates a `.patch` file from uncommitted changes, then deletes worktree |
| **Force Delete** | Deletes everything without any git operations |
| **Unregister** | Removes the agent from `agents.json` but leaves the worktree/branch intact |

The dialog shows the agent's worktree status (uncommitted files, unpushed commits, remote tracking) to help the user make an informed choice.

## Transcript Parsing

When a headless agent completes, its JSONL transcript is analyzed by `transcript-parser.ts`:

**Extracted data**:
- `summary` — Last assistant text or explicit result event
- `filesModified` — Files touched by Write/Edit tools
- `costUsd` — API cost (from `result` event metadata)
- `durationMs` — Wall-clock time
- `toolsUsed` — Deduplicated list of tool names

This data is stored in the `CompletedQuickAgent` record and displayed in the ghost card.

## System Prompt Templates

When spawning agents, Clubhouse builds a system prompt using the provider's `buildSummaryInstruction()` method. This can include:

- The agent's mission/task
- Project context (path, branch)
- Agent identity (name, ID)
- Custom instructions from the durable agent config

Template variables are expanded by `src/shared/template-engine.ts`:
- `{{AGENT_NAME}}` — Agent display name
- `{{AGENT_TYPE}}` — `durable` or `quick`
- `{{WORKTREE_PATH}}` — Git worktree path
- `{{BRANCH}}` — Current branch
- `{{PROJECT_PATH}}` — Project root path

## Environment Variables

When spawning agents, Clubhouse sets:
- `CLUBHOUSE_AGENT_ID` — The agent's unique ID (for routing hook events)
- `CLUBHOUSE_HOOK_NONCE` — UUID for hook authentication (PTY mode only)

And removes (to prevent conflicts with nested CLI instances):
- `CLAUDECODE`
- `CLAUDE_CODE_ENTRYPOINT`
