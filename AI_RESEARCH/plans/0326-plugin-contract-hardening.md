# Plugin Contract Hardening Plan

**Date:** 2026-03-26
**Source:** Structural findings from multi-agent bug hunt (9 validated themes across 44 findings, 7 plugins, 4 independent code validators)
**Decision:** Fix the contract, don't migrate to a framework. No TS agent framework provides Harness's cross-pipeline orchestration hooks.

---

## Contract-Level Fixes (no plugin changes needed)

### S3 — Hook Timeout

Add a timeout wrapper to `run-hook.ts` for notify hooks. If a plugin's hook exceeds the budget, it's killed and logged. Plugins don't know or care. One file changed.

**Confirmed bugs this fixes:**
- F-02: notifications `onBroadcast` blocks entire broadcast chain for up to 100s
- ST-01: storytelling `onAfterInvoke` blocks pipeline for 10-60s during extraction

**Scope:** `packages/plugin-contract/src/_helpers/run-hook.ts`

---

## Contract-Level Fixes (plugin changes needed)

### S2 — register() must be pure, start() owns all I/O

Enforce that `register()` only returns hooks — no I/O, no `getSettings()`, no `ctx.db` calls. Move all I/O to `start()`. Audit all 27 plugins and fix each one that does I/O in `register()`. Fix `buildPluginContext` so `system: true` plugins get real `getSettings` (not the stub that returns `{}`).

**Confirmed bugs this fixes:**
- F-03: notifications `getSettings()` in `register()` — DB error permanently kills hooks
- F-07: notifications `start()` uses stale settings snapshot from `register()`
- F-04: notifications audioServer URL malformed before `start()` resolves
- C-04: `system: true` plugins get stub `getSettings` returning `{}`
- ST-07: storytelling `start()` pre-warms wrong model (stale config from register)

**Scope:**
- `apps/orchestrator/src/orchestrator/index.ts` (buildPluginContext system branch, register error handling)
- All 27 plugins audited, each fixed individually if doing I/O in `register()`
- Document the boundary in contract types/comments

### ~~S4 — onSettingsChange passes new value~~ → WITHDRAWN

**Status:** Withdrawn after 3-round adversarial review (3/3 convergence on 2 critical, 2 major findings).

**Original proposal:** Change `onSettingsChange` signature to pass pre-fetched settings so plugins don't call `getSettings()` themselves.

**Why it was withdrawn:**

1. **No type-safe implementation path (CRITICAL).** The orchestrator's `notifySettingsChange` closure has no access to per-plugin schemas. `PluginDefinition.settingsSchema` is typed as the erased `PluginSettingsSchemaInstance<SettingsFieldDefs>` ("for code generation only" per the JSDoc). Passing `Record<string, unknown>` degrades every plugin from `InferSettings<T>` to untyped casts. There is no sound TypeScript encoding that preserves typed settings across the `PluginHooks` interface boundary.

2. **Scope was wrong by 2x (CRITICAL).** 14 plugins implement `onSettingsChange`, not 7. The 7 missing: govee, notifications, identity, summarization, auto-namer, audit, delegation.

3. **Discord handler is 33 lines, not "2-3" (MAJOR).** Includes `ctx.db.agent.findFirst`, `state.client.destroy`, conditional `start(ctx)`, `ctx.reportStatus`. Cron's handler delegates to `start()` which calls `getSettings` internally — structurally incompatible with pass-the-value. Calendar's handler doesn't call `getSettings` at all.

4. **None of the cited bugs are fixed by a signature change (MAJOR):**
   - S-03 (SSH pool): requires pool teardown + rebuild code in the handler — orthogonal to signature
   - G-01 (govee race): requires S9 mutex — the race is concurrent `initClient` calls tearing module-level state, not stale settings
   - S-02/G-07 (dead settings): `Record<string, unknown>` provides no compile-time enforcement of field consumption

5. **5 of 14 plugins gain near-zero benefit.** Summarization, audit, auto-namer, identity, delegation have trivial 4-line handlers. Replacing `getSettings` with a passed parameter saves one DB round-trip but introduces a type cast.

**What actually fixes the cited bugs:**
- S-03 → plugin-level fix: add `pool.releaseAll(); pool = createConnectionPool(...)` to SSH's `onSettingsChange`
- G-01 → S9 (mutex primitive on PluginContext)
- S-02/G-07 → per-plugin code audit of schema fields vs consumed fields

**Change point note:** The actual change point for `onSettingsChange` arguments is the lambda closure in `apps/orchestrator/src/orchestrator/index.ts` (line ~305), NOT `run-hook.ts`. The hook runner is a generic iterator that calls whatever lambda the caller provides.

---

## Contract Additive (plugins opt-in over time)

