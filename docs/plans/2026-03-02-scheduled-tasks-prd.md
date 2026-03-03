# Scheduled Tasks — Product Requirements Document

**Date:** 2026-03-02
**Status:** Approved
**Replaces:** Agent Identity Phase 5 (Per-Agent Heartbeat)

---

## Problem Statement

The original Phase 5 design modeled heartbeats as a per-agent config (`AgentConfig.heartbeatEnabled` + `heartbeatCron`) — one heartbeat, one thread per agent. This is wrong:

- An agent can have many threads
- A user may want multiple scheduled tasks per agent
- The existing CronJob system already handles recurring scheduled prompts
- "Heartbeat" is not a distinct concept from "scheduled task"

Meanwhile, the CronJob system works but is limited:

- Admin UI is toggle-only — no create, edit, or delete
- Jobs have no agent association (just raw `threadId`)
- No one-shot scheduling ("remind me at 3pm")
- No way for agents to create scheduled tasks during conversation

## Decision

**Kill the heartbeat abstraction. Evolve CronJob into a full scheduled task system.**

The heartbeat concept collapses into CronJobs. Every use case — "send me my news every morning", "follow up with me after my appointment", "check on that delegation task in 2 hours" — is a scheduled prompt fired into a thread.

## Scope

**In scope:**
- Schema changes to CronJob (agentId, projectId, fireAt, nullable schedule)
- Remove heartbeatEnabled/heartbeatCron from AgentConfig
- Full CRUD admin UI for CronJobs
- Agent detail page integration (read-only list + link to create)
- MCP tool for agents to create scheduled tasks during conversation
- Cron plugin changes for one-shot support and lazy thread creation
- Documentation updates

**Out of scope (future work):**
- Event-triggered scheduling (e.g., "delegation task opened → auto-schedule check-in in 2 hours")
- State-triggered scheduling (e.g., "thread idle for X hours → ping")
- These are fundamentally different from time-based scheduling and will be a separate design

## Non-Goals

- UI polish — the admin page needs to be functional, not beautiful. A UI overhaul is planned separately.
- Hot-reload of cron jobs — toggling/creating jobs takes effect on orchestrator restart (same as today).

---

## Schema Changes

### CronJob Model (Updated)

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

**Key changes from current schema:**
- `agentId String` — required FK to Agent (was absent)
- `projectId String?` — optional FK to Project (new)
- `schedule String?` — now nullable (was required) for one-shot jobs
- `fireAt DateTime?` — new, for one-shot scheduling
- `schedule` and `fireAt` are mutually exclusive — one or the other must be non-null

**Agent model addition:**
```prisma
cronJobs CronJob[]   // add to Agent model relations
```

**Project model addition:**
```prisma
cronJobs CronJob[]   // add to Project model relations
```

### AgentConfig Cleanup

