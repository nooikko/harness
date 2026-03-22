---
id: plugin-hook-error-isolation
trigger: when implementing plugin hooks that could throw errors
confidence: 0.65
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Hook Error Isolation

## Action
Wrap plugin hook implementations in try-catch blocks. Log errors and continue execution—a faulty plugin hook should not crash the entire pipeline.

## Evidence
- Observed 3 times: `run-chain-hook.ts`, `activity/index.ts` onPipelineStart, `activity/index.ts` onPipelineComplete
- Pattern: Error caught, logged, value returned unchanged (for chain hooks) or execution continues (for notify hooks)
- Test C validates this: "faulty plugin doesn't crash pipeline"
- Last observed: 2026-03-14T03:54:22Z

## Details
Error isolation ensures resilience:
- Chain hooks (onBeforeInvoke) catch per-hook errors, log them, and return the current prompt unchanged
- Notify hooks (onPipelineStart, onPipelineComplete) wrap their entire logic in try-catch
- Errors are logged but never re-thrown
- Pipeline continues with remaining plugins

This is implemented by `runChainHook` utility in `plugin-contract` and should be followed by all plugins that register hooks.