### S1 — Plugin State Container

Add a per-plugin state primitive to `PluginContext` so plugins stop using module-level `let` bindings. Must be isolation-respecting — plugins can't see or mutate each other's state.

**Confirmed bugs this fixes:**
- F-01: notifications module-level `currentSettings`/`ttsProvider` torn across await points
- G-01: govee `client`, `deviceCache`, `rateLimiter`, `groups` replaced non-atomically
- IN-01: intent `pluginCtx` null race between guard and `!` assertions
- ST-11: storytelling `cachedSoul` never invalidated
- ST-10: storytelling `storyCache` null-sentinel conflation

**Scope:**
- `packages/plugin-contract/src/index.ts` (new PluginState type on PluginContext)
- `apps/orchestrator/src/orchestrator/index.ts` (construct state container per plugin)
- Plugins migrate off module-level `let` bindings individually when convenient

### S9 — Concurrency Primitive

Add a mutex/lock primitive to `PluginContext`. SSH and music plugins have confirmed races that would use it immediately.

**Confirmed bugs this fixes:**
- S-01: SSH concurrent `getConnection` orphans TCP connections
- G-05: govee `toggle_light` TOCTOU — concurrent toggles cancel out
- Music playback-controller `connectToDevice` check-then-act race on sessions Map

**Scope:**
- `packages/plugin-contract/src/index.ts` (new lock/mutex on PluginContext)
- SSH and music plugins adopt immediately; others when ready

### S5 — Background Task Visibility

Extend existing `reportBackgroundError` to also track running tasks, not just failed ones. Low priority for single-user — the error reporting already exists, this just adds "what's currently in flight" visibility.

**Confirmed bugs this fixes:**
- C-02: calendar `sync_now` tool returns success before work starts
- D-01: discord `sendToThread` `.catch()` handler untested/unreachable
- ST-04: storytelling `import_document` marks processed:true after silent failures
- S-05: SSH `logCommand` audit failures swallowed as `warn`

**Scope:**
- `apps/orchestrator/src/orchestrator/_helpers/background-error-tracker.ts` (extend to track running tasks)
- `packages/plugin-contract/src/index.ts` (new `ctx.runBackground()` or similar)
- Plugins opt-in gradually; existing `void` patterns keep working

---

## New Lifecycle Hook

### S7 — `onStartFailed()` recovery hook

New optional hook on `PluginDefinition`. When `start()` throws, the orchestrator calls `onStartFailed(error)` instead of just logging and moving on. The plugin decides: fall back to defaults, schedule its own retry, report what's broken. Hooks are already registered (because `register()` succeeded and is now pure), so the plugin is degraded but not dead.

**Confirmed bugs this fixes:**
- F-03: notifications permanently disabled when DB unavailable at startup
- Any plugin that fails `start()` due to transient infrastructure (Docker not up, external API down, etc.)

**Scope:**
- `packages/plugin-contract/src/index.ts` (add `onStartFailed` to PluginDefinition)
- `apps/orchestrator/src/orchestrator/index.ts` (call it when `start()` throws)
- Plugins implement individually based on their recovery needs

---

## Not Changing (plugin-level quality, not contract)

**S6 (testing shape vs behavior)** — tests validate schema metadata instead of runtime behavior. Fixed per-plugin as we touch them. Not a contract issue.

**S8 (thread-kind guards on hooks)** — hooks fire on all thread kinds, plugins must filter themselves. Could add thread metadata to hook signatures later, but low priority.

---

## Execution Order

1. **S3** (hook timeout) — smallest change, immediate latency improvement, zero plugin impact
2. **S2** (register purity) — biggest scope, audit all 27 plugins, but straightforward per-plugin
3. **S7** (onStartFailed) — pairs with S2 since we're already in the lifecycle code
4. ~~**S4**~~ — WITHDRAWN (see above)
5. **S1** (state container) — design work needed, plugins migrate gradually
6. **S9** (mutex) — SSH and music adopt immediately after S1; also fixes G-01 (govee race)
7. **S5** (background task visibility) — low priority, existing error tracking covers most cases

**Bugs orphaned by S4 withdrawal — reassigned:**
- S-03 (SSH pool not rebuilt on settings change) → plugin-level fix during S2 audit
- G-01 (govee concurrent state tear) → S9 (mutex)
- S-02/G-07 (dead settings fields) → plugin-level audit, no contract change needed

---

## Reference

- Structural findings: `AI_RESEARCH/plans/0326-structural-findings.md`
- Raw bug hunt data: `AI_RESEARCH/plans/0326-bug-hunt-session.md`
- Framework research: `AI_RESEARCH/2026-03-26-typescript-agent-orchestration-frameworks.md`
