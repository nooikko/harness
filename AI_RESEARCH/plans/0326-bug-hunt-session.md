# Bug Hunt Session — 2026-03-26

Multi-agent adversarial bug hunt across Harness plugins. Each plugin was reviewed by 3 independent auditors who cross-reviewed each other's findings until convergence. Only findings validated by all 3 auditors are included.

This document aggregates findings across all plugins reviewed in this session. Findings are tagged for triage into:
- **FUNDAMENTAL** — pattern-level issues that affect multiple plugins or require changes to the plugin contract, hook runners, or orchestrator
- **SYSTEM** — issues specific to one plugin that need individual fixes

---

## notifications plugin

**Reviewed by:** 3 independent auditors, 1 cross-review round, 7 validated findings

### Validated Findings

#### F-01 [CRITICAL] Module-level mutable state race
**Category:** race-condition | **Triage:** FUNDAMENTAL

`currentSettings` and `ttsProvider` are module-level `let` bindings written by `onSettingsChange` and read concurrently by `performAnnouncement`. Across async `await` points, `onSettingsChange` can null or replace `ttsProvider` while an in-flight announcement is mid-execution.

**Pattern note:** This is likely endemic across plugins that use module-level state with `onSettingsChange`. Any plugin that stores mutable config at module scope and has async hook handlers or tool handlers is vulnerable to the same torn-read pattern. Check: music, calendar, discord, cron, ssh — all implement `onSettingsChange` and hold module-level state.

**Files:** `packages/plugins/notifications/src/index.ts`

---

#### F-02 [MAJOR] `onBroadcast` awaits `performAnnouncement` synchronously — blocks entire broadcast chain
**Category:** contract-violation | **Triage:** FUNDAMENTAL

The `onBroadcast` hook awaits the full announcement pipeline (TTS generation + Cast connect + 60s playback timeout = up to 100s). Since `run-hook.ts` iterates plugins sequentially and awaits each, this blocks ALL subsequent `onBroadcast` calls for ALL plugins — including `pipeline:complete` which delivers responses to the browser via WebSocket.

**Pattern note:** Any plugin that does expensive async work inside a notify hook (`onBroadcast`, `onMessage`, `onAfterInvoke`, `onPipelineComplete`) and awaits it rather than firing-and-forgetting violates the implicit non-blocking contract. The hook runners do not enforce a timeout. This should be audited across all plugins. Known correct pattern: `void expensiveWork().catch(err => ctx.logger.error(...))`.

**Files:** `packages/plugins/notifications/src/index.ts`, `packages/plugin-contract/src/_helpers/run-hook.ts`

---

#### F-03 [MAJOR] `ctx.getSettings()` in `register()` — DB error permanently kills hook registration
**Category:** contract-violation | **Triage:** FUNDAMENTAL

`register()` calls `await ctx.getSettings(settingsSchema)` before returning hooks. If the DB is unavailable, `register()` throws and hooks are never returned. The plugin is permanently absent from all hook chains for the process lifetime — no retry, no fallback, no operator-visible error beyond startup logs.

**Pattern note:** Any plugin that performs I/O (especially DB reads) in `register()` has this vulnerability. `register()` should be fast and infallible — return hooks unconditionally, defer I/O to `start()`. Check all plugins with `settingsSchema` that call `getSettings()` in `register()`.

**Files:** `packages/plugins/notifications/src/index.ts`

---

#### F-04 [MAJOR] `audioServer.register()` returns `http://:0/...` before `start()` resolves
**Category:** null-path | **Triage:** SYSTEM

`resolvedHost` and `resolvedPort` in `audio-server.ts` initialize to `''` and `0`. They are only set when `start()` resolves. If `audioServer.register()` is called before that (e.g., during a race between `start()` and an incoming broadcast), the URL is malformed and the Cast device receives an unreachable address. No error is surfaced — the 60s playback timeout fires `resolve()` and the announcement appears to succeed.

**Files:** `packages/plugins/notifications/src/_helpers/audio-server.ts`

---

#### F-05 [MAJOR] Cast playback timeout resolves with success — stalled Cast appears to succeed
**Category:** null-path | **Triage:** SYSTEM

The Cast playback promise uses `setTimeout(() => { resolve(); }, PLAYBACK_TIMEOUT_MS)`. If the device accepts the stream but never signals `IDLE/FINISHED` (network hiccup, stall, codec issue), the timeout fires and `announce()` returns success. The tool tells the caller "Announced on X: ..." when audio was never played.

**Files:** `packages/plugins/notifications/src/_helpers/cast-announcer.ts`

---

#### F-06 [MAJOR] `notification:announce` broadcast event has zero callers — dead integration surface
**Category:** cross-coupling | **Triage:** SYSTEM

The `onBroadcast` handler listens for `notification:announce` but no code in the codebase emits it. The only way to trigger an announcement is via the `announce` MCP tool. The broadcast path is dead code.

**Files:** `packages/plugins/notifications/src/index.ts`

---

#### F-07 [MAJOR] `start()` never re-reads settings from DB — stale snapshot from `register()`
**Category:** race-condition | **Triage:** FUNDAMENTAL

`start()` uses `currentSettings` populated by `register()` rather than calling `ctx.getSettings()`. If settings changed between registration and start (or if `register()` used defaults due to a transient DB issue per F-03), `start()` applies stale configuration. This combines with F-03: a transient DB failure during `register()` means the plugin runs with wrong defaults permanently.

**Pattern note:** Same as F-03 — any plugin that reads settings in `register()` and uses them in `start()` without re-reading has this gap.

**Files:** `packages/plugins/notifications/src/index.ts`

---

### Unvalidated Findings (insufficient cross-review)

These were raised by 1-2 auditors but not independently examined by all 3. Included for reference but not actionable without further validation.

- **EADDRINUSE on double `start()`** — Gamma only. Module-level `audioServer` never checked before `start()` re-initializes. If `start()` called twice, port 9849 bind fails.
- **`resolveLanIp()` falls back to `127.0.0.1`** — Cast devices can't reach loopback. Silent failure.
- **`stop()` TOCTOU** — `audioServer` nulled before `ttsProvider`, narrow inconsistency window.
- **`list_speakers` drops `ctx`/`meta` parameters** — No observability on errors.

### Rejected Findings

- **Disabled plugin + settings change** — Disabled plugins are never `register()`ed; `onSettingsChange` can't fire.
- **`resolveDevice(undefined)`** — `cast-devices` handles `undefined` as "pick first device" by design.
- **Temp file cleanup swallows errors** — Standard Node.js pattern for non-critical `fs.unlink`.

---

## Cross-Plugin Pattern Issues (for fundamental triage)

These patterns emerged from the notifications audit but likely affect multiple plugins. They should be validated across the plugin ecosystem before individual fixes are applied.

### Pattern 1: Module-level mutable state + async hooks = torn reads
**Affected (suspected):** notifications, music, calendar, discord, cron, ssh — any plugin with `onSettingsChange` + module-level state
**Root cause:** No synchronization primitive exists in the plugin contract for settings reload. Plugins use module-level `let` bindings that can be overwritten mid-execution of an async hook or tool handler.
**Potential fix:** Plugin contract could provide a `getSettingsSnapshot()` that returns an immutable frozen copy, or plugins could capture settings into local const at the top of each handler invocation.

### Pattern 2: Blocking work in notify hooks
**Affected (suspected):** notifications (confirmed), potentially music (Cast operations), playwright (browser operations)
**Root cause:** `run-hook.ts` awaits each plugin sequentially with no timeout. A slow plugin blocks the entire chain.
**Potential fix:** Either (a) add a per-plugin timeout to the hook runner, (b) document and enforce fire-and-forget as the only pattern for expensive work in notify hooks, or (c) run notify hooks in parallel (breaking change — would need careful analysis).

