# S3 — Hook Runner Timeouts

**Date:** 2026-03-26
**Status:** Ready for implementation
**Revision:** 5 — validated through 2-round adversarial review (3 independent agents, Round 0 independent + Round 1 cross-review with source code verification)

**Validation summary:** 3 agents independently reviewed this plan across 2 rounds. Round 0 surfaced 6-8 findings per agent. Round 1 cross-review drove convergence: all previously disputed findings (env.ts zod schema, closure `names` param, wrapper type signatures, cron lock contention) reached 3/3 agreement. Four findings were rejected with counter-evidence (plugin count, catch contradiction, test files missing, return type). No blocking defects remain.

---

## Problem Statement

Plugin hooks run sequentially with no timeout. One slow plugin blocks every subsequent plugin AND the pipeline. Confirmed bugs:
- notifications `onBroadcast` blocks entire broadcast chain for up to 100s (TTS + Cast playback)
- storytelling `onAfterInvoke` blocks pipeline for 10-60s during extraction

## Design Principles

1. **Per-hook-type timeouts** — different hooks have different performance profiles. A single timeout for all notify hooks is too coarse.
2. **Zombie promise handling** — timed-out promises continue running. Their rejections must be caught, not left as unhandled rejections.
3. **Lock-aware timeout** — hooks that hold Promise-based locks (cron, delegation `onSettingsChange`) are safe because the lock is a Promise chain — timeout doesn't "hold" the lock, the zombie resolves eventually and queued work proceeds. However, under rapid settings changes, lock contention can cause later calls to timeout before acquiring the lock (see Known Risks).
4. **Intent plugin exclusion** — the intent plugin calls `ctx.executeTool()` inside `onIntentClassify`. Timing out mid-tool-execution causes double-execution (tools fire AND Claude processes the message). Intent hooks are exempt from timeout until the plugin is restructured.
5. **Fire-and-forget hooks are invisible to timeouts** — many plugins (identity, auto-namer, search, summarization) use `void` fire-and-forget. The hook returns instantly; the timeout never fires. This is correct — those hooks don't block. The timeout targets hooks that `await` inline work.
6. **Chain hook timeout = degraded prompt, not abort** — if identity times out on onBeforeInvoke, the prompt goes to Claude without soul/memories. This is degraded but functional. Aborting would give the user nothing. Error-level logging + status broadcast makes degradation visible.
7. **Delegation task hooks are out of scope** — `onTaskCreate`, `onTaskComplete`, and `onTaskFailed` fire from inside the delegation plugin, not from the orchestrator. They use either `runHook` directly or a custom runner (`fireTaskCompleteHooks`). Adding timeouts to these hooks requires delegation plugin changes, which is a separate work item.

---

## Timeout Values

| Hook Type | Default | Rationale |
|-----------|---------|-----------|
| `onMessage` | 5_000ms | Auto-namer fires-and-forgets. Storytelling OOC parses cache. Should be fast. |
| `onBeforeInvoke` | 2_000ms | Identity: 2 DB queries + JS scoring (<100ms typical). Context: file reads + history (<300ms typical). Time: synchronous. 2s is generous for reads. |
| `onAfterInvoke` | 5_000ms | Most are fire-and-forget (return instantly). Metrics is one batch write. Catches the storytelling bug (ST-01). |
| `onBroadcast` | 10_000ms | Web plugin is synchronous. Discord needs HTTP round-trip. Catches notifications bug (F-02). |
| `onPipelineStart` | 5_000ms | Activity plugin writes one status record. |
| `onPipelineComplete` | 15_000ms | Activity plugin writes transaction with multiple records. Varies by pipeline complexity. |
| `onSettingsChange` | 30_000ms | Cron rebuilds scheduler, Discord reconnects, Calendar re-syncs. Legitimately slow, infrequent. |
| `onIntentClassify` | undefined | **NO TIMEOUT** — double-execution risk until intent plugin is restructured. |

`onTaskCreate`, `onTaskComplete`, and `onTaskFailed` are **not covered** by this plan (see Design Principle 7).

All configurable via environment variables: `HOOK_TIMEOUT_ON_BROADCAST=10000` (uppercase hook name, milliseconds).

