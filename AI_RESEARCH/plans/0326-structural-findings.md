# Structural Findings — Plugin Architecture Audit

**Date:** 2026-03-26
**Source:** 44 validated findings across 7 plugins (notifications, ssh, govee, discord, calendar, storytelling, intent), analyzed by two independent analysts in a double-blind review.

**Method:** Each analyst independently extracted structural themes from the same finding set without seeing the other's work. This document synthesizes their conclusions. Themes marked **[CONVERGED]** were independently identified by both analysts. Themes marked **[SINGLE]** were identified by one analyst and validated by synthesis.

---

## Converged Structural Themes

### S1 [CONVERGED] — No Plugin State Primitive

The plugin contract provides `PluginContext` (DB, invoker, logger, config) but no mechanism for holding mutable runtime state. Plugins need connections, caches, clients, and config snapshots — so they use module-level `let` bindings. These bindings are shared across concurrent pipeline runs and mutated across `await` points, producing torn reads, leaked resources, and null-reference crashes.

**Manifestations:** F-01, G-01, IN-01, ST-11, ST-10, S-01

**Why it recurs:** `register()` returns closures (hooks). Those closures need to reference state initialized in `start()`. The only way to bridge the gap is module-level scope. The contract offers no `PluginState<T>`, no atomic swap, no mutex. Every plugin independently reinvents the same broken pattern.

**Blast radius:** Universal. Every plugin with any runtime state is vulnerable. Confirmed in 4/7 audited plugins. Suspected in music, playwright, search, discord.

---

### S2 [CONVERGED] — register/start Lifecycle Ambiguity

Two initialization phases (`register()` returns hooks, `start()` initializes resources) with no enforcement of what can happen in each. `register()` receives full `PluginContext` including `ctx.db`, implying I/O is safe — but failure in `register()` permanently disables the plugin's hooks for the process lifetime. Settings read in `register()` go stale by `start()`. Resources created in `start()` may reference values from `register()` that are already wrong.

**Manifestations:** F-03, F-04, F-07, C-04, ST-07

**Why it recurs:** The contract documents when each phase fires but not what each phase should contain. `register()` having full DB access is an attractive nuisance — it can do I/O, so it does, but it has no recovery path when I/O fails.

**Blast radius:** Every plugin with a `settingsSchema`. A single transient DB outage during startup permanently disables any plugin that reads settings in `register()`.

---

### S3 [CONVERGED] — Sequential Hooks Without Time Budgets

`run-hook.ts` iterates plugins sequentially with no timeout and no parallelism. Notification hooks are contractually "notification only" (cannot modify pipeline) but run in-band on the critical path. One slow plugin blocks every plugin behind it in registration order, including WebSocket delivery to the browser.

**Manifestations:** F-02, ST-01, ST-02

**Why it recurs:** The hook runner was designed for fast operations. The contract uses `Promise<void>` for all notify hooks, which does not distinguish "2ms DB write" from "60s TTS + Cast playback." Some plugins (identity, auto-namer) manually fire-and-forget heavy work, but this is tribal knowledge, not enforced.

**Blast radius:** Two confirmed. A single misbehaving hook creates user-visible latency for every message. The storytelling plugin adds 10-60s to every pipeline run; the notifications plugin can block the broadcast chain for up to 100s.

---

### S4 [CONVERGED] — onSettingsChange Is Partial and Non-Atomic

`onSettingsChange` signals "something changed" but provides no new value, no transactional swap, and no way to atomically update settings + derived resources. Plugins reload the settings object but forget to rebuild connection pools, clients, or caches that were constructed from the old settings. Dead settings (schema fields never consumed) accumulate because adding a schema field creates no compile-time obligation.

**Manifestations:** S-02, S-03, G-07, F-01, G-01, G-04

**Why it recurs:** `onSettingsChange` receives only the plugin name, not the new settings. The "what depends on settings" graph is implicit. The cron plugin's stop-and-rebuild pattern is the correct approach but is not documented as canonical. Adding a setting to the schema satisfies the admin UI without any enforcement that the code reads it.

**Blast radius:** Every plugin with `settingsSchema` and stateful resources. Confirmed in 3/7 audited plugins. Music plugin is highly suspect (YouTube client + Cast discovery + playback controller all derived from settings).

---

### S5 [CONVERGED] — Fire-and-Forget Without Outcome Tracking

The system uses `void` (fire-and-forget) as the default async pattern for everything from TTS playback to extraction pipelines to audit logging. No mechanism exists for tracking, retrying, or reporting outcomes of detached work. This creates "success is assumed" semantics: callers report completion before work finishes, and failures are silently swallowed.

**Manifestations:** C-02, ST-04, ST-05, S-05, F-05, IN-03, D-01

**Why it recurs:** Notify hooks return `Promise<void>` — they cannot signal failure to the pipeline. MCP tools return `string` — no structured result type with success/failure/partial semantics. The simplest implementation is to return a success string from every code path, including error handlers and timeouts. The system lacks a "background task with completion tracking" primitive.

**Blast radius:** Widest spread. Affects data integrity (processed:true after silent failure), user trust (tool says "done" before starting), audit compliance (commands execute without logs), and correctness (partial failures reported as success). The feedback loop is insidious: because failures are silent, bugs persist undetected.

---

### S6 [CONVERGED] — Testing Validates Shape Over Behavior

Tests systematically verify schemas exist, settings have expected fields, and tool definitions match shapes — but not whether `getSettings()` returns usable values, whether error paths execute, or whether settings changes propagate. The 80% coverage gate is satisfied by metadata tests, removing the forcing function to write behavioral tests.

**Manifestations:** D-01, D-02, D-03, D-04, ST-12, G-07, S-02

**Why it recurs:** Plugin infrastructure (settingsSchema, JSON Schema tool definitions) is easy to snapshot-test. Behavioral testing requires mocking `PluginContext`, simulating lifecycle events, and verifying downstream effects — significantly harder. The coverage gate creates a perverse incentive where easy shape tests hit the threshold.

**Blast radius:** Every plugin with settings or tools. False coverage confidence hides behavioral bugs.

---

## Complementary Themes (identified by one analyst, validated by synthesis)

### S7 — No Error Recovery Strategy

Plugin errors are *contained* (caught and logged by hook runners) but not *recovered*. Failed `register()` permanently disables a plugin. Failed background operations are swallowed with `warn` logs. Failed DB writes (P2025, P2002) surface as raw Prisma errors. The system converts every transient failure into either permanent disability or silent data loss.

**Manifestations:** F-03, S-05, ST-04, ST-05, D-01, G-02, ST-09

**Why it recurs:** The hook runners in `run-hook.ts` represent the only error strategy: catch and continue. No retry, no circuit breaker, no health check, no degradation signal. DB errors (P2025 on missing rows, P2002 on conflicts) are treated as unexpected because the contract doesn't acknowledge concurrent writes.

**Blast radius:** Universal. Every plugin experiences transient failures. Without recovery, each failure is either permanent or invisible.

---

### S8 — Missing Thread-Kind Guards on Hooks

Hooks fire for all threads regardless of `thread.kind`. The hook signature provides `threadId` but not thread metadata. Plugins that should only operate on specific kinds must perform their own DB lookup, and they skip it.

**Manifestations:** ST-02, ST-01 (amplified by firing on wrong threads)

**Why it recurs:** Hook signatures are minimal — `onAfterInvoke(threadId, result)` carries no context. Every plugin that cares about thread kind pays a DB lookup cost. Plugins skip it, fire on all threads, and waste compute or produce incorrect results.

**Blast radius:** Multiplicative. Makes S3 (sequential hooks) worse by expanding the trigger surface of slow hooks.

---

### S9 — Absent Concurrency Control at the Plugin Boundary

No mutexes, semaphores, or atomic operations. Node.js single-threading creates false safety: every `await` is a yield point, and `maxConcurrentAgents=3` means multiple pipelines run concurrently. Plugins implement naive check-then-act patterns that race.

**Manifestations:** S-01, G-05, G-06, IN-01

**Why it recurs:** The plugin contract's silence on concurrency is interpreted as "concurrency is not a concern." The SSH pool race (S-01) and Govee toggle TOCTOU (G-05) are both check-then-act patterns that assume single-caller semantics.

**Blast radius:** Resource leaks (orphaned TCP connections), logical errors (toggles cancel out), and intermittent failures under load — hardest bugs to reproduce and diagnose.

---

## Amplifying Loops

Three interaction loops make these themes worse than the sum of their parts:

**Loop A: S1 + S9 = Undetectable Corruption.** Module-level state without concurrency control means state is torn across await points. Because corruption is in-memory (no DB constraint catches it) and fire-and-forget swallows downstream errors, it propagates silently.