### Pattern 3: I/O in `register()` creates fragile startup
**Affected (suspected):** Any plugin calling `ctx.getSettings()` or `ctx.db.*` in `register()`
**Root cause:** `register()` is meant to be fast and return hooks. I/O makes it fallible, and a failure means hooks are never registered for the process lifetime.
**Potential fix:** Lint rule or contract documentation that `register()` must be synchronous and infallible. All I/O belongs in `start()`.

### Pattern 4: Settings read in `register()`, used in `start()` without re-read
**Affected (suspected):** Same as Pattern 3
**Root cause:** Implicit coupling through module-level state between `register()` and `start()`.
**Potential fix:** `start()` should always call `ctx.getSettings()` fresh. The `register()`-time read is unnecessary if `start()` reads independently.

### Pattern 5: Connection pool `getConnection` has no pending-connection guard
**Affected (confirmed):** ssh
**Affected (suspected):** Any plugin that pools async resources keyed by ID without a "connecting" sentinel
**Root cause:** `getConnection` checks for an existing pool entry, but between the check and the async `client.on('ready')` callback that calls `pool.set()`, concurrent callers can both miss and both create connections. The second overwrites the first, orphaning it.
**Potential fix:** Maintain a `Map<string, Promise<Client>>` of in-flight connections. When a connection is being established, subsequent callers await the same promise instead of creating a new one.

### Pattern 6: `onSettingsChange` reloads config objects but not stateful resources
**Affected (confirmed):** ssh (pool not rebuilt), notifications (stale snapshot from register)
**Affected (suspected):** music (YouTube client, Cast discovery), discord (gateway connection), cron (croner jobs — though cron does rebuild correctly)
**Root cause:** `onSettingsChange` updates the `settings` variable but stateful resources (connection pools, servers, client instances) were constructed with the old settings and are never torn down and rebuilt.
**Potential fix:** `onSettingsChange` should follow the cron plugin's pattern: stop all stateful resources, then rebuild from the new settings. Document this as the canonical pattern in the plugin contract.

### Pattern 7: Dead settings — schema defines fields never read by implementation
**Affected (confirmed):** ssh (`maxConcurrentPerHost`)
**Affected (suspected):** Needs audit across all plugins with `settingsSchema`
**Root cause:** Settings schemas are additive — fields get added to the schema during design but the enforcement code is never written, or gets removed during refactoring while the schema field persists.
**Potential fix:** Grep for all `settingsSchema` field names and verify each has at least one read site outside of the schema definition itself. Automate as a lint check.

---

## ssh plugin

**Reviewed by:** 3 independent auditors, 1 cross-review round, 5 validated findings

### Validated Findings

#### S-01 [MAJOR] Concurrent `getConnection` for the same host orphans SSH connections
**Category:** race-condition | **Triage:** FUNDAMENTAL (Pattern 5)

Two concurrent `exec` calls for the same uncached host both miss `pool.get(hostId)`, both create `new Client()`, both connect. The second `pool.set()` overwrites the first — the first client is leaked (connected, never ended, never tracked). TCP connection stays open indefinitely until the remote host or OS closes it. Under load, degrades into connection exhaustion on the target host.

**Files:** `packages/plugins/ssh/src/_helpers/connection-pool.ts` (getConnection)

---

#### S-02 [MAJOR] `maxConcurrentPerHost` setting is dead code
**Category:** contract-violation | **Triage:** FUNDAMENTAL (Pattern 7)

Defined in `settingsSchema` with label "Max Concurrent Commands Per Host" and description promising queuing. `SshSettings` type includes it. Never read anywhere in the plugin — not passed to `createConnectionPool`, no per-host ceiling check in `getConnection`. The admin UI exposes a tuning control that does nothing. Operators relying on it to protect hosts from connection saturation receive no protection.

**Files:** `packages/plugins/ssh/src/_helpers/settings-schema.ts`, `packages/plugins/ssh/src/index.ts`

---

#### S-03 [MAJOR] `onSettingsChange` reloads settings but does not rebuild pool
**Category:** contract-violation | **Triage:** FUNDAMENTAL (Pattern 6)

Only the `settings` object is refreshed. The pool's `maxConnections` cap, set at construction time in `register()`, is never updated. A runtime change to `maxPoolConnections` via admin UI has no effect until process restart. Combined with S-02, both capacity controls in the settings UI are inert.

**Files:** `packages/plugins/ssh/src/index.ts` (onSettingsChange hook)

---

#### S-04 [MAJOR] TOFU fingerprint written to DB before `echo ok` verification
**Category:** race-condition | **Triage:** SYSTEM

`sshHost.update({ fingerprint })` executes before `executeCommand({ command: 'echo ok' })`. If the SSH handshake succeeds but command execution fails (restricted shell, timeout, permission denied), the untrusted host key is permanently persisted. Subsequent connections trust it without question. Deterministic bug — happens on every first `test_connection` to a host where exec fails. Fix: move the DB write after `executeCommand` succeeds.

**Files:** `packages/plugins/ssh/src/index.ts` (test_connection handler, lines ~386–413)

---

#### S-05 [MAJOR] `logCommand` audit failures swallowed as `warn`
**Category:** contract-violation | **Triage:** SYSTEM

Fire-and-forget `db.sshCommandLog.create()` failures produce only `warn`-level log entries. When `logCommands` is enabled (the default), failed writes mean commands execute without audit trail. No mechanism to surface the failure at the tool-response or admin UI level. Persistent DB failures (FK violation, disk full) silently drop all audit records.

**Files:** `packages/plugins/ssh/src/_helpers/log-command.ts`

---

### Unvalidated Findings (insufficient cross-review)

These were raised by 1-2 auditors but not independently examined by all 3. Included for reference but not actionable without further validation.

- **Pool permanently null after `stop()`** — Gamma only. `stop()` nulls `pool`, `start()` only logs. SSH tools permanently disabled after stop/start cycle until process restart. Plausible but needs Alpha/Beta verification.
- **`remove_host` doesn't evict pool connection** — Gamma only. Deleted host's connection persists in pool for up to 5 minutes. Low severity.
- **`add_host` IPv6 regex rejection** — Alpha/Beta only. Hostname regex rejects IPv6 addresses (no colons). Gamma never reviewed.
- **`add_host` TOCTOU on unique name** — Beta/Gamma flagged, Alpha rejected (single-user). Not converged.
- **Module-level mutable state non-reentrant** — Beta/Gamma flagged, Alpha rejected. Relates to Pattern 1 from notifications audit.

### Rejected Findings

- **Scoped DB blocks `SshCommandLog` writes** — Alpha raised, Beta and Gamma independently disproved by reading `createScopedDb` source. Scoped DB only intercepts `PluginConfig` table queries; all other models pass through unscoped.
- **TOFU fails when pool reuses cached connection** — Gamma raised, then retracted after verifying that `test_connection` calls `pool.evict()` before `getConnection()`, ensuring a fresh handshake.

---

## govee plugin

**Reviewed by:** 3 independent auditors, 1 cross-review round, 8 validated findings

### Validated Findings

#### G-01 [CRITICAL] Module-level mutable state torn by concurrent `onSettingsChange`
**Category:** race-condition | **Triage:** FUNDAMENTAL (Pattern 1)

