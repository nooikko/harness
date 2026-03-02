# Auto-Namer Plugin — Developer Notes

## Overview

Single-hook plugin. Implements `onMessage`. Read `src/index.ts` and `src/_helpers/generate-thread-name.ts` before editing.

---

## Guard ordering matters

The guards in `onMessage` run in this order:

1. Skip if `role !== 'user'` — avoids running on assistant messages (which also fire `onMessage`)
2. Skip if `thread.name` is set and not `"New Chat"` — avoids overwriting user-set names
3. Skip if user message count is not exactly 1 — ensures only the first message triggers naming

The count check is last because it requires a DB query. The cheaper guards run first.

---

## Count check vs. name check

The count check (`count !== 1`) is the authoritative guard. The name check is a secondary convenience — if the name is already set to something meaningful, skip the DB count query entirely. If the name is null or `"New Chat"`, we still need to count to confirm this is actually the first message (the name could be null on a thread that was manually cleared, not a new thread).

---

## Parallel execution

`onMessage` fires at pipeline step 1 — before `invoker.invoke()` at step 4. The `void generateNameInBackground(...)` call dispatches immediately and runs concurrently with:
- `onBeforeInvoke` hooks (context injection, time injection)
- `invoker.invoke()` itself (Claude processing the actual message)

The title generation typically takes 1-3 seconds with Haiku. The main response typically takes 3-10 seconds. In most cases the name is ready before the response lands.

---

## Broadcast event

On success, the plugin broadcasts:
```typescript
ctx.broadcast('thread:name-updated', { threadId, name });
```

The web frontend has a `ThreadNameRefresher` client component that subscribes to this event via `useWs('thread:name-updated')` and calls `router.refresh()`. This re-renders the server-side sidebar with the new name without a full page reload.

---

## What if generation fails?

Errors in `generateNameInBackground` are caught and logged at `warn` level. The thread retains its null/`"New Chat"` name. The failure is silent to the user. There is no retry mechanism — the next invocation won't retrigger because `count !== 1`.

If names are not appearing, check:
1. Whether `onMessage` is being called (look for pipeline step logs)
2. Whether `generateThreadName` is throwing (check for `'auto-namer: failed'` warn logs)
3. Whether `thread:name-updated` is being broadcast (check WebSocket traffic)

---

## Model

`generate-thread-name.ts` hardcodes `claude-haiku-4-5-20251001`. Title generation is a trivial task — Haiku is appropriate and cost-effective. Do not escalate to Sonnet or Opus.