---

## Blocking Issue: Intent Plugin Double-Execution

The intent plugin's `onIntentClassify` calls `ctx.executeTool()` inside the hook. If a timeout fires during tool execution:

1. Tools are already executing (lights turning on, music playing)
2. Hook returns `{handled: false}` due to timeout
3. Pipeline falls through to normal LLM processing
4. Claude ALSO processes the message and may call the same tools
5. **Actions happen twice** — lights toggle twice (cancel out), music queues duplicate

**Decision:** `onIntentClassify` gets NO timeout (`undefined`) until the intent plugin is restructured to separate classification from execution.

**Future fix (separate PR):** Restructure intent plugin so classification happens inside the hook, tool execution happens AFTER the hook returns `{handled: true}`. Timeout can then safely fire during the classification phase only.

---

## Delegation Task Hooks — Out of Scope

The adversarial review (3/3 validated) confirmed that `onTaskCreate`, `onTaskFailed`, and `onTaskComplete` do NOT fire from the orchestrator:

- **`onTaskCreate`** — called via `runHook` directly in `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts` (line ~80). No access to `OrchestratorConfig`.
- **`onTaskFailed`** — called via `runHook` directly in `packages/plugins/delegation/src/_helpers/delegation-loop.ts` (line ~333). Same problem.
- **`onTaskComplete`** — uses a custom hand-rolled runner in `packages/plugins/delegation/src/_helpers/fire-task-complete-hooks.ts`. This is NOT `runHook` — it has its own for-loop with rejection semantics (`{accepted: false, feedback}`). Modifying `run-hook.ts` has zero effect on it.

Adding timeouts to these hooks requires modifying delegation plugin files. This is a separate work item that should be done after the core timeout infrastructure is in place. The delegation plugin can then import `withTimeout` from `@harness/plugin-contract` and wrap its own runner calls.

---

## Implementation

### Phase 1: Timeout Utility

**New file:** `packages/plugin-contract/src/_helpers/with-timeout.ts`

- `withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T>`
- Uses `Promise.race` between the hook promise and a rejection timer
- On timeout: rejects with `HookTimeoutError` (custom Error with `pluginName`, `hookName`, `timeoutMs`, `elapsed` fields)
- **After race settles via timeout:** attaches `.catch(() => {})` to the original promise to suppress unhandled rejection from zombie
- Clears timeout timer on normal resolution (prevent timer leak)
- Export `HookTimeoutError` from the package — runners and downstream consumers need `instanceof` checks to distinguish timeouts from plugin errors

**New file:** `packages/plugin-contract/src/_helpers/__tests__/with-timeout.test.ts`

Test cases:
- Hook resolves before timeout → returns result, timer cleared
- Hook exceeds timeout → rejects with HookTimeoutError containing correct metadata
- Zombie promise rejects after timeout → no unhandled rejection (`.catch` attached)
- Zombie promise resolves after timeout → no side effects

### Phase 2: Runner Modifications

**Modified: `packages/plugin-contract/src/_helpers/run-hook.ts`**

- Add optional `timeoutMs?: number` as last parameter (position 7, after `names?` at position 6 — trailing, backward compatible)
- Import `withTimeout` and `HookTimeoutError` from `./with-timeout`
- When `timeoutMs` is provided and hook returns a promise, wrap with `withTimeout(result, timeoutMs, pluginLabel)`
- **Modify the existing catch block** to detect `HookTimeoutError` via `instanceof`:
  - On `HookTimeoutError`: log at `warn` level with structured fields `{ plugin, hook, timeoutMs, elapsed }`
  - On other errors: existing `error` level logging unchanged
- When `timeoutMs` is `undefined`: no wrapping, current behavior preserved

**Modified: `packages/plugin-contract/src/_helpers/run-chain-hook.ts`**

- Add optional `timeoutMs?: number` as last parameter (position 7, after `names?`)
- On timeout: preserve previous `value` (same as current error behavior)
- **Log at `error` level** — chain timeouts affect prompt correctness
- Continue chain with pre-timeout value

**Modified: `packages/plugin-contract/src/_helpers/run-early-return-hook.ts`**

