# Implementation Analysis: Gap Remediation in Current Codebase
Date: 2026-03-01
Based on: 2026-03-01-industry-gap-analysis-agent-orchestration.md + 5-agent deep code review

This document translates each gap from abstract research into concrete codebase findings with specific
file:line references, a clear "current vs. target" description, and a sequenced implementation queue.

Security (Gap E) is deferred — homelab, closed environment, not a priority now.
Evals (Gap D) and Prompt Versioning (Gap G) are medium priority, deferred to after core infrastructure.

---

## What the Agents Found: Concrete Codebase State

### Gap H — Structured Output (Command Routing)

**Current code path:**
- `apps/orchestrator/src/orchestrator/_helpers/parse-commands.ts` — regex `/^\s*\/([a-z][a-z0-9-]*)\s*(.*)/gm`
  applied to Claude's raw text output (Step 6 of handleMessage)
- `/delegate` IS already registered as MCP tool `delegation__delegate` in the delegation plugin
- Claude CAN call it as a real tool_use — and the SDK DOES route the call to the handler
- But: the orchestrator only looks at `invokeResult.output` (text). It NEVER inspects `streamEvents`
  for tool_call events. The tool executes, then text is ALSO parsed. Two paths, not coordinated.

**The actual fragility:**
- If Claude writes "I'll use /delegation to approach this" — false positive delegation is triggered
- If Claude decides to call the tool AND write the slash command — double execution
- At delegation depth 3+, error amplification (17x documented) from parsing noise

**What changes, what stays:**
- Tool handler stays as-is (already works when Claude uses it)
- Add: detect `tool_call` events in `streamEvents` after invoke
- Add: deduplication — if tool was called AND text command matched, prefer tool
- Add: unified `executeDelegation()` function so both paths call same logic
- Eventually remove: `parse-commands.ts` and text-based `onCommand` hook for delegation
- Timeline: 2-3 weeks, ~5 dev-days (keep text path as fallback during transition)

---

### Gap C — Missing Validator in Delegation Loop

**Current code path:**
- `packages/plugins/delegation/src/_helpers/fire-task-complete-hooks.ts` line 34:
  `return { accepted: true };` — unconditional auto-accept when no hooks are registered
- `onTaskComplete` hook IS in the plugin contract at `packages/plugin-contract/src/index.ts` line 134
- No plugin implements it. The architecture is correct; the validator is missing.
- `apps/orchestrator/src/plugin-registry/index.ts` line 16 — validator is not in `ALL_PLUGINS`

**Hook contract (confirmed sufficient — no changes needed):**
- Throw Error = reject (error message becomes feedback for re-delegation)
- Return normally = accept
- Tests already verify this behavior

**What changes, what stays:**
- Create: `packages/plugins/validator/src/` — new plugin package
- Implement: `onTaskComplete` hook with structured Q1/Q2/Q3/Q4 rubric + VERDICT: PASS/FAIL
- Use: different model than worker (Opus validates Sonnet output) to reduce sycophancy
- Safety valve: auto-accept when `iteration >= maxIterations` (prevents infinite loops)
- Register: add `validatorPlugin` to `ALL_PLUGINS` in plugin-registry
- Timeline: 1-2 weeks

---

### Gaps A+I — Fault Tolerance: Orphaned Tasks + Circuit Breaker

**Current code path (orphaned tasks):**
- `packages/plugins/delegation/src/index.ts` line 84: `runDelegationLoop()` is fire-and-forget
- `delegation-loop.ts` line 117: sets task `status='running'` at iteration start
- If process crashes mid-iteration: `OrchestratorTask` stays at `status='running'` forever
- Schema has `updatedAt` (auto-updated) — 30-minute staleness threshold is detectable
- `apps/orchestrator/src/index.ts` boot function: NO startup scan exists

**Current code path (circuit breaker):**
- `delegation-loop.ts` lines 164-172: on exitCode !== 0, sets `feedback` and `continue`
- Zero backoff. Iteration 2 runs immediately after iteration 1 fails with timeout
- All failure types (timeout, crash, parse error) treated identically
- 5 identical retries burn all iterations on the same unrecoverable error