`client`, `deviceCache`, `rateLimiter`, and `groups` are module-level `let` bindings replaced non-atomically by `initClient` across multiple assignments with `await` points between them. If `onSettingsChange` fires while a tool call is in-flight (or two settings changes overlap), tool handlers observe mixed-state pairings — e.g., new `rateLimiter` with old `client`. `ensureConnected()` only guards against all-null, not against mixed-instance state. Same fundamental pattern as notifications F-01.

**Files:** `packages/plugins/govee/src/index.ts` (lines 19–24, `initClient` lines 45–84)

---

#### G-02 [MAJOR] `saveGroups` throws P2025 on fresh install — groups silently lost
**Category:** contract-violation | **Triage:** SYSTEM

`saveGroups` calls `pluginConfig.update()` which throws Prisma P2025 when no `PluginConfig` row exists (fresh install, never configured via admin UI). The outer `catch {}` silently swallows the error. Groups created via `create_group` exist only in memory — lost on restart with no error surfaced to the agent. Fix: replace `update` with `upsert`.

**Files:** `packages/plugins/govee/src/index.ts` (lines 86–97)

---

#### G-03 [MAJOR] `set_light` / `applyToDevice` has no per-device error isolation
**Category:** null-path | **Triage:** SYSTEM

`applyToDevice` sends up to 4 sequential `controlDevice` calls (on, brightness, colorTemp, color) with no try/catch. If any call throws (rate limit, network error), `Promise.all` rejects immediately — partial successes are discarded, the agent receives a generic error with no indication of which commands applied. Contrast with `set_group` which wraps each device in explicit try/catch and accumulates partial results. Same tool, inconsistent error handling.

**Files:** `packages/plugins/govee/src/index.ts` (lines 161–208)

---

#### G-04 [MAJOR] Groups bypass `ctx.getSettings` — raw JSON in settings blob
**Category:** contract-violation | **Triage:** FUNDAMENTAL (Pattern 7 variant)

Groups are read/written via raw `pluginConfig.findUnique` + `update`, stored as an untyped `groups` key inside the `settings` JSON blob alongside typed schema fields (`apiKey`, `defaultTransitionMs`). `groups` is not declared in `settingsSchema`, making it invisible to the admin UI and any schema-driven tooling. If the admin UI ever normalizes the settings column (writes only schema-declared fields), groups are silently clobbered. This is a variant of the dead-settings pattern — instead of a dead schema field, it's a live runtime field stored outside the schema.

**Files:** `packages/plugins/govee/src/index.ts` (lines 74–83 load, 86–97 save)

---

#### G-05 [MAJOR] `toggle_light` TOCTOU — concurrent toggles cancel out
**Category:** race-condition | **Triage:** SYSTEM

Read-then-write pattern: `getDeviceState` reads current power state, then `controlDevice` writes the inverse. Two concurrent toggles on the same device both read the same state and both send the same command — no net change instead of a toggle. No lock primitive available against the Govee cloud API. The agent receives success for both calls.

**Files:** `packages/plugins/govee/src/index.ts` (lines 257–270)

---

#### G-06 [MAJOR] `toggle_light` `getDeviceState` bypasses rate limiter
**Category:** race-condition | **Triage:** SYSTEM

`getDeviceState` in `govee-client.ts` makes a real HTTP call to the Govee API but does not call `rateLimiter.tryAcquire`. Only `controlDevice` is rate-limited. Each toggle consumes 2 API requests against Govee's 10-req/min-per-device limit, but the plugin's limiter counts only 1. `get_status` misreports actual usage. Under heavy toggle use, unexpected 429s surface as unhandled exceptions while the limiter reports remaining capacity.

**Files:** `packages/plugins/govee/src/index.ts` (lines 242–259), `packages/plugins/govee/src/_helpers/govee-client.ts` (getDeviceState)

---

#### G-07 [MINOR] `defaultTransitionMs` setting declared in schema but never consumed
**Category:** contract-violation | **Triage:** FUNDAMENTAL (Pattern 7)

`settingsSchema` declares `defaultTransitionMs` (default 400ms) with a description implying it affects light transitions. No tool handler reads it. The admin UI exposes a field that does nothing. Same dead-settings pattern as ssh S-02 (`maxConcurrentPerHost`).

**Files:** `packages/plugins/govee/src/_helpers/settings-schema.ts`

---

#### G-08 [MINOR] `list_devices` unconditionally refreshes cache — no TTL
**Category:** null-path | **Triage:** SYSTEM

Every `list_devices` call hits the Govee API via `cache.refresh()` with no staleness check. Given the 10,000-request daily limit, an agent that lists devices before each command doubles its API consumption. Low severity because the daily budget is large, but wasteful.

**Files:** `packages/plugins/govee/src/index.ts` (lines 110–114)

---

### Unvalidated Findings (insufficient cross-review)

These were raised by 1 auditor but not independently examined or explicitly confirmed by the other 2. Included for reference but not actionable without further validation.

- **`create_group`/`delete_group` concurrent write clobber** — Gamma only. `saveGroups` does read-modify-write on the settings blob; concurrent group ops can clobber each other. Plausible extension of G-01 but unverified.
- **`get_status` misleading output when `deviceCache` is null** — Alpha only. Guard checks `rateLimiter` but not `deviceCache`; reports "Connected" with 0 devices after failed init. Beta retracted their version.
- **Intent plugin hardcodes `plugin: 'govee'`** — Alpha + Gamma. Disabling govee causes silent intent classification fallthrough. Beta called "out of scope."
- **`toggle_light` always turns on when `powerSwitch` capability absent** — Gamma only. Optional chaining makes `currentlyOn = false`, computing `newValue = 1` (always on). No error surfaced.

### Rejected Findings

- **`onSettingsChange` captured `_ctx` bypasses scoped context** — Alpha held MAJOR; Beta and Gamma independently rejected. `_ctx` is the same stable `PluginContext` instance received by `register()`. No stale reference.
- **`set_light` mutates `findAllByName` result array** — Alpha/Beta rated MINOR; Gamma rejected. `filter()` returns a new array; `push()` only affects a local variable, not the cache's internal state.
- **`stop()` clears groups without reload path** — Gamma raised, then retracted. `onSettingsChange` → `initClient` reloads groups from DB.

---

## Cross-Plugin Pattern Issues (updated with govee findings)

### Pattern 1: Module-level mutable state + async hooks = torn reads
**Confirmed in:** notifications (F-01), govee (G-01)
**Suspected in:** music, calendar, discord, cron, ssh
**Status:** Confirmed as endemic pattern. Two independent plugin audits found the exact same class of bug. This is the highest-priority fundamental fix.

### Pattern 7: Dead settings — schema defines fields never read by implementation
**Confirmed in:** ssh (S-02: `maxConcurrentPerHost`), govee (G-07: `defaultTransitionMs`)
**Status:** Two confirmed instances across different plugins. Warrants a codebase-wide grep of all `settingsSchema` field definitions vs their read sites.

### Pattern 8: `pluginConfig.update` without `upsert` — fails on fresh install
**Confirmed in:** govee (G-02)
**Suspected in:** Any plugin that writes to `PluginConfig` outside of `ctx.getSettings` / admin UI flow
**Root cause:** `update` requires the row to exist. On fresh install (before admin UI configures the plugin), no `PluginConfig` row exists. Silent failure when wrapped in try/catch.
**Potential fix:** All plugin writes to `PluginConfig` should use `upsert`. Could be enforced at the `createScopedDb` layer by intercepting `pluginConfig.update` and converting to `upsert`.

