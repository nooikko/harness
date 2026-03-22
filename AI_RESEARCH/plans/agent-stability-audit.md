# Agent & Sub-Agent Stability Audit

**Date:** 2026-03-17
**Status:** In progress — findings identified, fixes pending
**Overall:** Moderately stable for single-user, low-concurrency use. Fundamental concurrency flaw in contextRef.

---

## CRITICAL

### C1. Shared mutable `contextRef` creates cross-thread contamination under concurrency
- **Files:** `apps/orchestrator/src/index.ts` (line 58), `apps/orchestrator/src/tool-server/index.ts` (lines 54-57)
- **Problem:** The entire orchestrator shares a single `contextRef` object (`{ ctx, threadId, pendingBlocks }`). When `handleMessage` calls `setActiveThread(threadId)`, it mutates this shared ref. If two pipelines run concurrently (user message + cron job, overlapping delegations), the second overwrites the first's threadId. Tool calls from pipeline A get pipeline B's threadId.
- **Affects:** `threadId`, `traceId`, `taskId`, `pendingBlocks` — all shared mutable state.
- **Risk:** Tool calls execute against wrong thread. Delegation checkins go to wrong parent. Memory writes land on wrong agents.
- **Fix direction:** Make `contextRef` per-session rather than global. Pass threadId/traceId through the SDK message protocol instead of mutable shared state.
- **Status:** [x] Complete — per-request meta on session queue, drainQueue activation
- **Needs full plan:** Yes → DONE (`.claude/plan/c1-c2-context-isolation.md`)

### C2. `mcpServerFactory` creates tool servers sharing the same `contextRef`
- **Files:** `apps/orchestrator/src/index.ts` (line 72)
- **Problem:** Every new session created by the pool calls `mcpServerFactory()`, creating a new MCP server instance — but all share the same `contextRef`. No path to fixing C1 without also changing this factory.
- **Risk:** Same as C1, multiplied by session pool size (max 5).
- **Fix direction:** Factory should accept a per-session context ref, or tool server should accept threadId per invocation.
- **Status:** [x] Complete (same fix as C1)
- **Needs full plan:** Yes (combined with C1) → DONE

---

## HIGH

### H1. No concurrency guard on delegation — unlimited parallel delegations
- **File:** `packages/plugins/delegation/src/index.ts` (lines 89-98)
- **Problem:** `runDelegationLoop(...).catch(...)` is fire-and-forget with no limit. `maxConcurrentAgents` (default 3) is defined in `OrchestratorConfig` but never enforced by delegation or session pool.
- **Risk:** Resource exhaustion, unbounded Claude API calls, cost runaway.
- **Fix direction:** Add semaphore in delegation tool handler respecting `config.maxConcurrentAgents`. Return error to Claude when limit reached.
- **Status:** [x] Complete — `createDelegationSemaphore` + `.finally(release)` in tool handler
- **Needs full plan:** No — straightforward semaphore

### H2. Validator reuses sub-agent's session pool slot (model mismatch churn)
- **File:** `packages/plugins/validator/src/index.ts` (line 47)
- **Problem:** Validator passes task `threadId` as pool key. Uses Opus while sub-agent uses Sonnet. Pool closes existing session, creates new one. Next iteration does the same.
- **Risk:** ~2-5s extra latency per delegation iteration from session churn.
- **Fix direction:** Use distinct pool key for validator (e.g., `validator-${threadId}`) or omit threadId.
- **Status:** [x] Complete — `validator-${threadId}` pool key
- **Needs full plan:** No — one-line fix

### H3. Session pool eviction race (TOCTOU)
- **File:** `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts` (lines 76-104)
- **Problem:** Eviction timer can close a session between `get()` returning and caller using it. Single-threaded Node mitigates but doesn't eliminate (microtask ordering).
- **Risk:** Potential "Session closed" errors under load.
- **Fix direction:** Add retry-on-stale in invoker, or liveness wrapper on returned sessions.
- **Status:** [x] Complete — single retry on `"Session is closed"` in invoker catch block
- **Needs full plan:** No — small defensive change

### H4. `sendToThread` broadcast error path — fragile safety
- **File:** `apps/orchestrator/src/orchestrator/index.ts` (lines 131-134)
- **Problem:** Currently safe only because `runHook` swallows errors. If hook runner changes, pipeline breaks on broadcast failure.
- **Risk:** Latent — correct today, fragile tomorrow.
- **Fix direction:** Add explicit try/catch around broadcast in sendToThread, or document the runHook contract.
- **Status:** [x] Complete — defensive try/catch around broadcast in sendToThread
- **Needs full plan:** No — defensive wrapping

### H5. Orphan recovery misses `evaluating` and `pending` states
- **File:** `apps/orchestrator/src/_helpers/recover-orphaned-tasks.ts` (line 20)
- **Problem:** Only recovers `status: 'running'`. Tasks that crashed while `evaluating` or `pending` stay stuck forever.
- **Risk:** Stale tasks visible in admin UI, never cleaned up.
- **Fix direction:** Expand query to `status: { in: ['running', 'evaluating', 'pending'] }`.
- **Status:** [x] Complete — expanded to include all non-terminal states
- **Needs full plan:** No — one-line fix