**What changes, what stays:**
- Add: startup scan in `apps/orchestrator/src/index.ts` boot(), before plugin `start()`
  — Query: `status='running' AND updatedAt < 30min ago`
  — Action: set to `failed`, notify parent thread, log recovery
  — Cost: one fast indexed query at boot, typically returns 0 rows
- Add: failure categorization in delegation-loop.ts (timeout / crash / logic-error)
  — Logic errors: fast-fail immediately (same prompt will fail again)
  — Timeout/crash: exponential backoff (1s, 4s, 9s) with jitter before retry
- Timeline: 3-4 days combined; orphaned scan alone is 1-2 days

---

### Gap B — Memory Architecture (50-Message Window)

**Current code path:**
- `packages/plugins/context/src/_helpers/history-loader.ts` line 20-40:
  `db.message.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })` — hard limit
- No warning to Claude that context was truncated
- `context/memory.md` IS injected (highest priority) but agent is not enforced to write it
- `DEFAULT_PRIORITY_FILES = ['memory.md', 'world-state.md', 'thread-summaries.md', 'inbox.md']`
  — infrastructure already wired for memory discipline

**SessionId bug (discovered by agent 4):**
- `orchestrator/index.ts` lines 212-217: sessionId written once, never cleared
- When session expires (8-min TTL), new subprocess is created
- But `sessionId IS NOT NULL` → history injection skipped even for fresh subprocess
- New session starts with ZERO conversation context
- This is a secondary bug on top of the 50-message limit

**pgvector status:** NOT installed. No embedding columns in schema.

**What changes, what stays:**
- Now (no code): Enforce memory.md discipline — update after interactions, nightly consolidation cron
- Week 4-5: Add `MessageSummary` model, rolling summaries every 50 messages
  — Instead of 50 raw messages: inject 2 recent summaries + 15 recent messages
  — Solves context pollution; handles conversations to ~500 messages
- Month 2+: pgvector + `MessageEmbedding` — semantic retrieval for arbitrary queries
  — "What did we decide about auth in February?" becomes answerable
  — Defer until the summarization tier is proven

**SessionId fix (standalone, ~2 hours):**
- Clear `Thread.sessionId` when session is evicted from pool
- Re-enable history injection on fresh session startup
- `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts` eviction logic

---

### Gaps F+J — Observability + Cost Management

**Current cost tracking (two inconsistent paths):**
- Main thread: metrics plugin → `Metric` table records (token.input, token.output, token.cost)
  — No `AgentRun` record for main thread invocations
- Sub-agents (delegation): `record-agent-run.ts` → creates `AgentRun` with `taskId` AND `Metric` records
- Cost is recorded but in different tables for different paths — cross-table aggregation required
- Pricing table in `calculate-cost.ts`: hardcoded 2025 rates, correct but stale-risk

**No trace correlation:**
- Zero shared ID between parent invocation and child sub-agent invocations
- Debugging a slow delegation requires manual SQL joins by threadId/taskId
- `AgentRun` has no `traceId` or `parentRunId` field

**No cost enforcement:**
- `AgentRun` records cost — but nothing ever reads it to stop execution
- 5-iteration Opus delegation = ~$6.75, no ceiling

**What changes, what stays:**
- Week 1-2: `queryThreadCumulativeCost()` helper + per-thread cost API endpoint
  — Show cost badges in thread sidebar (web UI)
  — SQL: SUM from both Metric + AgentRun for full picture
- Week 2-3: Cost cap in `delegation-loop.ts` (40 lines)
  — Check cumulative task cost after each iteration
  — If > $DELEGATION_CAP (default $5), break loop, mark failed, notify user
  — Configurable via env var or PluginConfig
- Week 3-4: `traceId` in InvokeOptions → propagated to sub-agents → stored in AgentRun
  — Generate UUID in handleMessage, pass through to invokeSubAgent
  — Enables: `SELECT * FROM AgentRun WHERE traceId = $id ORDER BY startedAt`
- Defer: OpenTelemetry, external backends, PipelineEvent persistence model

---

## Prioritized Implementation Queue

Ordered by: effort vs. impact ratio for a single-user personal assistant where cost is the primary concern.

### Sprint 1 — Safety Net (3-4 days)
Fast wins that prevent the worst failure modes with minimal code change.