- Same optional `timeoutMs` parameter
- On timeout: skip plugin, continue to next
- Log at `warn` level

### Phase 3: Orchestrator Wiring

**Modified: `packages/plugin-contract/src/index.ts`**

Add `hookTimeouts` to `OrchestratorConfig`:

```typescript
hookTimeouts?: {
  onMessage?: number;
  onBeforeInvoke?: number;
  onAfterInvoke?: number;
  onBroadcast?: number;
  onPipelineStart?: number;
  onPipelineComplete?: number;
  onSettingsChange?: number;
  onIntentClassify?: number;
};
```

Note: `onTaskCreate`, `onTaskComplete`, `onTaskFailed` are intentionally absent — they fire from the delegation plugin, not the orchestrator.

Export `HookTimeoutError` for downstream `instanceof` checks.

**Modified: `apps/orchestrator/src/env.ts`**

Add `HOOK_TIMEOUT_*` fields to the zod `envSchema`. Without this, env var overrides are silently dropped by zod's strict parsing and never reach `config.ts`. Fields:
- `HOOK_TIMEOUT_ON_MESSAGE` (optional number)
- `HOOK_TIMEOUT_ON_BEFORE_INVOKE` (optional number)
- `HOOK_TIMEOUT_ON_AFTER_INVOKE` (optional number)
- `HOOK_TIMEOUT_ON_BROADCAST` (optional number)
- `HOOK_TIMEOUT_ON_PIPELINE_START` (optional number)
- `HOOK_TIMEOUT_ON_PIPELINE_COMPLETE` (optional number)
- `HOOK_TIMEOUT_ON_SETTINGS_CHANGE` (optional number)
- `HOOK_TIMEOUT_ON_INTENT_CLASSIFY` (optional number)

**Modified: `apps/orchestrator/src/config.ts`**

Read parsed `HOOK_TIMEOUT_*` env vars from `loadEnv()`, fall back to defaults from the timeout table above. Build the `hookTimeouts` object on `OrchestratorConfig`.

**Modified: `apps/orchestrator/src/orchestrator/_helpers/run-notify-hooks.ts`**

Update `RunNotifyHooks` type definition to accept `timeoutMs?: number`. Forward it to the underlying `runHook` call.

**Modified: `apps/orchestrator/src/orchestrator/_helpers/run-chain-hooks.ts`**

Update `RunChainHooks` type definition to accept `timeoutMs?: number`. Forward it to the underlying `runChainHook` call.

**Modified: `apps/orchestrator/src/orchestrator/index.ts`**

There are 8 hook call sites. Two kinds of wiring are needed:

**6 pipeline call sites** — pass `config.hookTimeouts?.[hookName]` as a parameter:
- `runNotifyHooks('onPipelineStart', ...)` → `config.hookTimeouts?.onPipelineStart`
- `runNotifyHooks('onMessage', ...)` → `config.hookTimeouts?.onMessage`
- `runChainHooks(...)` → `config.hookTimeouts?.onBeforeInvoke`
- `runEarlyReturnHook('onIntentClassify', ...)` → `config.hookTimeouts?.onIntentClassify` (will be `undefined`)
- `runNotifyHooks('onAfterInvoke', ...)` → `config.hookTimeouts?.onAfterInvoke`
- `runNotifyHooks('onPipelineComplete', ...)` → `config.hookTimeouts?.onPipelineComplete`

Note: `runEarlyReturnHook` is imported directly from `@harness/plugin-contract` — there is no orchestrator wrapper for it. The timeout parameter is passed directly.

**2 closure call sites** — these are closures on the `context` object, not parameterizable from outside. They must read timeout from the captured `deps.config` reference internally:

```typescript
broadcast: async (event: string, data: unknown) => {
  await runNotifyHooks(
    allHooks(), 'onBroadcast', (h) => h.onBroadcast?.(event, data),
    deps.logger, pluginNames(),
    deps.config.hookTimeouts?.onBroadcast  // ← read from captured config
  );
},
notifySettingsChange: async (pluginName: string) => {
  await runNotifyHooks(
    allHooks(), 'onSettingsChange', (h) => h.onSettingsChange?.(pluginName),
    deps.logger, pluginNames(),
    deps.config.hookTimeouts?.onSettingsChange  // ← read from captured config
  );
},
```

