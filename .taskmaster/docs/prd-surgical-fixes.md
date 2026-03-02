# PRD: Surgical Fixes — Codebase Drift Remediation

**Date:** 2026-03-02
**Status:** Active
**Scope:** Targeted fixes only. No new architecture. No scope expansion.
**Source:** 3-agent deep codebase analysis + AI_RESEARCH cross-reference (2026-03-02)

---

## Context

A multi-agent analysis of the Harness codebase identified systems that exist at 90% completion,
dead code that misleads future agents, and documentation gaps causing repeated re-implementation
of already-built features. This PRD addresses only surgical fixes — things that are broken,
nearly done, or creating active confusion.

**Explicitly deferred (do not add scope):**
- Agent Identity Phase 3 (vector search) — Qdrant decision pending
- Agent Identity Phase 5 (heartbeat) — blocked on cron scheduler (Task 1 here)
- Security / HTTP authentication — homelab, closed environment
- OpenTelemetry / distributed tracing — DIY traceId is sufficient
- pgvector — rejected; Qdrant is the candidate if/when vector search is needed

---

## Category A: Critical Correctness

### A1. Cron Scheduler Executor
**What exists:** CronJob schema model, 4 seeded jobs (Morning Digest, Memory Consolidation,
Calendar Refresh, Weekly Review), admin UI at /admin/cron-jobs to enable/disable, thread
kind='cron' recognized by prompt-assembler, cron-job-definitions.ts with full prompt templates.

**What's missing:** The executor. Nothing reads enabled CronJob records and fires them on schedule.

**Implementation:**
- Add `apps/orchestrator/src/cron-scheduler/index.ts` module
- Use `node-cron` package (or `croner` for better timezone support with MST/UTC offsets)
- On orchestrator boot: query all `CronJob where enabled=true`, compute `nextRunAt` from schedule
- On schedule trigger: `ctx.sendToThread(cronJob.threadId, cronJob.prompt)`
- After run: `prisma.cronJob.update({ lastRunAt: now, nextRunAt: computed })`
- Register in `apps/orchestrator/src/index.ts` boot() after plugins start
- Context: CronJob threads use `kind='cron'` which already injects the right instructions

**Dependency:** None. This is a standalone addition.
**Unblocks:** Agent Identity Phase 5 (per-agent heartbeat via AgentConfig.heartbeatCron)

### A2. SessionId Persistence Bug
**What's broken:** When a Claude session expires from the 8-minute TTL pool, the session subprocess
is gone but `Thread.sessionId` is NOT cleared in the database. On the next invocation, the context
plugin sees `sessionId IS NOT NULL` and skips history injection. The new subprocess starts with zero
conversation context.

**Fix:** In `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts`, when a session is evicted
(TTL expiry or error), clear `Thread.sessionId` via a DB write: `prisma.thread.update({ sessionId: null })`.

**Effort:** ~2 hours. Explicitly identified as a known bug in gap-implementation-analysis.md.

### A3. Verify Rich Activity Persistence Duplication
**Risk:** The activity plugin (onPipelineStart/onPipelineComplete) was extracted from sendToThread,
but the original hardcoded persistence code (lines 75-158 of orchestrator/index.ts) may still be
active. If both paths write, every pipeline run produces duplicate activity records in the Message table.

**Action:** Read sendToThread. If old persistence code still exists alongside the activity plugin
hook calls, remove the hardcoded block. Activity plugin must be the sole source of truth.

---

## Category B: Near-Complete Features

### B1. Custom Thread Instructions
**What exists:** `Thread.customInstructions` field already in Prisma schema. UI textarea already
in `manage-thread-modal.tsx` with placeholder text. Comment in UI says "once the DB field exists"
but the field DOES exist — comment is stale.

**What's missing:**
1. Server action `update-thread-instructions.ts` to save the field
2. Wire the textarea in manage-thread-modal to call the action
3. Inject `thread.customInstructions` in `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts`

**Effort:** ~1 day. Three small changes across three files.

### B2. AgentConfig Database Model
**What's planned:** `identifiable-agents-plan.md` specifies an AgentConfig table for per-agent
feature flags and the eventual heartbeat cron expression. Currently missing from schema.

**Why now (not later):** Adding the table now (even empty) prevents the identity plugin and agent
management code from needing a schema migration mid-feature when heartbeat arrives.

