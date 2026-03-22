---
id: plugin-chain-hook-prompt-transformation
trigger: when implementing plugin onBeforeInvoke hooks that transform the prompt
confidence: 0.75
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Chain Hook Pattern for Sequential Prompt Transformation

## Action
Use `runChainHook` utility to run onBeforeInvoke hooks sequentially, threading the prompt through each plugin's transformation with error isolation.

## Evidence
- Observed 7 times across plugin implementations and tests (time, context, identity, activity plugins)
- Pattern: `runChainHook(allHooks, 'onBeforeInvoke', prompt, (hooks, currentPrompt) => hooks.onBeforeInvoke?.(threadId, currentPrompt), logger)`
- Error isolation: hooks that throw don't crash pipeline, logged and skipped
- Test B validates ordering: identity header → context history → time injection
- Last observed: 2026-03-14T03:56:40Z

## Details
The pattern uses a canonical hook runner at `packages/plugin-contract/src/_helpers/run-chain-hook.ts` that:
1. Iterates through plugins in registration order
2. Threads the current prompt value through each hook
3. Catches errors per-hook, logs them, and continues with unmodified value
4. Returns final transformed prompt

Used by:
- `apps/orchestrator/src/orchestrator/_helpers/run-chain-hooks.ts` wrapper
- Time plugin: replaces `/current-time` command with current timestamp
- Context plugin: injects prior message history
- Identity plugin: injects agent soul and identity headers

When plugin registration order matters (which it does for prompt precedence), document the expected order in test comments.