Note: these closures currently do NOT pass `names` (plugin names array). Adding `pluginNames()` here fixes the existing gap where error/timeout logs for `onBroadcast` and `onSettingsChange` have no plugin label. This was confirmed by 2/3 adversarial reviewers.

When `hookTimeouts` is not configured or a specific hook type is `undefined`: no timeout applied (backward compatible).

### Phase 4: Tests

**Modified: `packages/plugin-contract/src/_helpers/__tests__/run-hook.test.ts`**

- Hook exceeds timeout: killed, next hook runs, **warn** logged with structured fields
- Non-timeout error: still logged at **error** level (existing behavior preserved)
- Multiple hooks, middle one times out: first and third still run
- No `timeoutMs` param: no timeout (backward compat)
- All hooks under timeout: no warnings

**Modified: `packages/plugin-contract/src/_helpers/__tests__/run-chain-hook.test.ts`**

- Timeout preserves previous value, chain continues
- Next hook receives pre-timeout value
- Logged at error level
- Verify `timeoutMs` at position 7 doesn't break `names` at position 6

**Modified: `packages/plugin-contract/src/_helpers/__tests__/run-early-return-hook.test.ts`**

- Timed-out hook skipped, next hook can handle
- If only hook times out, returns `null`

**Modified: `apps/orchestrator/src/orchestrator/_helpers/__tests__/run-notify-hooks.test.ts`**

- Verify `RunNotifyHooks` type accepts `timeoutMs` and forwards it
- Verify backward compat when `timeoutMs` is omitted

**Modified: `apps/orchestrator/src/orchestrator/_helpers/__tests__/run-chain-hooks.test.ts`**

- Verify `RunChainHooks` type accepts `timeoutMs` and forwards it
- Verify backward compat when `timeoutMs` is omitted

**Testing approach:** Use `vi.useFakeTimers()`. Create hook mocks that return manually-controlled promises. Advance timers to trigger timeout. Do NOT use real delays.

---

## Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `packages/plugin-contract/src/_helpers/with-timeout.ts` | **New** | Timeout utility with zombie rejection catch |
| `packages/plugin-contract/src/_helpers/__tests__/with-timeout.test.ts` | **New** | Utility tests |
| `packages/plugin-contract/src/_helpers/run-hook.ts` | Modified | Add optional `timeoutMs` param, `instanceof` check in catch for warn vs error |
| `packages/plugin-contract/src/_helpers/run-chain-hook.ts` | Modified | Add optional `timeoutMs` param |
| `packages/plugin-contract/src/_helpers/run-early-return-hook.ts` | Modified | Add optional `timeoutMs` param |
| `packages/plugin-contract/src/_helpers/__tests__/run-hook.test.ts` | Modified | Timeout test cases |
| `packages/plugin-contract/src/_helpers/__tests__/run-chain-hook.test.ts` | Modified | Timeout test cases + names interaction |
| `packages/plugin-contract/src/_helpers/__tests__/run-early-return-hook.test.ts` | Modified | Timeout test cases |
| `packages/plugin-contract/src/index.ts` | Modified | `hookTimeouts` on OrchestratorConfig, export `HookTimeoutError` |
| `apps/orchestrator/src/env.ts` | Modified | Add `HOOK_TIMEOUT_*` fields to zod schema |
| `apps/orchestrator/src/config.ts` | Modified | Read parsed `HOOK_TIMEOUT_*` env vars, build hookTimeouts object |
| `apps/orchestrator/src/orchestrator/_helpers/run-notify-hooks.ts` | Modified | Update `RunNotifyHooks` type, forward `timeoutMs` |
| `apps/orchestrator/src/orchestrator/_helpers/run-chain-hooks.ts` | Modified | Update `RunChainHooks` type, forward `timeoutMs` |
| `apps/orchestrator/src/orchestrator/_helpers/__tests__/run-notify-hooks.test.ts` | Modified | Verify timeoutMs forwarding |
| `apps/orchestrator/src/orchestrator/_helpers/__tests__/run-chain-hooks.test.ts` | Modified | Verify timeoutMs forwarding |
| `apps/orchestrator/src/orchestrator/index.ts` | Modified | Pass per-hook-type timeouts at 6 pipeline call sites + 2 closure call sites, add `pluginNames()` to closure call sites |