### Pattern 9: Raw DB reads of `PluginConfig.settings` bypassing `ctx.getSettings`
**Confirmed in:** govee (G-04)
**Suspected in:** Any plugin storing runtime state in the `settings` JSON blob alongside typed schema fields
**Root cause:** Plugins use `ctx.db.pluginConfig.findUnique` to read raw settings rather than `ctx.getSettings(schema)`. This bypasses type validation, default application, and any future encryption. Storing non-schema data in the settings blob creates fragile coupling.
**Potential fix:** Introduce a separate `metadata` column on `PluginConfig` (already exists — discord uses it for connection state) for runtime state that is not user-facing configuration. Reserve `settings` for schema-declared, admin-UI-visible configuration only.

---

## discord plugin

**Reviewed by:** 3 independent auditors, 1 cross-review round (asymmetric — see process note), 4 validated findings
**Reported coverage:** 96.69% statements / 88.34% branches (130 tests)
**Estimated meaningful coverage:** ~82% after accounting for uncovered error paths and unasserted side effects

**Process note:** Round 1 cross-review was asymmetric — Alpha saw Beta's report but not Gamma's, Beta saw Alpha's but not Gamma's, Gamma saw both. Original agents were cleaned up between rounds, so relaunched agents reasoned about claims abstractly rather than re-verifying against code. Findings marked "validated" were independently discovered by all 3 agents in Round 0 and confirmed in Round 1. Findings raised by fewer than 3 agents are listed as unvalidated leads.

### Validated Findings

#### D-01 [MAJOR] `reportBackgroundError` call paths are dead code to the test suite
**Category:** missing-test | **Triage:** SYSTEM

Both fire-and-forget `void ctx.sendToThread(...).catch()` blocks (lines 327-330 happy path, lines 353-356 P2002 retry path) call `ctx.reportBackgroundError('discord-pipeline', error)` when `sendToThread` rejects. The mock is declared (`reportBackgroundError: vi.fn()`) but never asserted. More critically, no test makes `ctx.sendToThread` reject — the mock always resolves. The `.catch()` callbacks are completely unreachable from the test suite.

**Impact:** If `sendToThread` rejection handling is broken (catch removed, wrong error type, wrong key string), pipeline failures for Discord messages are silently swallowed with no error reporting. The operator sees the message processed but no response, with no diagnostic signal.

**Pattern note:** Relates to fire-and-forget `.catch()` error reporting. If this pattern is used in other plugins (cron, delegation), those `.catch()` handlers may also be untested.

**Files:** `packages/plugins/discord/src/index.ts`, `packages/plugins/discord/src/__tests__/index.test.ts`

---

#### D-02 [MINOR] `send-discord-reply.ts` non-Error `channel.fetch` rejection branch uncovered
**Category:** missing-test | **Triage:** SYSTEM

Line 117: `err instanceof Error ? err.message : String(err)`. The test only uses `new Error('Unknown Channel')`. The `String(err)` fallback branch for non-Error rejections is unexercised. Branch coverage 96.15% on this file.

**Pattern note:** The `err instanceof Error ? ... : String(err)` defensive pattern appears throughout the codebase. If only the `Error` branch is tested everywhere, this is a systemic gap in branch coverage.

**Files:** `packages/plugins/discord/src/_helpers/send-discord-reply.ts`, `packages/plugins/discord/src/_helpers/__tests__/send-discord-reply.test.ts`

---

#### D-03 [MINOR] `settings-schema.test.ts` tests field metadata, not runtime behavior
**Category:** worthless-test | **Triage:** FUNDAMENTAL (Pattern 7 adjacent)

All three tests call `settingsSchema.toFieldArray()` and check properties (`type`, `secret`, `required`). None verify that `ctx.getSettings(settingsSchema)` returns correctly typed values at runtime. A field name typo in the schema definition would go undetected.

**Pattern note:** Likely the same pattern across all plugins with `settingsSchema`. If the schema test pattern was copy-pasted from a template, every plugin's schema tests may be equally shallow.

**Files:** `packages/plugins/discord/src/_helpers/__tests__/settings-schema.test.ts`

---

#### D-04 [MINOR] `send_dm` tool schema test asserts existence, not shape
**Category:** worthless-test | **Triage:** SYSTEM

The test asserts `tool?.description` is truthy and `tool?.schema` is defined, but does not check `required: ['message']` or verify property types. A schema with the required field accidentally removed would pass this test.

**Files:** `packages/plugins/discord/src/__tests__/index.test.ts`

---

### Unvalidated Findings (insufficient cross-review)

These were raised by 1-2 auditors but not independently verified against the code by all 3. Included as leads for future validation.

- **`client.user?.id` null guard untested (lines 242-245)** — Gamma only. Mock always has `user.id = 'bot-123'`. The guard protects against `messageCreate` firing before `ClientReady` during reconnects. Plausible MAJOR gap but Alpha/Beta never examined it.
- **Cron DM silent no-op when `assistantMsg?.content` is falsy** — Alpha/Beta raised, Gamma confirmed as MINOR. When the DB query returns null for the cron assistant message, proactive DM is silently skipped with no log. No test covers this branch.
- **Cron DM error path in `pipeline:complete` untested** — Alpha raised. The cron-specific catch block (lines 148-150) is separate from the `discord:send-dm` error path tested at line 1375.
- **`send_dm` tool handler has no try/catch** — Alpha/Beta raised as MAJOR, Gamma as MINOR. `sendProactiveDm` rejection propagates uncaught from the tool handler.
- **`ShardReconnecting` handler does not assert `reportStatus('degraded', ...)`** — Beta raised as MAJOR, Alpha/Gamma as MINOR.
- **`splitMessage` space-split test does not assert content preservation** — Alpha/Gamma raised.
- **`getSettings` call count in `reloadsAllowedChannels` is redundant** — Alpha/Gamma flagged; Beta disagreed. Not converged.
- **Register hook wiring tests assert types, not values** — Alpha only.

### Rejected Findings

- **`reportStatus` state transition sequence as flow test** — Alpha raised MAJOR. Beta/Gamma rejected: individual transitions covered separately.
- **DM fallback upsert `defaultAgentId` wiring** — Alpha raised MAJOR. Beta/Gamma rejected: guild tests cover the same module-level variable.
- **`onSettingsChange` reconnect + `allowedChannels` not tested together** — Beta raised MAJOR. Alpha/Gamma rejected: test at lines 824-873 covers this.
- **`channelId` mock inconsistency across test factories** — Alpha/Beta flagged. Gamma rejected: tests pass because `allowedChannels` is empty (correct default).
- **`mockLogin` call count fragility** — Alpha raised. Gamma rejected: test uses `toHaveBeenCalledWith`, not `toHaveBeenCalledTimes`.
- **`toHaveBeenCalledTimes(1)` on `mockSendDiscordReply`** — Alpha/Beta raised. Gamma rejected: deliberate sequence test with explicit mock clear.

---

## calendar plugin

**Reviewed by:** 3 independent auditors, 3 cross-review rounds (Round 0 independent, Round 1 cross-pollination, Round 2 dispute resolution), 2 validated findings + 1 likely valid

### Validated Findings (all 3 auditors independently read source and confirmed)

#### C-01 [MAJOR] `projectVirtualEvents` mass-deletes all events on empty batch
**Category:** null-path | **Triage:** SYSTEM

The delete query for each virtual event source (MEMORY, TASK, CRON) uses a ternary spread that collapses to an unfiltered `deleteMany` when the qualifying set is empty:

```typescript
await ctx.db.calendarEvent.deleteMany({
  where: { source: 'MEMORY', ...(memoryIds.length ? { externalId: { notIn: memoryIds } } : {}) },
});
```

When `memoryIds.length === 0`, this becomes `{ source: 'MEMORY' }` — deleting **every** MEMORY-sourced calendar event. Same pattern for TASK (line 87-89) and CRON (line 128-130). Fires every 30 minutes via projection timer. On a fresh install, quiet period, or when no memories exceed `importance >= 8`, all projected events are wiped.

