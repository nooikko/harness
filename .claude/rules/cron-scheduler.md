# Cron Scheduler

How scheduled jobs work end-to-end. How per-agent heartbeat will integrate with this system.

---

## Plugin Pattern

`@harness/plugin-cron` is a plugin, not a top-level orchestrator module.

File: `packages/plugins/cron/src/index.ts`

This keeps the cron scheduler runtime-disableable via `PluginConfig.enabled` in the database — no code change required to disable all scheduled jobs. It also means the cron scheduler has the same `PluginContext` as every other plugin: `ctx.db`, `ctx.sendToThread`, `ctx.broadcast`, `ctx.logger`.

---

## Boot Sequence Constraint

`ctx.sendToThread` is only safe to call in `start()`, not in `register()`.

The orchestrator constructs `PluginContext` (including the `sendToThread` closure) before calling `register()`, but `sendToThread` internally calls `handleMessage`, which is assigned to the orchestrator's internal state before `start()` is called. Calling it during `register()` will throw:

```
Error: Orchestrator not fully initialized
```

**Rule:** Never schedule cron jobs in `register()`. All job scheduling happens in `start()`.

---

## How the Scheduler Works

File: `packages/plugins/cron/src/_helpers/cron-server.ts`

On `start()`:

```
1. ctx.db.cronJob.findMany({ where: { enabled: true } })
   — loads all enabled jobs from DB

2. For each job:
   croner.schedule(job.schedule, handler, { timezone: 'UTC' })
   — schedules using croner library, UTC timezone

3. For each job where job.nextRunAt is null:
   compute nextRun from schedule, write to DB
   — so admin UI shows accurate next fire time before first trigger
```

On trigger:

```
1. if (!job.threadId):
   ctx.logger.warn('CronJob has no threadId, skipping', { jobId: job.id })
   return

2. ctx.sendToThread(job.threadId, job.prompt)
   — runs the full 8-step pipeline, persists assistant response

3. prisma.cronJob.update({
     where: { id: job.id },
     data: { lastRunAt: now, nextRunAt: computedNextRun }
   })
   — atomic write: both timestamps in one update call
```

On `stop()`:

```
cronServer.stop()  — destroys all croner job instances
```

---

## nextRunAt Computation

`nextRunAt` is computed from the live croner job object via `cronJob.nextRun()` after each trigger fires. It is written atomically with `lastRunAt` in a single `prisma.cronJob.update()` call.

On startup, `nextRunAt` is also set for any job where it is null — this ensures the admin UI shows an accurate next fire time before the first trigger has ever fired.

---

## Thread kind='cron'

When `thread.kind` is `'cron'`, the prompt assembler injects:

```
This is an automated cron invocation. Execute the scheduled task and report results concisely.
```

File: `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts`

This instruction is hardcoded in `KIND_INSTRUCTIONS`. Cron threads receive no interactive assistant preamble — they are scoped to executing the scheduled task prompt.

---

## Admin UI

`/admin/cron-jobs` allows enable/disable of individual `CronJob` records without code changes.

Disabled jobs are excluded from `findMany({ where: { enabled: true } })` on the next `start()`. Since the scheduler loads jobs at boot, toggling a job in the admin UI takes effect on orchestrator restart (or a future hot-reload implementation).

---

## Seeded Jobs

File: `packages/database/prisma/seed.ts`
Helper: `packages/database/prisma/_helpers/cron-job-definitions.ts`

4 seeded `CronJob` records. All point to the primary thread (`source: 'system'`, `sourceId: 'primary'`, `kind: 'primary'`):

| Name | Schedule (UTC) | MST Equivalent |
|------|---------------|----------------|
| Morning Digest | `0 14 * * *` | 7:00 AM daily |
| Memory Consolidation | `0 8 * * *` | 1:00 AM daily |
| Calendar Email Refresh | `*/30 * * * *` | Every 30 min |
| Weekly Review | `0 0 * * 6` | Friday 5:00 PM |

Seed uses `prisma.cronJob.upsert` — safe to re-run without duplicates.

---

## CronJob Schema

File: `packages/database/prisma/schema.prisma`

```prisma
model CronJob {
  id        String    @id @default(cuid())
  name      String    @unique
  schedule  String
  prompt    String    @db.Text
  enabled   Boolean   @default(true)
  lastRunAt DateTime?
  nextRunAt DateTime?
  threadId  String?           // null = job is skipped with a warning
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([enabled, nextRunAt])
}
```

`threadId` is nullable. Jobs with a null `threadId` are skipped at trigger time with a warning log — they will not error the scheduler.

---

## Per-Agent Heartbeat Dependency Chain

Agent Identity Phase 5 will use this system.

Current state of dependencies:

| Dependency | Status |
|------------|--------|
| `CronJob` model | Exists in schema |
| Cron plugin (`@harness/plugin-cron`) | Planned — not yet implemented |
| `AgentConfig` model | Planned — not yet in schema |
| `AgentConfig.heartbeatEnabled` | Planned — unblocked once AgentConfig exists |
| `AgentConfig.heartbeatCron` | Planned — unblocked once AgentConfig exists |

Wire-up plan for Phase 5:
1. Add `AgentConfig` to schema with `heartbeatEnabled: Boolean` and `heartbeatCron: String?`
2. In the cron plugin's `start()` hook: after loading `CronJob` records, query all agents where `AgentConfig.heartbeatEnabled = true` and `heartbeatCron` is non-null
3. For each such agent: look up the agent's thread (`thread.agentId = agent.id`), schedule a croner job using `heartbeatCron` that calls `ctx.sendToThread(thread.id, heartbeatPrompt)`
4. These are ephemeral jobs (not stored in `CronJob` table) — they exist only in memory and are re-created on restart

Alternatively, the identity plugin's `start()` hook can independently schedule per-agent heartbeats without requiring the cron plugin, using the same croner library directly.

---

## Key Files

| File | What it owns |
|------|-------------|
| `packages/plugins/cron/src/index.ts` | PluginDefinition — `start`, `stop`, optional tools |
| `packages/plugins/cron/src/_helpers/cron-server.ts` | Job loading, croner scheduling, trigger handler |
| `packages/database/prisma/schema.prisma` | `CronJob` model |
| `packages/database/prisma/seed.ts` | Seeds primary thread + 4 default cron jobs |
| `packages/database/prisma/_helpers/cron-job-definitions.ts` | Cron job definitions array (name, schedule, prompt, enabled) |
| `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts` | `KIND_INSTRUCTIONS.cron` — injected for cron threads |
