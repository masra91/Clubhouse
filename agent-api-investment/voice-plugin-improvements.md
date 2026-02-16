# Voice Plugin Improvements

## 1. Route through Orchestrator Provider

Voice currently spawns Claude directly via its own `findClaudeBinary()` + `child_process.spawn()` in `src/main/services/voice/voice-session.ts`. This bypasses the orchestrator system entirely — no provider abstraction, no hook normalization, no settings mapping.

**Goal**: Voice should call `AgentSystemService` or the provider's `buildHeadlessCommand()` to get the spawn args, then run the process itself (it still needs direct control over stdout parsing for sentence-level TTS streaming). This means voice automatically gets model options, allowed tools, system prompts, and future provider features without duplicating logic.

## 2. Move models + voice services into the plugin

The STT/TTS services currently live in `src/main/services/voice/` (main process), with IPC handlers in `src/main/ipc/voice-handlers.ts`. These are tightly coupled to the voice plugin but are baked into the core app — every user pays the code/startup cost whether or not they use voice.

**Goal**: Move `stt-service.ts`, `tts-service.ts`, `model-manager.ts`, and `voice-session.ts` into the plugin directory (`src/renderer/plugins/builtin/voice-chat/`). The plugin would register its own IPC handlers on activation (plugin API already supports this pattern via `onMainProcess` hooks) and manage model downloads internally. Core app should have zero voice-specific code.

## 3. Make voice the first community plugin

Voice chat is a great candidate for the first community/external plugin — it's self-contained, has clear permissions, and demonstrates advanced plugin API usage (voice, agents, widgets, notifications).

**Goal**: Extract the voice plugin into its own repository (e.g. `clubhouse-voice-plugin`) that can be installed via the plugin manager. This requires:
- Plugin distribution format (zip/tarball with manifest)
- Plugin install/update/remove flow in the plugin manager UI
- Plugin sandboxing for native addons (whisper .node binary)
- Documentation showing how to build a plugin with native dependencies
- The voice plugin serves as both a real feature and a reference implementation for community plugin authors
