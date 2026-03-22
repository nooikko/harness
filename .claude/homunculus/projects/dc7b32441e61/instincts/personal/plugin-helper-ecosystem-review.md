---
id: plugin-helper-ecosystem-review
trigger: when understanding how a plugin system works or implementing plugin features
confidence: 0.7
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Helper Ecosystem Review

## Action
When examining a plugin system, always read the main plugin file (`src/index.ts`) first to understand the overall structure and tool/hook definitions, then systematically read its helper modules (`src/_helpers/`) to understand specific implementation concerns (memory management, delegation, scope classification, etc.).

## Evidence
- Observed 7+ times across sessions 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1 and 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern instances:
  1. identity plugin: read index.ts, then retrieve-memories.ts, score-and-write-memory.ts, check-reflection-trigger.ts, load-agent.ts
  2. delegation plugin: read index.ts, then setup-delegation-task.ts, handle-checkin.ts
  3. context plugin: read index.ts, then load-file-references.ts
  4. plugin-contract framework: read run-hook.ts, run-chain-hook.ts, run-notify-hooks.ts, run-chain-hooks.ts (4 separate instances)
- Each plugin has main contract (tools, hooks) in index.ts and implementation details in _helpers/
- Contract framework helpers (hook runners, utilities) are foundational and consistently examined before implementation
- Last observed: 2026-03-17T01:35:45Z

## Why
Plugins in this harness architecture separate concerns: the main plugin file defines the public API (tools, hooks, settings), while _helpers/ implement the actual logic. Understanding only the main file leaves gaps in how tools are handled. Understanding only a single helper leaves the overall purpose unclear. Reading both together reveals complete implementation and prevents implementation gaps or misunderstandings of plugin responsibilities.