**Plugin files not changed.** Delegation task hook timeouts are a separate work item.

---

## Follow-Up Work Items (separate PRs)

1. **Delegation task hook timeouts** — add `withTimeout` wrapping to `setup-delegation-task.ts`, `delegation-loop.ts`, and `fire-task-complete-hooks.ts`. The custom runner in `fire-task-complete-hooks.ts` needs special handling since it has rejection semantics (`{accepted: false}`) that differ from `runHook`.

2. **Intent plugin restructuring** — separate classification from tool execution so `onIntentClassify` can safely receive a timeout.

3. **Per-plugin timeout overrides** — can be added via `PluginDefinition.timeoutOverrides` if the per-hook-type granularity proves insufficient.

---

## Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Zombie hook writes DB records after pipeline:complete | Medium | Records arrive late but not lost. Activity ordering slightly off. Acceptable for v1. |
| Identity chain timeout = no soul/memories in prompt | Medium | 2s timeout is generous for DB reads. If identity takes 2s, DB is down. Error-level log makes it visible. |
| Cron onSettingsChange timeout mid-rebuild | Low | Promise chain lock serializes. Zombie completes, queued work proceeds. 30s is generous. |
| Cron lock contention under rapid admin activity | Low | 5+ rapid settings changes queue behind the lock. Later calls may timeout before acquiring it, silently discarding a legitimate reload. Acceptable for v1 — admin activity is infrequent and manual. |
| Missing a call site when wiring | Low | Grep for all `runNotifyHooks`, `runChainHooks`, `runEarlyReturnHook` calls. Each must pass timeout. The 2 closure call sites (`broadcast`, `notifySettingsChange`) are structurally different — they read from `deps.config` internally, not from a parameter. |
| `vi.useFakeTimers()` test flakiness | Low | Use manually-controlled promises, not real delays. |

---

## Known Limitations (NOT addressed by this plan)

- **Delegation task hook timeouts** — `onTaskCreate/Complete/Failed` fire from the delegation plugin, not the orchestrator. Requires delegation plugin changes (see Follow-Up #1).
- **Fire-and-forget background work visibility** — addressed separately by S5.
- **Intent plugin double-execution** — exempt from timeout, requires restructuring (see Follow-Up #2).
- **Per-plugin timeout overrides** — not in v1 (see Follow-Up #3).
- **Lifecycle timeouts (start/stop)** — one-time operations, not per-message, separate concern.
- **Slow-but-under-threshold plugins** — a plugin consistently at 4.9s on a 5s timeout is not caught. Requires latency observability, not timeouts.
- **Promise cancellation** — JS has no promise cancellation. Timed-out hooks keep running. AbortSignal support would require plugin contract changes.

---

## Success Criteria

- [ ] Each orchestrator-level hook type has its own configurable timeout
- [ ] Notify hook timeout: **warn** log (via `instanceof HookTimeoutError` in modified catch block), continue to next plugin
- [ ] Non-timeout errors: **error** log (existing behavior preserved)
- [ ] Chain hook timeout: **error** log, preserve previous value, continue chain
- [ ] Early-return hook timeout: **warn** log, skip to next plugin
- [ ] `onIntentClassify` has no timeout (exempt — `undefined`)
- [ ] `onTaskCreate/Complete/Failed` explicitly not covered (delegation plugin scope)
- [ ] Zombie promise rejections suppressed (no unhandled rejections)
- [ ] All timeouts configurable via `OrchestratorConfig` and `HOOK_TIMEOUT_*` env vars (parsed through zod in `env.ts`)
- [ ] Missing `hookTimeouts` config = no timeouts (backward compatible)
- [ ] `broadcast` and `notifySettingsChange` closures pass `pluginNames()` for timeout log context
- [ ] Existing tests pass without modification
- [ ] New timeout tests cover all three runners + utility + orchestrator wrappers
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass
