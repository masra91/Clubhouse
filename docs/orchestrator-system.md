# Orchestrator System

The orchestrator system is the abstraction layer that lets Clubhouse work with multiple CLI-based coding agents through a single interface. Each CLI tool (Claude Code, GitHub Copilot CLI, OpenCode) is wrapped in an `OrchestratorProvider` that handles binary discovery, command building, hook parsing, and UI integration.

## The Provider Interface

Every orchestrator implements `OrchestratorProvider` (`src/main/orchestrators/types.ts`):

```ts
interface OrchestratorProvider {
  readonly id: OrchestratorId;
  readonly displayName: string;
  readonly shortName: string;
  readonly badge?: string;

  // Capabilities
  getCapabilities(): ProviderCapabilities;

  // Lifecycle
  checkAvailability(): Promise<{ available: boolean; error?: string }>;
  buildSpawnCommand(opts: SpawnOpts): Promise<{ binary: string; args: string[]; env?: Record<string, string> }>;
  getExitCommand(): string;

  // Hooks
  writeHooksConfig(cwd: string, hookUrl: string): Promise<void>;
  parseHookEvent(raw: unknown): NormalizedHookEvent | null;

  // Instructions
  readInstructions(worktreePath: string): string;
  writeInstructions(worktreePath: string, content: string): void;

  // Conventions
  readonly conventions: OrchestratorConventions;

  // UI helpers
  getModelOptions(): Promise<Array<{ id: string; label: string }>>;
  getDefaultPermissions(kind: 'durable' | 'quick'): string[];
  toolVerb(toolName: string): string | undefined;
  buildSummaryInstruction(agentId: string): string;
  readQuickSummary(agentId: string): Promise<{ summary: string | null; filesModified: string[] } | null>;

  // Headless mode (optional)
  buildHeadlessCommand?(opts: HeadlessOpts): Promise<HeadlessCommandResult | null>;
}
```

### Key Interfaces

**SpawnOpts** — Parameters for building the CLI command:
```ts
interface SpawnOpts {
  cwd: string;              // Working directory
  model?: string;           // Model to use (e.g. 'opus', 'sonnet')
  mission?: string;         // Task prompt for the agent
  systemPrompt?: string;    // Custom system prompt
  allowedTools?: string[];  // Tool whitelist
  resume?: boolean;         // Resume existing session
  agentId?: string;         // Agent identifier
}
```

**ProviderCapabilities** — Feature flags:
```ts
interface ProviderCapabilities {
  headless: boolean;          // Supports -p / non-interactive mode
  structuredOutput: boolean;  // Emits structured JSON output
  hooks: boolean;             // Supports hook events
  sessionResume: boolean;     // Can resume prior sessions
  permissions: boolean;       // Has a permission/tool allow system
}
```

**OrchestratorConventions** — File system conventions for each CLI:
```ts
interface OrchestratorConventions {
  configDir: string;              // e.g. '.claude'
  localInstructionsFile: string;  // e.g. 'CLAUDE.local.md'
  legacyInstructionsFile: string; // e.g. 'CLAUDE.md'
  mcpConfigFile: string;          // e.g. '.mcp.json'
  skillsDir: string;              // e.g. 'skills'
  agentTemplatesDir: string;      // e.g. 'agents'
  localSettingsFile: string;      // e.g. 'settings.local.json'
}
```

**NormalizedHookEvent** — Provider-agnostic hook event:
```ts
interface NormalizedHookEvent {
  kind: 'pre_tool' | 'post_tool' | 'tool_error' | 'stop' | 'notification' | 'permission_request';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  message?: string;
}
```

## Provider Registry

Providers are registered at startup in `src/main/orchestrators/registry.ts`:

```ts
const providers = new Map<OrchestratorId, OrchestratorProvider>();

export function registerBuiltinProviders(): void {
  registerProvider(new ClaudeCodeProvider());
  registerProvider(new CopilotCliProvider());
  registerProvider(new OpenCodeProvider());
}
```

The registry exposes `getProvider(id)`, `getAllProviders()`, and `registerProvider()` for lookup and enumeration.

## Orchestrator Resolution

When spawning an agent, the orchestrator is resolved with cascading priority in `src/main/services/agent-system.ts`:

1. **Agent-level override** — If the agent config specifies an orchestrator
2. **Project-level setting** — From `.clubhouse/settings.json` → `orchestrator` field
3. **App default** — Falls back to `'claude-code'`

```ts
function resolveOrchestrator(projectPath: string, agentOrchestrator?: OrchestratorId): OrchestratorProvider {
  const id = agentOrchestrator
    || readProjectOrchestrator(projectPath)  // .clubhouse/settings.json
    || 'claude-code';                         // default
  return getProvider(id);
}
```

## Built-in Providers

### Claude Code (`claude-code`)

The primary and most full-featured provider.

| Property | Value |
|----------|-------|
| Binary | `claude` (discovered via PATH + common install locations) |
| Config dir | `.claude` |
| Instructions | `.claude/CLAUDE.md`, `.claude/CLAUDE.local.md` |
| Settings | `.claude/settings.local.json` |
| MCP config | `.mcp.json` |
| Capabilities | All: headless, structured output, hooks, session resume, permissions |

**Models**: default, opus, sonnet, haiku

**Hook format**: Writes to `.claude/settings.local.json` with hook URLs pointing to Clubhouse's HTTP hook server.

**Tool verbs** (for status display):
| Tool | Verb |
|------|------|
| Bash | Running command |
| Read | Reading file |
| Edit | Editing file |
| Write | Writing file |
| Glob | Searching files |
| Grep | Searching code |
| Task | Running subtask |
| WebSearch | Searching web |
| WebFetch | Fetching URL |
| EnterPlanMode | Planning |
| ExitPlanMode | Finalizing plan |

**Headless mode**: `claude -p '{mission}' --output-format stream-json --verbose --dangerously-skip-permissions`

### GitHub Copilot CLI (`copilot-cli`)

| Property | Value |
|----------|-------|
| Binary | `github-copilot-cli` / `ghcp` (discovered via PATH) |
| Config dir | `.github` |
| Instructions | `.github/copilot-instructions.md` |
| Hook config | `.github/hooks/hooks.json` |
| MCP config | `.github/mcp.json` |
| Capabilities | Headless, hooks, session resume, permissions (no structured output) |

**Tool verbs**: `shell`, `read`, `edit`, `search`, `agent` (lowercase)

**Permission mode**: `--allow-all` / `--yolo` (not `--allow-all-tools`)

**Hook format**:
```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [{ "bash": "...", "timeoutSec": 30 }]
  }
}
```

### OpenCode (`opencode`)

| Property | Value |
|----------|-------|
| Binary | `opencode` (discovered via PATH) |
| Config dir | `.opencode` |
| Instructions | `.opencode/instructions.md` |
| Config file | `opencode.json` |
| Capabilities | Headless, session resume (no hooks, no structured output, no permissions) |

**Headless mode**: `opencode run --format json --model {provider/model}`

**Tool verbs**: `bash`, `edit`, `write`, `read`, `glob`, `grep` (lowercase)

## Adding a New Provider

To add support for a new CLI agent:

1. Create `src/main/orchestrators/{name}-provider.ts` implementing `OrchestratorProvider`
2. Register it in `registry.ts` → `registerBuiltinProviders()`
3. Add the provider ID to the `OrchestratorId` union type in `src/shared/types.ts`
4. Add color mapping in `src/renderer/features/agents/orchestrator-colors.ts`

At minimum, you need to implement:
- `checkAvailability()` — verify the CLI binary exists
- `buildSpawnCommand()` — generate the CLI invocation
- `getExitCommand()` — the text to send to gracefully exit (e.g. `/exit\r`)
- `conventions` — file paths for the CLI's config/instructions

## Orchestrator Settings

Users can enable/disable orchestrators in the Settings → Orchestrators page. Settings are persisted to:

```
~/Library/Application Support/Clubhouse/orchestrator-settings.json
```

The renderer manages this via `orchestratorStore.ts`, which tracks:
- `enabled` — Array of enabled orchestrator IDs
- `allOrchestrators` — Full list with display info and capabilities
- `availability` — Per-provider availability check results

The store prevents disabling all orchestrators (at least one must remain enabled).