One auditor initially retracted this as "intended reconciliation semantics" but reinstated after Round 2 re-read — empty-batch full-wipe is not correct reconciliation. The guard was intended to prune stale entries, not enable full purge on empty input.

**Files:** `packages/plugins/calendar/src/_helpers/project-virtual-events.ts`

---

#### C-02 [MAJOR] `sync_now` tool returns success before fire-and-forget sync completes
**Category:** contract-violation | **Triage:** FUNDAMENTAL (new pattern — see Pattern 10)

The `sync_now` MCP tool wraps all sync work in `void (async () => {...})()` and immediately returns `'Calendar sync triggered for all providers. Results will appear shortly.'`. Claude receives this string before any sync has started. If auth is expired, network is down, or DB is unreachable, the error is only logged via `ctx.logger.warn` — Claude has no mechanism to detect failure and will confidently report success to the user.

`reportProgress` calls inside the fire-and-forget block fire after the tool result is already delivered to the LLM, so they serve no purpose.

**Files:** `packages/plugins/calendar/src/index.ts` (sync_now tool handler)

---

### Likely Valid Findings (independently verified by 2+ auditors in Round 2, but only 1 round of cross-verification)

#### C-03 [MAJOR] Google incremental sync pagination sends both `syncToken` AND `pageToken`
**Category:** contract-violation | **Triage:** SYSTEM

The incremental sync pagination loop constructs continuation URLs with both parameters:

```typescript
url = data.nextPageToken
  ? `...events?pageToken=${encodeURIComponent(data.nextPageToken)}&syncToken=${encodeURIComponent(syncState.deltaLink)}&maxResults=250`
  : '';
```

Google Calendar API spec states `syncToken` and `pageToken` are mutually exclusive. `pageToken` alone is sufficient for continuation; `syncToken` should only appear on the first request. The full-sync pagination path correctly omits `syncToken` — only the incremental path has this bug.

Fires when >250 events changed since last sync (uncommon for personal calendars but realistic after a long offline gap or bulk import). Found by one auditor in Round 0, independently verified against source by all 3 in Round 2.

**Files:** `packages/plugins/calendar/src/_helpers/sync-google-calendars.ts` (line ~182)

---

#### C-04 [MAJOR — LATENT] `system: true` plugins receive stub `getSettings` that always returns `{}`
**Category:** contract-violation | **Triage:** FUNDAMENTAL (see Pattern 11)

In `buildPluginContext`, the `system: true` branch returns `{ ...context, reportStatus, reportBackgroundError }` without overriding `getSettings`. The base `context` object has `getSettings: async () => ({})` — a stub that always returns empty. Non-system plugins get the real `getPluginSettings` bound to their name.

The calendar plugin has `system: true` and does NOT currently call `ctx.getSettings()` (it reads OAuth tokens via `@harness/oauth` directly). So this is latent — no current breakage. But any developer adding settings-driven config to any `system: true` plugin will get silent empty returns with no error.

**Files:** `apps/orchestrator/src/orchestrator/index.ts` (buildPluginContext, system branch)

---

### Unvalidated Findings (insufficient cross-review)

These were raised by 1-2 auditors but not independently verified by all 3. Included for future audit reference.

- **`respondViaOutlook` bypasses `checkOutlookAuth`** — 2 auditors flagged. Calls `getValidToken` directly; raw exception propagates as error string instead of user-friendly `OUTLOOK_AUTH_ERROR`. MINOR.
- **`respondViaGoogle` `getUserEmail` returns `undefined`** — 2 auditors flagged. If OAuth metadata lacks `email` and Google doesn't set `self: true`, RSVP fails with misleading error. Mitigated by `a.self`. MINOR.
- **`update_event` TOCTOU** — All 3 flagged as MINOR. `findUnique` then `update` with no transaction; Prisma P2025 on concurrent delete. Low probability single-user.
- **`Promise.allSettled` in `onSettingsChange`/`start()` silently drops sync errors** — 2 auditors flagged. `allSettled` absorbs Outlook/Google failures; `catch` only covers `projectVirtualEvents`. MINOR observability gap.
- **`calendar:synced` broadcast shape inconsistent** — 2 auditors flagged. Outlook emits `{ upserted, cancelled }`, Google emits `{ provider: 'google', upserted, cancelled }`. MINOR.
- **`$orderby` percent-encoding via URLSearchParams** — 1 auditor insisted MAJOR, 2 dropped it. Disputed whether Graph API accepts `%24orderby`. Needs empirical test.

### Rejected Findings

- **`syncing` module-level flag gets permanently stuck** — All 3 confirmed `try/finally` guarantees reset. Not a bug.
- **Cross-coupling to `agentMemory`/`userTask`/`cronJob`** — `system: true` grants unsandboxed DB by design. Calendar explicitly projects virtual events from these models.
- **`start()` timer races with initial sync** — The `syncing` module-level guard handles this correctly. Working as designed.
- **Concurrent `onSettingsChange` timer doubling** — `startSyncTimer` calls `stopSyncTimer()` as first line. Guard prevents accumulation.

---

## Cross-Plugin Pattern Issues (updated with calendar findings)

### Pattern 10: Fire-and-forget in MCP tool handlers — tool lies to Claude
**Confirmed in:** calendar (C-02: `sync_now`)
**Suspected in:** Any plugin tool handler using `void (async () => {...})()` and returning a success string before the async work completes
**Root cause:** Tool handlers return a string/ToolResult to Claude synchronously. If the actual work is detached into a fire-and-forget closure, Claude receives a success confirmation before the work has started, let alone completed. Claude has no retry or follow-up mechanism — the tool result is the agent's only signal.
**Distinction from Pattern 2:** Pattern 2 (blocking notify hooks) is about hooks being too slow. Pattern 10 is about tool handlers being dishonestly fast — returning "done" before doing the work. Both stem from misuse of fire-and-forget, but the fix is different: hooks should fire-and-forget expensive work; tools should NOT.
**Potential fix:** Lint rule or contract documentation: tool handlers must `await` their work before returning. If the work is genuinely long-running, return an honest message and provide a status-check tool.

### Pattern 11: `system: true` silently disables `getSettings`
**Confirmed in:** calendar (C-04 — latent, not currently exercised)
**Affected:** ALL current and future `system: true` plugins
**Root cause:** `buildPluginContext` in the orchestrator has two branches. The non-system branch overrides `getSettings` with the real `getPluginSettings` implementation. The system branch does not — it inherits the base context's stub `getSettings: async () => ({})`. This was likely an oversight, not intentional.
**Potential fix:** Add `getSettings` override to the system branch in `buildPluginContext`. One-line fix in the orchestrator.

### Pattern 12: Fire-and-forget `sendToThread` `.catch()` error reporting untested
**Confirmed in:** discord (D-01)
**Suspected in:** cron (sendToThread in trigger handler), delegation (background delegation loop)
**Root cause:** `sendToThread` is mocked to always resolve in test suites. The `.catch()` handler that calls `reportBackgroundError` is dead code to every test that uses this mock. Pipeline failures for externally-triggered messages (Discord, cron) are silently unobservable.
**Potential fix:** Each plugin that uses fire-and-forget `sendToThread` needs at least one test where the mock rejects, asserting `reportBackgroundError` is called with the correct arguments.

