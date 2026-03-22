---
id: plugin-entry-then-helpers-exploration
trigger: when exploring a plugin's implementation
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Entry-Then-Helpers Exploration

## Action
When exploring a plugin's codebase, read the plugin's main entry file (src/index.ts) first, then systematically read the helper files it imports, following the dependency chain.

## Evidence
- Observed 3 times in March 14, 2026 session (55ffe247)
- Pattern: Context plugin reads (index.ts → history-loader.ts → load-file-references.ts → format-file-references.ts)
- Pattern: Delegation plugin reads (index.ts → setup-delegation-task.ts → delegation-loop.ts → send-thread-notification.ts)
- Pattern: Identity plugin multiple sequential helper reads
- Last observed: 2026-03-14T06:18:39Z

## Why
Starting with the plugin entry establishes the public API and hook contracts. Reading helpers in order of import reveals the dependency graph and implementation details. This breadth-first approach gives a complete understanding of how the plugin works.

## When to Use
- Onboarding to a plugin's architecture
- Investigating how a plugin integrates with orchestrator
- Understanding plugin hook implementation
- Reviewing plugin changes before modification