Remove two fields:
```diff
model AgentConfig {
  id                String   @id @default(cuid())
  agentId           String   @unique
  agent             Agent    @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean  @default(true)
  reflectionEnabled Boolean  @default(false)
- heartbeatEnabled  Boolean  @default(false)
- heartbeatCron     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Seed Data Migration

The 4 existing seeded CronJobs need an `agentId` value. They should be assigned to the default/primary agent. The seed script (`packages/database/prisma/seed.ts`) needs to be updated to set `agentId` on each job.

---

## Cron Plugin Changes

### One-Shot Support

On `start()`, after loading enabled jobs, partition by type:

**Recurring jobs** (have `schedule`, no `fireAt`):
- Schedule with croner as today — no changes

**One-shot jobs** (have `fireAt`, no `schedule`):
- Calculate delay from now to `fireAt`
- If `fireAt` is in the past, fire immediately
- On fire: run `ctx.sendToThread`, set `enabled: false`, write `lastRunAt`, clear `nextRunAt`
- Use `setTimeout` or croner's one-shot capability

### Lazy Thread Creation

On fire, if `threadId` is null:

1. Create a new thread: `prisma.thread.create({ data: { agentId: job.agentId, projectId: job.projectId, kind: 'cron', name: job.name } })`
2. Persist the thread ID back: `prisma.cronJob.update({ where: { id: job.id }, data: { threadId: newThread.id } })`
3. Fire `ctx.sendToThread(newThread.id, job.prompt)`

Subsequent fires reuse the persisted `threadId`.

### Validation

On `start()`, skip jobs where:
- Both `schedule` and `fireAt` are null (log warning)
- Both `schedule` and `fireAt` are set (log warning)
- `agentId` references a non-existent or disabled agent (log warning)

---

## Admin UI — CronJob CRUD

### List View (`/admin/cron-jobs`)

Enhanced from current toggle-only page:

| Column | Description |
|--------|-------------|
| Name | Job name |
| Agent | Agent name (linked to agent page) |
| Type | Badge: "Recurring" or "One-shot" |
| Schedule / Fire At | Cron expression or datetime |
| Thread | Thread name or "Auto-create" |
| Status | Enabled/Disabled badge |
| Last Run | Timestamp |
| Next Run | Timestamp |
| Actions | Edit, Delete, Toggle |

**Add:** "New Scheduled Task" button at top.

### Create/Edit Form

New page or modal with fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text input | Yes | Unique name for the job |
| Agent | Dropdown | Yes | All agents |
| Thread | Dropdown | No | Filtered to selected agent's threads. Includes "Auto-create on first run" option |
| Project | Dropdown | No | All projects. Sets project on auto-created threads |
| Type | Toggle | Yes | "Recurring" vs "One-shot" |
| Schedule | Text input | If recurring | Cron expression |
| Fire At | Datetime picker | If one-shot | Date and time |
| Prompt | Textarea | Yes | The prompt sent to the thread |
| Enabled | Toggle | Yes | Default: true |

### Delete

Confirmation dialog. Hard delete from database.

### Server Actions

- `createCronJob` — validates mutual exclusivity of schedule/fireAt, creates record
- `updateCronJob` — same validation, updates record
- `deleteCronJob` — deletes record
- `toggleCronJob` — existing action, unchanged

---

## Agent Detail Page Integration

On `/agents/[agent-id]`, add a "Scheduled Tasks" section:

- Table of CronJobs where `agentId` matches, same columns as admin minus Agent
- "Add Scheduled Task" button → navigates to `/admin/cron-jobs/new?agentId={id}`
- Read-only on the agent page; all editing happens on the admin page

---

## MCP Tool — `cron__schedule_task`

New tool on the cron plugin, exposed to Claude during conversation:

```typescript
{
  name: 'schedule_task',
  description: 'Create a scheduled task that fires a prompt into a thread on a recurring schedule or at a specific time',
  schema: {
    type: 'object',
    properties: {
      name:     { type: 'string', description: 'Descriptive name for the task' },
      prompt:   { type: 'string', description: 'The prompt to send when the task fires' },
      schedule: { type: 'string', description: 'Cron expression for recurring tasks (e.g., "0 14 * * *" for daily at 2pm UTC)' },
      fireAt:   { type: 'string', description: 'ISO datetime for one-shot tasks (e.g., "2026-03-03T15:00:00Z")' },
      threadId: { type: 'string', description: 'Thread to fire into. Defaults to current thread if omitted.' },
    },
    required: ['name', 'prompt'],
  },
  handler: async (ctx, input, meta) => {
    // agentId resolved from meta.threadId → thread.agentId
    // projectId resolved from meta.threadId → thread.projectId
    // threadId defaults to meta.threadId if not provided
    // Validates schedule/fireAt mutual exclusivity
    // Creates CronJob record
    // Returns confirmation with name and next fire time
  },
}
```

**Constraints:**
- Must provide either `schedule` or `fireAt` (not both, not neither)
- `agentId` is auto-resolved from the current thread's agent — not user-provided
- `projectId` is auto-resolved from the current thread's project
- `threadId` defaults to `meta.threadId` (current conversation) if omitted

---

## Memory Integration

No special memory handling needed for scheduled tasks. The existing memory pipeline works naturally:

1. CronJob fires → `ctx.sendToThread(threadId, prompt)`
2. Pipeline runs → identity plugin's `onAfterInvoke` fires
3. `scoreAndWriteMemory` runs → Haiku scores importance AND classifies scope (GLOBAL, PROJECT, THREAD)
4. Memory written with `agentId`, `projectId` (from thread), and `scope` classification

**Why `projectId` on CronJob matters:** When a job auto-creates a thread (`threadId` was null), the new thread inherits `projectId` from the CronJob. This ensures memories from cron-triggered conversations land in the correct project scope. Without it, auto-created threads would have no project and all memories would default to GLOBAL classification.

---

## Documentation Updates

| File | Change |
|------|--------|
| `.claude/rules/agent-identity-state.md` | Phase 5: rename to "Scheduled Tasks via CronJob CRUD", update status |
| `.claude/rules/cron-scheduler.md` | Remove heartbeat dependency chain, document new CronJob shape, one-shot support, lazy thread creation, MCP tool |
| `CLAUDE.md` | Update Phase 5 entry, CronJob description, add cron CRUD to "What Already Exists" after implementation |

---

## Future Work (Documented, Not Designed)

### Event-Triggered Scheduling
- "Delegation task opened → schedule a check-in in 2 hours"
- "Thread idle for X hours → ping the parent thread"
- These are not cron expressions — they're one-shot timers created by system events
- The `fireAt` field on CronJob could potentially serve this, but the trigger mechanism is different (event handler creates the job, not user/agent)
- Separate design needed

### Hot-Reload
- Currently, job changes take effect on orchestrator restart
- Future: file-watch or DB-polling to pick up new/changed/disabled jobs without restart
- The cron plugin's `start()`/`stop()` lifecycle already supports this pattern

### Cron Expression Builder
- UI helper for building cron expressions (dropdown for common patterns like "daily at 7am", "every 30 minutes")
- Nice-to-have, not blocking