### H6. `scoreAndWriteMemory` fire-and-forget swallows errors silently
- **File:** `packages/plugins/identity/src/index.ts` (line 118)
- **Problem:** `void scoreAndWriteMemory(...)` discards promise. DB errors become unhandled rejections with no context.
- **Risk:** Silent memory write failures, hard to debug.
- **Fix direction:** Add `.catch()` with threadId/agentId context logging.
- **Status:** [x] Complete — `.catch()` with agent/thread context logging
- **Needs full plan:** No — add .catch()

---

## MEDIUM

### M1. `DEFAULT_COST_CAP_USD` reads wrong env var name
- **File:** `packages/plugins/delegation/src/_helpers/delegation-loop.ts` (line 16)
- **Problem:** Reads `costCapUsd` (camelCase), docs say `DELEGATION_COST_CAP_USD`. Settings schema also provides `costCapUsd` per-invocation, making the env var a dead fallback.
- **Fix:** Remove env var fallback or align naming.
- **Status:** [x] Complete — removed dead env var fallback, hardcoded default 5

### M2. Delegation shares main session pool (max 5)
- **File:** `packages/plugins/delegation/src/_helpers/invoke-sub-agent.ts` (line 22)
- **Problem:** 3 delegations + main + cron = 5 sessions at capacity. 6th triggers LRU eviction of active session.
- **Fix:** Separate invoker instance for delegation, or increase pool size.
- **Status:** [x] Complete — bumped pool from 5 to 8

### M3. Identity plugin loads agent twice per pipeline
- **File:** `packages/plugins/identity/src/index.ts` (lines 63, 107)
- **Problem:** Both `onBeforeInvoke` and `onAfterInvoke` call `loadAgent()` independently = 4 DB queries.
- **Fix:** Cache agent per-pipeline or pass through hook context.
- **Status:** [x] Complete — `agentCache` Map populated in onBeforeInvoke, consumed in onAfterInvoke

### M4. `parseVerdict` regex can match in explanation text
- **File:** `packages/plugins/validator/src/_helpers/parse-verdict.ts` (lines 6-7)
- **Problem:** `VERDICT: PASS` regex matches anywhere in response, not just the actual verdict line.
- **Fix:** Anchor to last occurrence or parse from end.
- **Status:** [x] Complete — uses `matchAll` + `.at(-1)` for last occurrence

### M5. `onPipelineComplete` fires before assistant text persisted
- **File:** `apps/orchestrator/src/orchestrator/index.ts` (lines 99-119)
- **Problem:** Intentional for createdAt ordering, but trap for future plugin authors who query DB in this hook.
- **Fix:** Document clearly in plugin-contract or add note to hook type.
- **Status:** [x] Complete — JSDoc on `onPipelineComplete` in plugin-contract

### M6. `createSession` error path doesn't call `q.close()` — zombie processes
- **File:** `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` (lines 92-102)
- **Problem:** On consume loop error, `q.close()` is never called. SDK subprocess may linger as zombie.
- **Fix:** Call `q.close()` in catch block.
- **Status:** [x] Complete — `q.close()` added to catch block

### M7. Delegation loop logic-error reports wrong iteration count
- **File:** `packages/plugins/delegation/src/_helpers/delegation-loop.ts` (lines 95-98)
- **Problem:** After `break` on logic-error, failure notification reports `maxIterations` instead of actual count.
- **Fix:** Pass actual `iterations` variable to failure path.
- **Status:** [x] Complete — all failure paths now use `iterations` instead of `maxIterations`

---

## LOW

### L1. `extractResult` model detection by highest token count — may misattribute
- **File:** `apps/orchestrator/src/invoker-sdk/_helpers/extract-result.ts` (lines 10-20)
- **Status:** [ ] Not started

### L2. `buildScoringSnippet` overlap at 500-char boundary
- **File:** `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` (line 36)
- **Status:** [ ] Not started

### L3. `retrieveMemories` non-idempotent (updates `lastAccessedAt` on read)
- **File:** `packages/plugins/identity/src/_helpers/retrieve-memories.ts` (lines 109-113)
- **Status:** [ ] Documented behavior — no fix needed

### L4. Nested fire-and-forget in reflection — double unhandled rejection risk
- **File:** `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` (lines 139-144)
- **Fix:** Add `.catch()` to reflection IIFE.
- **Status:** [ ] Not started

### L5. No timeout on validator Opus invocation
- **File:** `packages/plugins/validator/src/index.ts` (line 44)
- **Fix:** Add 60s timeout for validation calls.
- **Status:** [ ] Not started

---

## Suggested Fix Order

1. **C1+C2** — contextRef per-session (requires full plan, largest change)
2. **H1** — delegation concurrency guard (semaphore)
3. **H5** — orphan recovery expansion (one-line)
4. **H6 + L4** — fire-and-forget .catch() additions
5. **H2** — validator pool key fix (one-line)
6. **M6** — zombie process cleanup
7. **H3** — session pool retry
8. **H4** — broadcast error guard
9. **M1-M5, M7** — medium fixes (batch)
10. **L1, L2, L5** — low fixes (batch)
