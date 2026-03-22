---
id: observability-logging-contextual-metadata
trigger: when implementing async/external operations like DB calls, API requests, session lifecycle, or pipeline steps
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Observability Logging with Contextual Metadata

## Action
Add structured logging with contextual metadata at key points in async/external operations. Include request identifiers (threadId, sessionId, projectId), operation metrics (duration, tokens, model), and state transitions.

## Evidence
- Observed 4+ times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1 and e85766d3-0f24-4ba0-9778-81c586e96bb1
- Pattern in orchestrator/index.ts: logs model, promptLength, sessionId, durationMs, inputTokens, outputTokens with structured metadata for each pipeline step
- Pattern in context plugin (packages/plugins/context/src/index.ts): logs threadId, sessionId, projectId, DB operations with info/warn levels
- Pattern in create-session.ts: implicit lifecycle logging through queue and session state tracking
- Pattern in session-pool.ts: TTL eviction and capacity management with implicit state observation
- Last observed: 2026-03-17T03:02:47Z

## Why This Matters
- Enables request tracing across distributed operations (threadId, sessionId)
- Provides performance visibility (duration, token counts, model selection)
- Helps diagnose failures with full operation context
- Allows monitoring of resource usage (session lifecycle, eviction patterns)

## Implementation Pattern
Log at operation boundaries with structured metadata:
```typescript
// Good: Pipeline step with full context
log.info(`Pipeline: invoking Claude [promptLength=${prompt.length}, model=${model ?? 'default'}, sessionId=${sessionId ?? 'none'}]`);
const invokeResult = await deps.invoker.invoke(...);
log.info(`Pipeline: invoke complete [duration=${invokeResult.durationMs}ms, outputLength=${invokeResult.output.length}, model=${invokeResult.model}, sessionId=${invokeResult.sessionId}]`);

// Good: DB operation with request context
ctx.logger.warn(`Context plugin: DB unavailable [thread=${threadId}], skipping history`);

// Good: Resource lifecycle
// Log eviction, capacity checks, session TTL events
```

## Related
- `unlogged-promise-catch-blocks`: Covers error-time logging
- `error-message-sanitization-no-leakage`: Covers user-facing messages
