# S7 — `onStartFailed()` Recovery Hook — Implementation Plan

**Date:** 2026-03-27
**Parent:** `AI_RESEARCH/plans/0326-plugin-contract-hardening.md` (S7)
**Status:** Ready for implementation
**Adversarial review:** 3 rounds, 3 agents, 9 validated findings incorporated

---

## Problem

When a plugin's `start()` throws, the orchestrator logs the error and marks the plugin `'failed'` — but the plugin's hooks remain registered and continue firing against uninitialized state. There is no recovery mechanism. The plugin is permanently degraded until a full process restart.

**Bugs this fixes:**
- F-03: notifications permanently disabled when DB unavailable at startup
- Any plugin that fails `start()` due to transient infrastructure (Docker not up, external API down, etc.)

---

## Design

### New Type

```typescript
// On PluginDefinition (packages/plugin-contract/src/index.ts):
export type OnStartFailedFn = (ctx: PluginContext, error: Error) => Promise<void>;

// Added to PluginDefinition:
/** Called when start() throws. The plugin can fall back to defaults, schedule
 *  its own retry, or report degraded status. If this hook succeeds, the plugin
 *  is marked 'degraded' (hooks remain active). If this hook also throws, the
 *  plugin is marked 'failed'. Hooks are active in both cases (registered before
 *  start). Note: ctx.broadcast() may not reach WebSocket clients if the web
 *  plugin has not yet started (plugins start sequentially). */
onStartFailed?: OnStartFailedFn;
```

### Semantics

```
start() throws →
  1. Log the original error (deps.logger.error)          ← always, before anything else
  2. Fire-and-forget writeErrorToDb for original error    ← always
  3. Coerce error: unknown → Error instance               ← always
  4. Does onStartFailed exist on this plugin?
     YES → try { await onStartFailed(ctx, coercedError) }
       succeeds → pluginHealth: 'degraded', statusRegistry: 'degraded'
       throws   → log recovery error
                  fire-and-forget writeErrorToDb for recovery error
                  pluginHealth: 'failed', statusRegistry: 'error'
     NO  → pluginHealth: 'failed', statusRegistry: 'error'    ← unchanged from today
  5. Continue to next plugin (loop never aborts)
```

---

## Implementation

### Phase 1: Contract Type

**File:** `packages/plugin-contract/src/index.ts`

Add after `StopFn` (line 322):

```typescript
export type OnStartFailedFn = (ctx: PluginContext, error: Error) => Promise<void>;
```

Add to `PluginDefinition` (after `stop?`):

```typescript
onStartFailed?: OnStartFailedFn;
```

**Risk:** Zero. Additive optional field. No existing plugin defines it.

### Phase 2: Orchestrator Start Loop

**File:** `apps/orchestrator/src/orchestrator/index.ts`