### Pattern 13: `err instanceof Error` defensive ternary — only Error branch tested
**Confirmed in:** discord (D-02: `send-discord-reply.ts` line 117)
**Suspected in:** Every catch block using `err instanceof Error ? err.message : String(err)`
**Root cause:** Tests always reject with `new Error(...)`. The `String(err)` fallback for non-Error rejections is systematically untested across the codebase.
**Potential fix:** Codebase-wide grep for `instanceof Error ? .* : String` to identify all instances. Add at least one non-Error rejection test per catch site.

### Pattern 14: `settingsSchema` tests assert metadata shape, not runtime `getSettings` behavior
**Confirmed in:** discord (D-03)
**Suspected in:** Every plugin with a `settings-schema.test.ts` file
**Root cause:** Schema tests were likely generated from a template that only checks `toFieldArray()` output. None call `ctx.getSettings(schema)` to verify the schema produces correct typed values at runtime. A field name mismatch between schema definition and consuming code would go undetected.
**Potential fix:** Update the schema test template to include at least one test that calls `ctx.getSettings(schema)` with mock DB data and asserts the returned object has the expected typed fields.

---

## storytelling plugin

**Reviewed by:** 3 independent auditors, 3 adversarial rounds + 1 independent source verification round. All 14 findings independently confirmed against source code by all 3 auditors.

**Plugin profile:** 21 MCP tools, 3 hooks (onMessage, onBeforeInvoke, onAfterInvoke), start/stop lifecycle. Position 5 of 26 in ALL_PLUGINS (after contextPlugin, before workspacePlugin). No settingsSchema. Not a system plugin.

### Validated Findings

#### ST-01 [MAJOR] onAfterInvoke blocks pipeline — awaits extractStoryState
**Category:** contract-violation | **Triage:** FUNDAMENTAL

`onAfterInvoke` at `index.ts:174` does `await extractStoryState(...)` — a full Claude sub-invocation (Haiku/Opus) plus sequential DB writes. The hook runner (`run-hook.ts`) awaits each hook sequentially, so the entire `onAfterInvoke` phase blocks until extraction finishes. Every downstream plugin (metrics, summarization, auto-namer) waits. The user-visible `pipeline:complete` broadcast does not fire until extraction returns.

**Pattern:** The documented fire-and-forget pattern used by identity, summarization, and auto-namer plugins wraps expensive work in `void (async () => { try { await work(); } catch (e) { log(e); } })();`. This plugin does not use that pattern.

**Impact:** 10-60s added to every storytelling response before the user sees it.

#### ST-02 [MAJOR] onAfterInvoke fires extraction on story-import threads
**Category:** contract-violation | **Triage:** SYSTEM

`onBeforeInvoke` writes `storyId` to `storyCache` at `index.ts:100` unconditionally for all thread kinds, including `story-import`. It then early-returns for `story-import` at line 109 without injecting story instructions. However, `onAfterInvoke` at line 158 only checks `storyCache.get(threadId)` — no thread kind filter. For import threads with a non-null `storyId`, extraction fires against tool-output text ("Processed 3 chunks, extracted 47 moments..."), not story prose.

**Impact:** Wasted Haiku/Opus tokens on nonsensical extraction. May write spurious moments/characters from operational status strings.

#### ST-03 [MAJOR] applyExtraction 'judge' action falls through to create
**Category:** null-path | **Triage:** SYSTEM

`resolveCharacterIdentity` (resolve-character-identity.ts:32-34) returns `{ action: 'judge', candidates }` when similarity score is 0.65–0.85 (ambiguous match). In `apply-extraction.ts:63-101`, only `action === 'merge'` has a handler. Line 100 comment: `// For 'judge' action, fall through to create (LLM judge wired at higher level later)`. The code falls through to upsert at line 111, creating a new character record instead of flagging for disambiguation.

**Impact:** Characters with similar-but-not-identical names accumulate as separate records over time. The dedup system identifies them as ambiguous but has no mechanism to resolve them.

#### ST-04 [MAJOR] import_document marks processed:true after silent chunk-parse failures
**Category:** null-path | **Triage:** SYSTEM

When `parseImportExtractionResult` returns null for a chunk, `tool-import-document.ts:117` does `continue` — silently skipping the chunk. After the loop, line 162 unconditionally marks `processed: true` with `processedThrough = chunks.length - 1`. Unlike `import_transcript` (which writes `processedThrough: i` per chunk and does NOT mark `processed: true` on failure), `import_document` has no per-chunk progress cursor and no recovery path.

**Impact:** A document with unparseable chunks is permanently sealed as fully processed. Content from failed chunks is silently lost.

#### ST-05 [MAJOR] lastExtractionAt dedup guard set before extraction completes
**Category:** race-condition | **Triage:** SYSTEM

`index.ts:173` sets `lastExtractionAt.set(dedupKey, Date.now())` before `await extractStoryState` at line 174. The catch block at line 176 deletes the key on failure, enabling retry. However, `extractStoryState` performs sequential DB writes (characters, locations, moments, scene updates) without a transaction. If it throws mid-way, partial records exist but the guard is cleared — the next extraction re-runs against the same output, potentially duplicating moments (which use bare `create`, not upsert).

**Impact:** Partial extraction failure followed by retry can produce duplicate moment records. Characters and locations are safe (upsert), but moments are not idempotent.

#### ST-06 [MAJOR] Qdrant backfill hardcoded take:500, no pagination
**Category:** null-path | **Triage:** SYSTEM

`start()` at `index.ts:731` loads characters with `take: 500` and no pagination. No where-filter either — first 500 characters across all stories by insertion order. Characters beyond 500 are never indexed. No log warns that the backfill was truncated. Every restart re-indexes the same 500 characters with no idempotency check.

**Impact:** Stories with >500 characters have permanently degraded similarity search. `findSimilarCharacters` returns false negatives, causing duplicate character creation instead of merges.

#### ST-07 [MAJOR] start() pre-warms wrong model
**Category:** race-condition | **Triage:** SYSTEM

`start()` at `index.ts:713` calls `ctx.invoker.prewarm` with `model: 'claude-sonnet-4-6'`. Actual extraction uses `EXTRACTION_MODEL` from `extraction-config.ts` (Opus 4.5). The session pool is keyed by model — the Sonnet session is never used by extraction. It sits idle until TTL eviction, providing zero benefit.

**Impact:** First extraction call pays full cold-start latency. A warm session is created and wasted.

#### ST-08 [MAJOR] import_transcript loads world-state once; stale for later chunks
**Category:** null-path | **Triage:** SYSTEM

`tool-import-transcript.ts:57-72` loads characters, locations, and story state once before the batch loop (up to 5 chunks per call). `applyExtraction` may create new characters/locations during earlier chunks, but the arrays passed to `buildImportExtractionPrompt` for later chunks are stale. Only `recentMoments` is refreshed per-chunk (lines 94-103). The same issue exists in `import_document` for characters.

**Impact:** Characters from chunk 1 are invisible to chunks 2-5's extraction prompt, causing duplicate character creation within a single batch. Qdrant similarity partially mitigates (merge resolution), but newly indexed characters may not be searchable yet due to fire-and-forget indexing (ST-06 pattern).

#### ST-09 [MAJOR] handleAddLocation uses bare create — P2002 on duplicates
**Category:** null-path | **Triage:** SYSTEM

`tool-add-location.ts:30` uses `db.storyLocation.create()` with no upsert and no try/catch. The `StoryLocation` table has a unique constraint on `storyId_name`. Calling `add_location` with an existing location name throws an unhandled Prisma P2002 error that surfaces as a raw tool failure to Claude. Compare with `applyExtraction.ts:152` which correctly uses `upsert`.

**Impact:** Agent calling `add_location` for an existing location gets an unformatted Prisma error. May retry the same call repeatedly.