```prisma
model AgentConfig {
  id                String  @id @default(cuid())
  agentId           String  @unique
  agent             Agent   @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean @default(true)
  reflectionEnabled Boolean @default(false)  // Phase 4, not yet implemented
  heartbeatEnabled  Boolean @default(false)  // Phase 5, blocked on cron scheduler
  heartbeatCron     String?                  // cron expression when heartbeat is wired
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## Category C: Dead Code Cleanup

### C1. onCommand Hook — Mark as Deprecated Dead Code
The `parse-commands.ts` + `onCommand` hook pipeline (Steps 6-7 of handleMessage) is a dead stub.
All commands moved to MCP tools. No plugin implements `onCommand`. The code runs every pipeline
invocation and does nothing except mislead agents reading the codebase.

**Action:** Add deprecation comments to `parse-commands.ts` and the Step 6/7 block in
`orchestrator/index.ts`. Document that this code path is intentionally unused — all commands
now use `PluginTool` via the tool-server. Do NOT delete yet (requires coordinated PR).

### C2. Remove Legacy User and Post Schema Models
Prisma template artifacts. Zero references anywhere in application code. No business logic touches
them. Safe to delete from `schema.prisma`.

---

## Category D: Consistency Fixes (Small)

### D1. Extract MODEL_OPTIONS to Shared Constant
`MODEL_OPTIONS` array is defined identically in two files:
- `apps/web/src/app/(chat)/chat/_components/manage-thread-modal.tsx`
- `apps/web/src/app/(chat)/chat/_components/model-selector.tsx`

Extract to `apps/web/src/app/(chat)/chat/_helpers/model-options.ts`. One export, both components import.

### D2. Fix requestAuditDelete URL Pattern
`apps/web/src/app/(chat)/chat/_actions/request-audit-delete.ts` duplicates the orchestrator URL
logic inline. All other actions use `getOrchestratorUrl()` helper. Align this one.

### D3. Add Warning Log for Missing Metrics Fields
`packages/plugins/metrics/src/index.ts` silently skips writing metrics when `inputTokens`,
`outputTokens`, or `model` are missing from InvokeResult. This means cost caps silently fail
if metrics don't write. Add `ctx.logger.warn(...)` on skip.

### D4. Verify Circuit Breaker in Delegation Loop
Gap-implementation-analysis.md (Sprint 1c) described adding failure categorization + backoff to
`delegation-loop.ts`. Verify this was implemented. If not:
- Logic errors (parse failures) → fast-fail immediately, don't burn remaining iterations
- Timeout/crash → exponential backoff before retry (1s, 4s, 9s)

---

## Category E: Documentation (Prevents Future Drift)

### E1. CLAUDE.md: System Inventory Section
Add a "What Already Exists" section documenting every fully-implemented subsystem so future agents
don't rebuild them:
- Admin section at `/admin` (cron-jobs, plugins, threads, agent-runs, tasks)
- Agent management at `/agents` (CRUD + memory browser)
- Usage dashboard at `/usage`
- Identity/soul system (Phases 1-2 complete, Phase 3+ deferred)
- Summarization at 50-message threshold
- Audit-delete flow

### E2. CLAUDE.md: Planned But Incomplete Section
Document what's schema/UI-ready but missing its execution layer:
- Cron scheduler (Task A1 in this PRD)
- Custom thread instructions (Task B1 in this PRD)
- Agent heartbeat (blocked on cron + AgentConfig)
- pgvector → Qdrant decision pending for Agent Identity Phase 3

### E3. Architectural Rules: Cron Integration Pattern
Add `.claude/rules/cron-scheduler.md` documenting:
- How the scheduler reads CronJob records
- What nextRunAt means and how it's computed
- How a cron trigger becomes a sendToThread call
- The dependency chain: CronJob → cron-scheduler → sendToThread → kind='cron' thread

### E4. Architectural Rules: Agent Identity System State
Add to existing rules or new file documenting:
- Which phases are complete (1-2), which are paused (3-5) and why
- The ordering dependency: identity plugin must run before context plugin in onBeforeInvoke
- That AgentConfig table is needed before Phase 5 (heartbeat)
- Vector search backend decision: Qdrant (not pgvector) when Phase 3 is implemented

---

## Implementation Order

1. A3 (verify duplication) — read-only verification, fast, informs everything
2. A2 (sessionId bug) — 2 hours, high correctness impact, no dependencies
3. D1, D2, D3, D4 — small consistency fixes, can be done in one PR
4. C1, C2 — dead code cleanup, one PR
5. B2 (AgentConfig schema) — add model now before it blocks future work
6. B1 (custom thread instructions) — schema is ready, complete the feature
7. A1 (cron scheduler) — the highest-impact feature; unblocks identity Phase 5
8. E1-E4 (documentation) — do last so docs reflect actual final state

---

## Out of Scope (Do Not Add)

- Qdrant integration (pending decision)
- Agent reflection cycle (Phase 4 of identity plan)
- Agent heartbeat wiring (Phase 5, needs cron first)
- Security/auth
- OpenTelemetry
- Prompt versioning
- Evals
- Multi-user cost attribution