Replace the catch block inside `start()` (currently lines 631–643) with:

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  deps.logger.error(`Plugin start failed [plugin=${plugin.definition.name}]: ${message}`);
  writeErrorToDb({
    db: deps.db,
    level: 'error',
    source: plugin.definition.name,
    message: `Plugin start failed: ${message}`,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Coerce unknown catch binding to Error for the hook signature
  const coercedError = error instanceof Error ? error : new Error(String(error));

  if (plugin.definition.onStartFailed) {
    try {
      await plugin.definition.onStartFailed(plugin.ctx, coercedError);
      // Recovery succeeded — plugin is degraded but functional
      pluginHealth.push({ name: plugin.definition.name, status: 'degraded', error: message });
      statusRegistry.report(plugin.definition.name, 'degraded', `Start failed (recovered): ${message}`);
    } catch (recoveryError) {
      // Recovery also failed — plugin is truly failed
      const recoveryMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      deps.logger.error(
        `Plugin onStartFailed also failed [plugin=${plugin.definition.name}]: ${recoveryMessage}`,
      );
      writeErrorToDb({
        db: deps.db,
        level: 'error',
        source: plugin.definition.name,
        message: `Plugin onStartFailed failed: ${recoveryMessage}`,
        stack: recoveryError instanceof Error ? recoveryError.stack : undefined,
      });
      pluginHealth.push({ name: plugin.definition.name, status: 'failed', error: message });
      statusRegistry.report(plugin.definition.name, 'error', `Start failed: ${message}`);
    }
  } else {
    // No recovery hook — current behavior unchanged
    pluginHealth.push({ name: plugin.definition.name, status: 'failed', error: message });
    statusRegistry.report(plugin.definition.name, 'error', `Start failed: ${message}`);
  }
}
```

**Key design decisions from adversarial review:**

1. **Nested try/catch** — `onStartFailed` is wrapped in its own try/catch inside the existing catch block. Without this, a throwing `onStartFailed` escapes the outer catch and aborts the for-loop, leaving all subsequent plugins unstarted. This was the highest-severity finding (3/3 validated).

2. **Error coercion** — `const coercedError = error instanceof Error ? error : new Error(String(error))` converts the `unknown` catch binding to `Error` before passing to `onStartFailed`. TypeScript catch bindings are `unknown`; passing raw `unknown` where `Error` is expected is a type error.

3. **Dual-store writes** — Both `pluginHealth.push(...)` and `statusRegistry.report(...)` are updated on every branch. These are independent stores read by `getPluginHealth()` and `getPluginStatuses()` respectively. If only one is updated, the two APIs disagree.

4. **Conditional branching** — `'degraded'` only when `onStartFailed` is defined AND succeeds. Plugins without `onStartFailed` produce `'failed'`/`'error'` exactly as today. This preserves existing test assertions at lines 349 and 364.

5. **Log before recovery** — `deps.logger.error` and `writeErrorToDb` fire before `onStartFailed` is called. The original failure is always recorded regardless of recovery outcome.

6. **Secondary writeErrorToDb** — The inner catch for `onStartFailed` fires its own `writeErrorToDb` so the recovery failure appears in `/admin/errors`, not just logs.

### Phase 3: Tests

**File:** `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

New `describe('start - onStartFailed recovery')` block with these test cases:

```
1. onStartFailed called with (ctx, Error) when start() throws
   - Register plugin with start that rejects + onStartFailed that resolves
   - Assert onStartFailed was called once
   - Assert first arg is a PluginContext, second arg is an Error with correct message

2. Plugin marked 'degraded' in pluginHealth when onStartFailed succeeds
   - Register plugin with failing start + succeeding onStartFailed
   - orchestrator.start()
   - getPluginHealth() → [{ status: 'degraded', error: '...' }]

3. Plugin marked 'degraded' in statusRegistry when onStartFailed succeeds
   - Same setup as #2
   - getPluginStatuses() → [{ status: 'degraded', message: 'Start failed (recovered): ...' }]

4. Plugin marked 'failed' when onStartFailed also throws
   - Register plugin with failing start + failing onStartFailed
   - orchestrator.start()
   - getPluginHealth() → [{ status: 'failed', error: '...' }]
   - Both errors logged (deps.logger.error called twice)

5. Subsequent plugins still start after onStartFailed throws (loop isolation)
   - Register: plugin-a (failing start + failing onStartFailed), plugin-b (succeeding start)
   - orchestrator.start()
   - getPluginHealth() → [{ name: 'plugin-a', status: 'failed' }, { name: 'plugin-b', status: 'healthy' }]

6. Plugin without onStartFailed still produces 'failed' (regression guard)
   - Register plugin with failing start, no onStartFailed
   - getPluginHealth() → [{ status: 'failed' }]
   - (This test already exists at line 340, but an explicit regression guard is warranted)

7. Non-Error rejection coerced to Error before passing to onStartFailed
   - Register plugin with start that rejects with a string (not an Error)
   - onStartFailed receives an Error instance with the string as message

8. Both stores agree after each branch
   - For degraded: getPluginHealth()[0].status === 'degraded' AND getPluginStatuses()[0].status === 'degraded'
   - For failed: getPluginHealth()[0].status === 'failed' AND getPluginStatuses()[0].status === 'error'
   - (Note: 'failed' in pluginHealth maps to 'error' in statusRegistry — this is pre-existing and intentional)
```

---

## Files Changed

| File | Change | Lines |
|---|---|---|
| `packages/plugin-contract/src/index.ts` | Add `OnStartFailedFn` type + `onStartFailed` to `PluginDefinition` | ~5 |
| `apps/orchestrator/src/orchestrator/index.ts` | Replace catch block in `start()` | ~25 |
| `apps/orchestrator/src/orchestrator/__tests__/index.test.ts` | 8 new test cases | ~160 |

**Total:** ~190 lines across 3 files. No plugin changes needed.

---

## Pre-Existing Issues Noted (not fixed by S7)

These were identified during review and are documented for awareness. They are not in scope.

1. **`getPluginStatuses()` omits `error` field** — The `statusRegistry` stores error info in `message`, while `pluginHealth` uses a separate `error` field. Different API shapes for the same data. Pre-existing.

2. **`PluginStatusLevel` type divergence** — `PluginStatusLevel` is `'healthy' | 'degraded' | 'error'`. `PluginHealth.status` adds `'failed' | 'disabled'`. The mapping `'failed'` → `'error'` between the two stores is intentional but undocumented.

3. **Broadcast during partial start** — `statusRegistry.report()` fires broadcasts immediately via `plugin:status-changed`. If an early plugin fails before the web plugin has started, the broadcast reaches no WebSocket clients. Pre-existing, amplified by S7 (more status changes during start). Plugins implementing `onStartFailed` should not assume `ctx.broadcast()` reaches the browser.

---

## What This Does NOT Do

- Does not add retry logic to the orchestrator (plugins own their retry strategy)
- Does not change hook behavior for failed/degraded plugins (hooks still fire)
- Does not modify any existing plugin (plugins adopt `onStartFailed` individually)
- Does not add timeouts to `onStartFailed` (S3 hook timeouts are separate)
- Does not fix the `getPluginStatuses()` missing `error` field (pre-existing)
- Does not align `PluginStatusLevel` with `PluginHealth.status` (pre-existing)

---

## Adversarial Review Findings (incorporated)

All findings below were validated 3/3 by independent reviewers reading source code.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | CRITICAL | Dual-store divergence (`pluginHealth` vs `statusRegistry`) | Both stores updated on every branch |
| 2 | HIGH | `onStartFailed` throw breaks for-loop | Nested try/catch around `onStartFailed` |
| 3 | HIGH | `unknown` catch binding needs Error coercion | `coercedError` constructed before hook call |
| 4 | HIGH | Existing tests assert `'failed'` | Conditional: `'degraded'` only when hook defined AND succeeds |
| 5 | MEDIUM | `getPluginStatuses()` omits `error` field | Documented as pre-existing, not in scope |
| 6 | MEDIUM | Zero test coverage for `'degraded'` branch | 8 test cases specified |
| 7 | LOW | `PluginStatusLevel` type mismatch | Documented as pre-existing, not in scope |
| 8 | LOW | Broadcast before web plugin starts | Documented in JSDoc on `onStartFailed` |
| 9 | LOW | Secondary `writeErrorToDb` for recovery error | Added to inner catch block |
