---
id: helper-function-diagnostic-context-propagation
trigger: when modifying error handling in _helpers functions or enhancing hook infrastructure diagnostics
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Helper Function Diagnostic Context Propagation

## Action
When adding error handling to helper functions, add optional parameters for logging and identification (logger, plugin names) so errors can be logged with full context. Update all call sites to provide this context.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051:
  1. youtube-music-auth.ts: added optional `log` parameter to `getAccountInfo`, used in catch block for error logging
  2. run-chain-hooks.ts: added optional `names` parameter to propagate plugin identifiers through hook execution chain
  3. oauth-routes.ts: updated call site to pass `ctx.logger` when invoking `getAccountInfo`
- Pattern: optional context parameter → used in error handler → call sites updated to provide context
- Last observed: 2026-03-17T01:37:52Z

## Why This Matters
Helper functions in error paths need diagnostic context to produce actionable logs:
- Errors without logger context can't easily track which operation failed
- Errors without plugin name context hide which plugin caused issues in hook chains
- Unaggregated errors make debugging and monitoring harder

## Pattern
When adding error handling to `_helpers` functions:
1. Add optional parameter(s) for context: `log?: Logger` or `names?: string[]`
2. Use these in error handlers: `log?.warn('operation failed', { error })` or `names?.[i]`
3. Update all call sites to pass available context from their scope (`ctx.logger`, plugin registry, etc.)