**1a. Orphaned Task Scan** (1-2 days)
- File: `apps/orchestrator/src/index.ts` — add scan in boot(), before plugin start()
- Zero schema changes, uses existing `updatedAt` index
- Prevents: phantom "running" tasks in UI after crashes

**1b. Cost Cap in Delegation Loop** (1-2 days)
- File: `delegation-loop.ts` — 40-line addition after each iteration
- New helper: `query-cumulative-cost.ts`
- Prevents: runaway Opus delegations draining wallet

**1c. Circuit Breaker** (1-2 days, can be parallel with 1b)
- File: `delegation-loop.ts` — add failure categorization + backoff before `continue`
- Fast-fail logic errors (parse errors, schema failures) — 1 iteration instead of 5
- Exponential backoff for timeouts/crashes

---

### Sprint 2 — Delegation Quality (1-2 weeks)
Makes the delegation system actually validate its own outputs.

**2. Validator Plugin**
- Create: `packages/plugins/validator/src/` (new package)
- Implements: `onTaskComplete` hook with structured rubric
- Uses Opus to validate Sonnet outputs (anti-sycophancy)
- Register in `apps/orchestrator/src/plugin-registry/index.ts`
- Immediate benefit: all delegated tasks now have a quality gate

---

### Sprint 3 — Structured Command Routing (2-3 weeks)
Migrates the fragile regex path to structured tool_use. Phased — text path stays as fallback.

**3a. Tool call detection in pipeline** (week 1)
- File: `orchestrator/index.ts` — detect `tool_call` events in streamEvents after invoke
- Deduplication with text parsing results
- Both paths work simultaneously during transition

**3b. Unified delegation handler** (week 2)
- File: `delegation/src/index.ts` — extract `executeDelegation()`, wire both paths
- Add deprecation warnings on text path

**3c. Remove text parsing** (week 3, separate PR)
- Delete `parse-commands.ts`
- Remove `handleDelegateCommand`, `parseDelegateArgs`
- Clean tests

---

### Sprint 4 — Memory & Cost Visibility (weeks 4-5)
Prevents long-term context degradation and adds spending transparency.

**4a. SessionId bug fix** (2 hours)
- Clear `Thread.sessionId` when session evicts from pool
- Prevents fresh subprocess from starting with zero context

**4b. Thread cost API + UI** (2-3 days)
- Add per-thread cost endpoint
- Show cost badges in thread sidebar

**4c. Rolling message summaries** (1 week)
- Add `MessageSummary` model to schema
- Extend context plugin to generate + inject summaries
- Handles conversations up to ~500 messages

**4d. TraceId propagation** (2-3 days)
- Add `traceId` to InvokeOptions
- Generate in handleMessage, propagate to sub-agents
- Store in AgentRun (via metadata JSON first, column migration later)

---

## What We Are Explicitly NOT Changing

| Item | Reason |
|------|--------|
| Security / HTTP auth | Deferred — homelab, closed environment |
| OpenTelemetry integration | Overkill — DIY traceId + SQL is sufficient |
| LangGraph / LangSmith / LangChain | Not needed — all gaps solvable with native Node/TypeScript |
| Prompt versioning | Medium priority — defer until core infrastructure stable |
| Agent evals / regression testing | Medium priority — needs prompt versioning first |
| pgvector / vector search | Defer to Month 2+ — summarization solves the near-term problem |
| Durable execution (Temporal etc.) | Overkill for single-process single-user deployment |
| Multi-user cost attribution | Not needed — single user |

---

## Effort Summary

| Sprint | Gap | Effort | Risk |
|--------|-----|--------|------|
| 1a — Orphaned scan | I | 1-2 days | Very low |
| 1b — Cost cap | J | 1-2 days | Low |
| 1c — Circuit breaker | A | 1-2 days | Low |
| 2 — Validator plugin | C | 1-2 weeks | Low (new package) |
| 3a/b — Structured output | H | 2-3 weeks | Medium (phased) |
| 4a — SessionId fix | B | 2 hours | Low |
| 4b — Cost visibility | J | 2-3 days | Low |
| 4c — Summaries | B | 1 week | Medium (schema change) |
| 4d — TraceId | F | 2-3 days | Low |

Total: ~6-8 weeks to fully close all five high-priority gaps.
Sprint 1 alone (3-4 days) closes the two most dangerous immediate failure modes.