**Loop B: S3 + S8 = Quadratic Latency.** Hooks fire on all threads and execute sequentially without timeouts. Latency scales with `(slow hooks) * (irrelevant thread kinds) * (hook duration)`.

**Loop C: S5 + S7 = Silent Data Loss.** Fire-and-forget operations that assume success create a pattern where data loss is invisible. ST-04 (marks processed after failure) is canonical: extraction fails, guard marks done, retry never fires.

---

## Mapping: Findings to Themes

| Finding | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| F-01    | X  |    |    | X  |    |    |    |    | X  |
| F-02    |    |    | X  |    |    |    |    |    |    |
| F-03    |    | X  |    |    |    |    | X  |    |    |
| F-04    |    | X  |    |    |    |    |    |    |    |
| F-05    |    |    |    |    | X  |    |    |    |    |
| F-06    |    |    |    |    |    |    |    |    |    |
| F-07    |    | X  |    | X  |    |    |    |    |    |
| S-01    | X  |    |    |    |    |    |    |    | X  |
| S-02    |    |    |    | X  |    | X  |    |    |    |
| S-03    |    |    |    | X  |    |    |    |    |    |
| S-04    |    |    |    |    |    |    | X  |    |    |
| S-05    |    |    |    |    | X  |    | X  |    |    |
| G-01    | X  |    |    | X  |    |    |    |    | X  |
| G-02    |    |    |    |    |    |    | X  |    |    |
| G-03    |    |    |    |    | X  |    | X  |    |    |
| G-04    |    |    |    | X  |    |    |    |    |    |
| G-05    |    |    |    |    |    |    |    |    | X  |
| G-06    |    |    |    |    |    |    |    |    | X  |
| G-07    |    |    |    | X  |    | X  |    |    |    |
| G-08    |    |    |    |    |    |    |    |    |    |
| D-01    |    |    |    |    | X  | X  |    |    |    |
| D-02    |    |    |    |    |    | X  |    |    |    |
| D-03    |    |    |    |    |    | X  |    |    |    |
| D-04    |    |    |    |    |    | X  |    |    |    |
| C-01    |    |    |    |    |    |    | X  |    |    |
| C-02    |    |    |    |    | X  |    |    |    |    |
| C-03    |    |    |    |    |    |    |    |    |    |
| C-04    |    | X  |    | X  |    |    |    |    |    |
| ST-01   |    |    | X  |    |    |    |    | X  |    |
| ST-02   |    |    | X  |    |    |    |    | X  |    |
| ST-03   |    |    |    |    |    |    | X  |    |    |
| ST-04   |    |    |    |    | X  |    | X  |    |    |
| ST-05   |    |    |    |    | X  |    |    |    | X  |
| ST-06   |    |    |    |    |    |    |    |    |    |
| ST-07   |    | X  |    |    |    |    |    |    |    |
| ST-09   |    |    |    |    |    |    | X  |    |    |
| ST-10   | X  |    |    |    |    |    |    |    |    |
| ST-11   | X  |    |    |    |    |    |    |    |    |
| ST-12   |    |    |    |    | X  | X  |    |    |    |
| ST-13   |    |    |    |    |    |    |    |    |    |
| ST-14   |    |    |    |    |    |    |    |    |    |
| IN-01   | X  |    |    |    |    |    |    |    | X  |
| IN-02   |    |    |    |    |    |    |    |    |    |
| IN-03   |    |    |    |    | X  |    |    |    |    |
| IN-04   |    |    |    |    | X  |    |    |    |    |

**Coverage:** 38 of 44 findings map to at least one structural theme. The 6 unmapped findings (F-06, G-08, C-03, ST-06, ST-13, ST-14, IN-02) are individual code defects without a systemic root cause.

---

## Priority Assessment

**Tier 1 — Fix the contract (prevents future bugs):**
- S1 (plugin state primitive) + S9 (concurrency control) — these are two faces of the same gap
- S3 (hook time budgets) — directly affects user-visible latency

**Tier 2 — Fix the lifecycle (prevents startup fragility):**
- S2 (register/start ambiguity) — document and enforce phase boundaries
- S4 (onSettingsChange atomicity) — establish canonical reload pattern

**Tier 3 — Fix the feedback loops (prevents silent failures):**
- S5 (fire-and-forget outcome tracking) — most findings trace here
- S7 (error recovery) — without this, every transient failure is permanent

**Tier 4 — Fix the signals:**
- S6 (testing shape vs behavior) — prevents regression after fixes
- S8 (thread-kind guards) — reduces wasted work and amplification
