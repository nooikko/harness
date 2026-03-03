# Cron Scheduler

How scheduled jobs work end-to-end. Covers both recurring cron jobs and one-shot scheduled tasks.

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

2. Partition jobs into two groups:
   a. Recurring jobs (schedule is non-null, fireAt is null)
   b. One-shot jobs (fireAt is non-null, schedule is null)
   c. Jobs with both or neither are skipped with a warning

3. For each recurring job:
   croner.schedule(job.schedule, handler, { timezone: 'UTC' })
   — schedules using croner library, UTC timezone

4. For each one-shot job:
   Calculate delay from now to fireAt
   If fireAt is in the past, fire immediately
   Otherwise schedule with setTimeout or croner one-shot

5. For each job where job.nextRunAt is null:
   compute nextRun from schedule or fireAt, write to DB
   — so admin UI shows accurate next fire time before first trigger
```

On trigger (recurring):

```
1. Resolve threadId (see "Lazy Thread Creation" below)

2. ctx.sendToThread(threadId, job.prompt)
   — runs the full pipeline, persists assistant response

3. prisma.cronJob.update({
     where: { id: job.id },
     data: { lastRunAt: now, nextRunAt: computedNextRun }
   })
   — atomic write: both timestamps in one update call
```

On trigger (one-shot):

```
1. Resolve threadId (see "Lazy Thread Creation" below)

2. ctx.sendToThread(threadId, job.prompt)
   — runs the full pipeline, persists assistant response

3. prisma.cronJob.update({
     where: { id: job.id },
     data: { lastRunAt: now, nextRunAt: null, enabled: false }
   })
   — fire once, then auto-disable
```

On `stop()`:

```
cronServer.stop()  — destroys all croner job instances and pending timeouts
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

`/admin/cron-jobs` provides full CRUD for CronJob records: create, edit, delete, and enable/disable toggle.

The create/edit form includes: name, agent (required dropdown), thread (optional, filtered by agent), project (optional), type toggle (recurring vs one-shot), schedule or fireAt, prompt, and enabled toggle. When thread is omitted, it shows "Auto-create on first run".

Disabled jobs are excluded from `findMany({ where: { enabled: true } })` on the next `start()`. Since the scheduler loads jobs at boot, toggling a job in the admin UI takes effect on orchestrator restart (or a future hot-reload implementation).

---

## Seeded Jobs

File: `packages/database/prisma/seed.ts`
Helper: `packages/database/prisma/_helpers/cron-job-definitions.ts`

4 seeded `CronJob` records. All point to the primary thread and are assigned to the default/primary agent:

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
  schedule  String?              // recurring cron expression (null for one-shot)
  fireAt    DateTime?            // one-shot fire time (null for recurring)
  prompt    String    @db.Text
  enabled   Boolean   @default(true)
  lastRunAt DateTime?
  nextRunAt DateTime?
  threadId  String?              // nullable — auto-created on first fire if null
  agentId   String               // REQUIRED — every job runs in context of an agent
  agent     Agent    @relation(fields: [agentId], references: [id])
  projectId String?              // optional — auto-created threads inherit this
  project   Project? @relation(fields: [projectId], references: [id])
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([enabled, nextRunAt])
}
```

**Key fields:**
- `agentId` (required) — every job is associated with an agent. The `Agent` model has a `cronJobs CronJob[]` relation.
- `projectId` (optional) — when a job auto-creates a thread, the thread inherits this project. The `Project` model has a `cronJobs CronJob[]` relation.
- `schedule` and `fireAt` are mutually exclusive — one or the other must be non-null. Jobs with both or neither are skipped on startup with a warning.
- `threadId` is nullable. Jobs with a null `threadId` auto-create a thread on first fire (see "Lazy Thread Creation" below).

---

## One-Shot Jobs

One-shot jobs use `fireAt` instead of `schedule`. They fire exactly once at the specified time.

**Behavior on fire:**
1. Execute the prompt via `ctx.sendToThread`
2. Set `enabled: false` — the job is auto-disabled after firing
3. Write `lastRunAt`, clear `nextRunAt` to null

**Past-due handling:** If `fireAt` is in the past when the scheduler starts, the job fires immediately. This covers orchestrator restarts that happen after a one-shot was due.

**Use cases:**
- "Remind me at 3pm" — agent creates a one-shot CronJob via `schedule_task` tool
- "Follow up on this delegation in 2 hours" — one-shot with `fireAt` 2 hours from now
- "Check on that task tomorrow morning" — one-shot with `fireAt` the next morning

---

## Lazy Thread Creation

When a CronJob fires and `threadId` is null, a thread is auto-created:

```
1. prisma.thread.create({
     data: {
       agentId: job.agentId,
       projectId: job.projectId,
       kind: 'cron',
       name: job.name
     }
   })

2. prisma.cronJob.update({
     where: { id: job.id },
     data: { threadId: newThread.id }
   })

3. ctx.sendToThread(newThread.id, job.prompt)
```

Subsequent fires reuse the persisted `threadId`. This enables creating jobs without pre-existing threads — the thread is created on demand when the job first fires.

**Why `projectId` matters:** When a job auto-creates a thread, the thread inherits `projectId` from the CronJob. This ensures memories from cron-triggered conversations land in the correct project scope.

---

## MCP Tool — schedule_task

The cron plugin exposes a `schedule_task` MCP tool (qualified as `cron__schedule_task`) that allows agents to create scheduled tasks during conversation.

```typescript
{
  name: 'schedule_task',
  description: 'Create a scheduled task that fires a prompt into a thread on a recurring schedule or at a specific time',
  schema: {
    type: 'object',
    properties: {
      name:     { type: 'string', description: 'Descriptive name for the task' },
      prompt:   { type: 'string', description: 'The prompt to send when the task fires' },
      schedule: { type: 'string', description: 'Cron expression for recurring tasks (e.g., "0 14 * * *")' },
      fireAt:   { type: 'string', description: 'ISO datetime for one-shot tasks (e.g., "2026-03-03T15:00:00Z")' },
      threadId: { type: 'string', description: 'Thread to fire into. Defaults to current thread if omitted.' },
    },
    required: ['name', 'prompt'],
  },
}
```

**Auto-resolved fields:**
- `agentId` — resolved from `meta.threadId` -> `thread.agentId`
- `projectId` — resolved from `meta.threadId` -> `thread.projectId`
- `threadId` — defaults to `meta.threadId` (current conversation) if omitted

**Constraints:**
- Must provide either `schedule` or `fireAt` (not both, not neither)
- `agentId` is auto-resolved, not user-provided
- Returns confirmation with job name and next fire time

**Note:** Jobs created via the MCP tool take effect on the next orchestrator restart (same as admin UI changes). Hot-reload is future work.

---

## Key Files

| File | What it owns |
|------|-------------|
| `packages/plugins/cron/src/index.ts` | PluginDefinition — `start`, `stop`, `schedule_task` tool |
| `packages/plugins/cron/src/_helpers/cron-server.ts` | Job loading, croner scheduling, trigger handler |
| `packages/database/prisma/schema.prisma` | `CronJob` model |
| `packages/database/prisma/seed.ts` | Seeds primary thread + 4 default cron jobs |
| `packages/database/prisma/_helpers/cron-job-definitions.ts` | Cron job definitions array (name, schedule, prompt, enabled) |
| `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts` | `KIND_INSTRUCTIONS.cron` — injected for cron threads |
