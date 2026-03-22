---
id: broadcast-async-plugin-events
trigger: when plugins need to notify other plugins of state changes or completion events
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Broadcast Async Plugin Events

## Action
Use `ctx.broadcast()` to emit state-change events between plugins asynchronously, allowing decoupled inter-plugin communication without direct dependencies.

## Evidence
- Observed 3+ times in session observations
- Pattern: Plugins use broadcast for completion/state notifications
  - `delegation-loop.ts`: Broadcasts task stream events via `ctx.broadcast('task:stream', {...})`
  - `audit/index.ts`: Broadcasts `thread:deleted` event after successful audit extraction
  - `audit/index.ts`: Broadcasts `audit:failed` event on error
- Last observed: 2026-03-14 delegation and audit plugin implementations

## Context
The plugin architecture uses broadcast for fire-and-forget notifications. This allows:
- Activity logging plugin to observe state changes without tight coupling
- Multiple listeners to react to the same event
- Background operations to signal completion without blocking

Events are typically prefixed with namespace (e.g., `thread:deleted`, `task:stream`, `audit:failed`).

## Implementation Pattern
```
ctx.broadcast('namespace:event', {
  id: identifier,
  status: 'completed'|'failed',
  // ... event-specific payload
})
```

**Key**: Use `.catch(() => {})` when broadcasting doesn't require confirmation (fire-and-forget semantic).