#### ST-10 [MINOR] storyCache null-sentinel conflation in onMessage
**Category:** null-path | **Triage:** SYSTEM

`storyCache` stores `null` for "no story" and `Map.get()` returns `undefined` for cache miss. `onMessage` at line 57 correctly checks `storyId === undefined` to trigger a DB lookup. But once `null` is cached, `onMessage` skips the lookup even if `storyId` was later assigned to the thread. `onBeforeInvoke` self-heals the cache every pipeline run (line 100 always does a fresh DB lookup), so `onAfterInvoke` always sees the current value. The real bug is narrower than originally claimed: `onMessage`'s OOC command path silently skips for one pipeline run if storyId was just assigned.

**All 3 auditors initially rated CRITICAL but downgraded after independently verifying that `onBeforeInvoke` refreshes the cache every pipeline run.**

#### ST-11 [MINOR] cachedSoul module-level, never invalidated mid-process
**Category:** null-path | **Triage:** FUNDAMENTAL

`extraction-config.ts` caches the `safe-space` agent's soul in a module-level variable after first load. If the soul is updated in the database, the cached value persists until orchestrator restart. `stop()` calls `_resetExtractionCache()` but that only fires on shutdown. No `onSettingsChange` hook to detect agent updates. Additionally, if the `safe-space` agent doesn't exist, `cachedSoul` stays `null` — no negative caching — causing a DB query on every extraction call.

**Pattern cross-reference:** This is the same module-level mutable state pattern flagged in notifications (F-01). Any plugin caching config/state in module-level variables without invalidation is vulnerable.

#### ST-12 [MINOR] detect_duplicates and discover_arc_moments swallow parse errors
**Category:** null-path | **Triage:** SYSTEM

Both tools catch JSON parse failures per-batch with a bare `catch {}` (log warning only). If ALL batches fail, the tool returns "No duplicates found" / "No related moments found" — indistinguishable from a true empty result. The agent has no signal that the scan failed vs. found nothing.

**Files:** `tool-detect-duplicates.ts:91-103`, `tool-discover-arc-moments.ts:121-134`

#### ST-13 [MINOR] buildCastInjection missing deletedAt:null filter on moments
**Category:** null-path | **Triage:** SYSTEM

`build-cast-injection.ts:39-44` queries `storyMoment.findMany({ where: { storyId } })` with no `deletedAt: null` filter. Soft-deleted moments (merged/discarded via `merge_moments`) are included in the `allMoments` array passed to `deriveCharacterKnowledge`. Compare with `tool-detect-duplicates.ts:28` and `tool-discover-arc-moments.ts:74` which both correctly filter on `deletedAt: null`.

**Impact:** Characters appear to "know" events from moments that were intentionally removed/merged. Grows worse as merge operations accumulate.

#### ST-14 [MINOR] Hardcoded model strings across multiple files
**Category:** cross-coupling | **Triage:** FUNDAMENTAL

`extract-story-state.ts` and `judge-character-match.ts` hardcode `'claude-haiku-4-5-20251001'`. `index.ts:713` hardcodes `'claude-sonnet-4-6'`. `extraction-config.ts` exports `EXTRACTION_MODEL` as a constant but not all callers use it. When model identifiers change (version rotation, deprecation), these callers silently break.

**Pattern cross-reference:** Any plugin hardcoding model names instead of using `ctx.config.claudeModel` or a centralized constant is vulnerable.

### Findings Rejected During Review

