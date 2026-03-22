# Plan: Cron Plugin CRUD Tools

## Summary

Extend the existing cron plugin with `list_tasks`, `get_task`, `update_task`, and `delete_task` MCP tools so agents can fully manage scheduled jobs at runtime. This covers the real use cases: "turn off the morning news", "add crypto to my digest", "change that to 8am".

No new plugin needed — the existing plugin system is already malleable via `settingsSchema` + admin UI + `onSettingsChange` hot-reload. The gap is just that agents can only *create* cron jobs (via `schedule_task`) but can't list, read, update, or delete them.

## What Already Exists

- `cron__schedule_task` MCP tool — creates jobs
- `onSettingsChange('cron')` hot-reload — stops all jobs, rebuilds from DB
- Admin UI at `/admin/cron-jobs` — full CRUD
- Plugin settings system — `ctx.getSettings()`, `ctx.notifySettingsChange()`, encryption, admin forms

## New Tools (add to existing `@harness/plugin-cron`)

| Tool | Description |
|------|-------------|
| `cron__list_tasks` | List all cron jobs (name, schedule/fireAt, enabled, lastRunAt, nextRunAt). |
| `cron__get_task` | Get full details of a cron job by name. Returns prompt text + all fields. |
| `cron__update_task` | Update any field(s): prompt, schedule, fireAt, enabled. Triggers hot-reload. |
| `cron__delete_task` | Delete a cron job by name. Triggers hot-reload. |

### Tool Schemas

**list_tasks:**
```json
{
  "properties": {
    "enabledOnly": { "type": "boolean", "description": "Only show enabled jobs (default false)" }
  }
}
```

**get_task:**
```json
{
  "properties": {
    "name": { "type": "string", "description": "Job name (exact match)" }
  },
  "required": ["name"]
}
```

**update_task:**
```json
{
  "properties": {
    "name": { "type": "string", "description": "Job name to update" },
    "prompt": { "type": "string", "description": "New prompt text" },
    "schedule": { "type": "string", "description": "New cron expression (clears fireAt)" },
    "fireAt": { "type": "string", "description": "New one-shot time ISO (clears schedule)" },
    "enabled": { "type": "boolean", "description": "Enable/disable the job" }
  },
  "required": ["name"]
}
```

**delete_task:**
```json
{
  "properties": {
    "name": { "type": "string", "description": "Job name to delete" }
  },
  "required": ["name"]
}
```

### Implementation

**list_tasks handler:**
```typescript
handler: async (ctx, input) => {
  const where = input.enabledOnly ? { enabled: true } : {};
  const jobs = await ctx.db.cronJob.findMany({
    where,
    select: { name: true, schedule: true, fireAt: true, enabled: true, lastRunAt: true, nextRunAt: true },
    orderBy: { name: "asc" },
  });
  return JSON.stringify(jobs, null, 2);
};
```

**update_task handler:**
```typescript
handler: async (ctx, input) => {
  const { name, ...fields } = input;
  const job = await ctx.db.cronJob.findFirst({ where: { name } });
  if (!job) return `No cron job found with name "${name}"`;

  const data: Record<string, unknown> = {};
  if (fields.prompt !== undefined) data.prompt = fields.prompt;
  if (fields.enabled !== undefined) data.enabled = fields.enabled;
  if (fields.schedule !== undefined) { data.schedule = fields.schedule; data.fireAt = null; }
  if (fields.fireAt !== undefined) { data.fireAt = new Date(fields.fireAt); data.schedule = null; }

  await ctx.db.cronJob.update({ where: { id: job.id }, data });
  void ctx.notifySettingsChange("cron");

  return `Updated "${name}". Changes take effect immediately.`;
};
```

**delete_task handler:**
```typescript
handler: async (ctx, input) => {
  const job = await ctx.db.cronJob.findFirst({ where: { name: input.name } });
  if (!job) return `No cron job found with name "${input.name}"`;

  await ctx.db.cronJob.delete({ where: { id: job.id } });
  void ctx.notifySettingsChange("cron");

  return `Deleted "${input.name}". Schedule updated immediately.`;
};
```

## Use Cases

| User Says | Agent Does |
|-----------|-----------|
| "Turn off the morning news" | `cron__update_task({ name: "Morning News Digest", enabled: false })` |
| "Add crypto to my morning digest" | `cron__get_task({ name: "Morning News Digest" })` → reads prompt → `cron__update_task({ name: "...", prompt: updatedPrompt })` |
| "Change the digest to 8am" | `cron__update_task({ name: "Morning News Digest", schedule: "0 15 * * *" })` |
| "What scheduled tasks do I have?" | `cron__list_tasks()` |
| "Delete the weekly review" | `cron__delete_task({ name: "Weekly Review" })` |

## Implementation Steps

### Step 1: Add tools to cron plugin
- Add 4 tool definitions to the `tools` array in `packages/plugins/cron/src/index.ts`
- Create handler files in `_helpers/`: `list-cron-jobs.ts`, `get-cron-job.ts`, `update-cron-job.ts`, `delete-cron-job.ts`

### Step 2: Tests
- Unit tests for each handler (mock DB)
- Integration test: create → list → update → get → delete cycle

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/cron/src/index.ts` | Modify | Add 4 new tools to `tools` array |
| `packages/plugins/cron/src/_helpers/list-cron-jobs.ts` | Create | List handler |
| `packages/plugins/cron/src/_helpers/get-cron-job.ts` | Create | Get handler |
| `packages/plugins/cron/src/_helpers/update-cron-job.ts` | Create | Update handler |
| `packages/plugins/cron/src/_helpers/delete-cron-job.ts` | Create | Delete handler |

## Future: Plugin Toggle Tool

If "turn off the discord plugin" becomes a real need, a single `plugin__toggle` tool can be added to any existing system plugin later. Not worth a whole new plugin package for one tool that may never be needed.