- **handleMergeMoments TOCTOU** — Rejected unanimously (3/3). Single-user sequential pipeline makes concurrent merge operations impossible. The alleged race between existence check and soft-delete has no realistic concurrent caller.
- **onBeforeInvoke chain hook errors** — Rejected. `run-chain-hook.ts` keeps the previous value on error by design. This is the correct safe behavior documented in the plugin contract.
- **onMessage DB lookup not cached on null miss** — Rejected. Line 63 explicitly caches null. The behavior is correct (the null-sentinel issue is a separate finding, ST-10).
- **prewarm returns void, no .catch() needed** — Rejected. `prewarm` is typed as returning `void`, not a Promise.
- **deepScan causes infinite tool loop** — Rejected by 2/3. The flag is silently ignored; no loop mechanism exists. The tool returns the same result regardless of the flag value. (deepScan being unimplemented is noted in ST-03's judge fallthrough as part of the broader "incomplete feature" pattern, not as a standalone finding.)

### Cross-Plugin Patterns Identified

#### Pattern: onAfterInvoke used for blocking work
**Confirmed in:** storytelling (ST-01)
**Suspected in:** Any plugin that awaits expensive operations in onAfterInvoke
**Root cause:** `run-hook.ts` awaits every hook sequentially. The contract says onAfterInvoke is "notification only" but nothing prevents plugins from awaiting expensive work. The pattern should be documented with a lint rule or runtime warning.
**Potential fix:** Add a timeout guard to `run-hook.ts` for notification hooks, or document the fire-and-forget pattern in the plugin contract as a MUST (not SHOULD).

#### Pattern: Module-level mutable state without invalidation
**Confirmed in:** storytelling (ST-11: cachedSoul), notifications (F-01: currentSettings/ttsProvider)
**Suspected in:** Any plugin caching DB-derived state in module-level variables
**Root cause:** Plugins cache config/state for performance but have no invalidation mechanism beyond `stop()`. `onSettingsChange` is available but not all plugins use it for their cached state.
**Potential fix:** Establish a convention: module-level caches must either (a) have a TTL, (b) be refreshed via `onSettingsChange`, or (c) be documented as restart-required.

#### Pattern: Hardcoded model identifiers
**Confirmed in:** storytelling (ST-14: 3 files), suspected across codebase
**Root cause:** Model names are string literals scattered across plugin code. No central constant or config-driven approach.
**Potential fix:** `ctx.config` could expose model presets (e.g., `ctx.config.models.fast`, `ctx.config.models.extraction`) so plugins don't embed version-specific strings.

#### Pattern: Missing deletedAt:null on soft-delete queries
**Confirmed in:** storytelling (ST-13: buildCastInjection)
**Suspected in:** Any query on tables with soft-delete columns (storyMoment, potentially others)
**Root cause:** Soft-delete is opt-in per query. No Prisma middleware or default scope enforces it. Easy to forget on new queries.
**Potential fix:** Add a Prisma middleware that auto-adds `deletedAt: null` to all `findMany` on models with a `deletedAt` field, with an explicit `{ includeDeleted: true }` escape hatch.

#### Pattern: Batch processing without per-chunk progress cursors
**Confirmed in:** storytelling (ST-04: import_document has no per-chunk cursor; ST-08: stale world-state)
**Root cause:** `import_document` was written without the per-chunk `processedThrough` update that `import_transcript` has. The two import paths diverged in implementation quality.
**Potential fix:** Extract a shared `processBatchWithCursor` helper that both import tools use, enforcing per-chunk progress writes and world-state refresh.

---

## intent plugin

**Reviewed by:** 3 independent auditors, 1 cross-review round (Round 0 independent + Round 1 cross-pollination). Only findings independently discovered by all 3 auditors in Round 0 are validated. Round 2+ counter-review was not performed — findings from Round 1 cross-pollination are listed as unvalidated.

**Plugin profile:** Custom `onIntentClassify` early-return hook (not in standard `PluginHooks`), no MCP tools, start/stop lifecycle. Position 1 of 26 in ALL_PLUGINS (first registered, runs before all others). No settingsSchema. Not a system plugin. Uses `@harness/vector-search` embeddings for intent classification with a 0.78 confidence threshold.

### Validated Findings

#### IN-01 [CRITICAL] Module-level `pluginCtx` null race between guard and `!` assertions
**Category:** race-condition | **Triage:** FUNDAMENTAL

`pluginCtx` and `registry` are module-level `let` variables. `stop()` sets both to `null`. `handleIntentClassify` guards with `if (!registry || !pluginCtx?.executeTool)` at entry (optional chaining — safe), but subsequent lines use `pluginCtx!` with non-null assertions: line 69 (`pluginCtx!.executeTool!`), line 73 (`pluginCtx!.logger.warn`), line 86 (`pluginCtx.logger.info`). If `stop()` fires during the `await Promise.all()` at line 49, `pluginCtx` becomes null between the guard and the assertions. The catch block at line 73 also uses `pluginCtx!`, so the error handler itself crashes — swallowing the original error.

**Pattern cross-reference:** Same module-level mutable state pattern as notifications F-01 and storytelling ST-11. This is the third independent confirmation of Pattern 1. The intent plugin's variant is more severe because the non-null assertions (`!`) convert a nullable race into an unhandled `TypeError`, whereas other plugins use optional chaining or null checks that degrade gracefully.

**Files:** `packages/plugins/intent/src/index.ts`

---

#### IN-02 [MAJOR] `lights.toggle` intent drops room slot — always sends empty input
**Category:** null-path | **Triage:** SYSTEM

`extractSlots` dispatches on intent name via a switch statement. There is no `case 'lights.toggle':` — it falls to `default: return {}`. The `extractLightsSlots` function (which extracts the room name) is never called for this intent. `mapSlotsToInput` does have a `lights.toggle` case that maps `slots.room` to `input.device`, but since slots is always `{}`, `govee__toggle_light` is called with no device target. "Toggle the office lights" toggles an unspecified device or fails, depending on govee plugin behavior.

**Files:** `packages/plugins/intent/src/_helpers/extract-slots.ts`, `packages/plugins/intent/src/_helpers/map-slots-to-input.ts`

---

#### IN-03 [MAJOR] Partial compound-utterance success silently drops failed sub-actions
**Category:** null-path | **Triage:** SYSTEM

For compound utterances ("turn on lights and play jazz"), both tool calls run in `Promise.all`. If one succeeds and one fails (returns null), `successfulResults.filter(r => r !== null)` produces a length-1 array. The guard `if (successfulResults.length === 0)` passes — only total failure triggers LLM fallback. The handler returns `{ handled: true }` with only the successful result, silently discarding the failed action. The comment at line 79 says "If any tool failed, fall through to LLM" but the code does the opposite.

**Files:** `packages/plugins/intent/src/index.ts`

---

#### IN-04 [MAJOR] Unrecognized `music.control` actions silently invoke `pause`
**Category:** null-path | **Triage:** SYSTEM

The `music.control` intent lists "turn it up", "turn down the volume", and "mute" as example utterances. None of these match any pattern in `extractMusicControlSlots` — the volume regex requires a literal number (`/\bvolume\b.*?(\d+)/`), and there are no mute/louder/quieter patterns. All return `{}` (no action slot). In `handleIntentClassify`, when `intentSlots.action` is undefined, `resolveMusicTool` is not called and `toolName` stays as the default `'pause'` from `intent-definitions.ts`. User says "turn it up" → `music__pause` fires. The music stops instead of getting louder.

**Files:** `packages/plugins/intent/src/_helpers/extract-slots.ts`, `packages/plugins/intent/src/_helpers/map-slots-to-input.ts`, `packages/plugins/intent/src/_helpers/intent-definitions.ts`

---

### Unvalidated Findings (insufficient cross-review)

These were raised during Round 1 cross-pollination by 1-2 auditors and adopted by others, but were never independently counter-reviewed through the full adversarial loop. Included for reference but require further validation.

- **Fast-path bypasses `onMessage`/`onPipelineComplete`** — Alpha found, Beta and Gamma adopted in Round 1. When `onIntentClassify` returns `handled: true`, the orchestrator exits `sendToThread` before `handleMessage`. `onMessage` never fires (auto-namer broken for fast-path threads), `onPipelineComplete` never fires (activity plugin writes orphaned `pipeline_start` records). **If validated, triage: FUNDAMENTAL** — this is an orchestrator-level gap, not a plugin bug.
- **`start()` `reportStatus('degraded')` overwritten by orchestrator** — Beta found, Alpha accepted, Gamma rejected. When `createIntentRegistry` fails, `start()` catches the error and calls `ctx.reportStatus('degraded')` without rethrowing. The orchestrator's start loop then calls `statusRegistry.report(name, 'healthy')` unconditionally after `start()` returns. **If validated, triage: FUNDAMENTAL** — affects any plugin that catches errors in `start()` and self-reports degraded status.
- **Centroid not re-normalized after averaging** — All 3 flagged independently but as MINOR. The centroid computed from L2-normalized unit vectors is not re-normalized, causing the 20% centroid component of the blended score to be systematically underweighted for semantically diverse intents.
- **`splitUtterance` splits "and" inside titles** — "play rock and roll" → `["play rock", "roll"]`. Usually falls below threshold (graceful degradation) but adds unnecessary embedding latency.
- **`executeTool` absence produces silent fallthrough** — `executeTool` is optional on `PluginContext`. If absent, the plugin silently no-ops with no warning. Production always provides it, but test harnesses may not.
- **`cosineSimilarity` doesn't guard mismatched dimensions** — If vector lengths differ, `b[i]` returns `undefined`, producing `NaN` scores. No realistic production trigger but no defensive guard.
- **Degraded-state fallthrough indistinguishable from low-confidence in logs** — When `registry` is null, `handleIntentClassify` returns `{ handled: false }` with no log. Indistinguishable from normal LLM routing.
- **Empty `examples` array produces inert registry entry** — An `IntentDefinition` with `examples: []` creates an entry that scores `-Infinity` and never wins classification. Silently accepted, no startup warning.

### Rejected Findings

- None formally rejected — all Round 0 findings were independently confirmed. Round 1 findings were not subjected to adversarial counter-review.

### Cross-Plugin Patterns Identified

#### Pattern: Non-null assertions on module-level state after async suspension
**Confirmed in:** intent (IN-01: `pluginCtx!` after `await Promise.all`)
**Cross-reference:** Pattern 1 (module-level mutable state). The intent plugin's variant is specifically about using TypeScript `!` assertions on nullable module-level state after `await` points. This is a stricter sub-pattern: even plugins that correctly use optional chaining in guards can crash if they later use `!` on the same reference after an async suspension point.
**Potential fix:** Lint rule: ban `!` assertions on module-level variables in async functions. Instead, capture to a local `const` after the null guard.

#### Pattern: Slot extraction / tool resolution coverage gaps in intent router
**Confirmed in:** intent (IN-02: lights.toggle missing, IN-04: music.control examples without extraction)
**Root cause:** `INTENT_DEFINITIONS` defines intents with example utterances and a default tool, but `extractSlots` and `resolveMusicTool` are separate switches that must be kept in sync manually. There is no compile-time or runtime check that every intent defined in `INTENT_DEFINITIONS` has a corresponding extraction case.
**Potential fix:** Either (a) co-locate slot extraction with intent definitions (each `IntentDefinition` carries its own `extractSlots` function), or (b) add a startup validation step in `createIntentRegistry` that warns when an intent has no extraction case.

#### Pattern: Comment-code divergence in error handling
**Confirmed in:** intent (IN-03: comment says "any tool failed" but code checks "all tools failed")
**Root cause:** Implementation changed without updating the inline comment. The comment describes the intended behavior; the code implements something different.
**Potential fix:** Not a systemic pattern — flagged for awareness. Code review discipline.
