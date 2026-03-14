# Plan: Cron Verification + Calendar-Integrated Follow-ups

## Summary

Verify the existing cron system works end-to-end (agent sends messages on schedule), then extend it to support calendar-aware follow-ups — "remind me 10 minutes after my 2pm meeting" type interactions where the agent creates a one-shot cron job timed relative to calendar events.

## Part 1: Cron Verification

The cron plugin is architecturally complete. What needs verification:

### Test Checklist

1. **Orchestrator boots with cron plugin** — `start()` loads jobs from DB, schedules them
2. **Recurring job fires** — Morning Digest (0 14 * * * UTC / 7am MST) actually triggers `sendToThread`
3. **One-shot job fires** — Create a `fireAt` job 1 minute from now, verify it fires and auto-disables
4. **Hot-reload works** — Create a new job via admin UI, verify it schedules without restart
5. **MCP tool works** — Agent calls `cron__schedule_task` during conversation, job appears and fires
6. **Discord delivery** — Cron-triggered message reaches Discord via the discord plugin's `onBroadcast`
7. **Lazy thread creation** — Job with null `threadId` creates a thread on first fire

### What Might Be Broken

- **Orchestrator not running** — cron only works when the orchestrator process is up
- **Discord plugin not connected** — cron fires but no Discord delivery
- **Time zone confusion** — jobs are UTC, but user thinks in MST (America/Phoenix)
- **sendToThread errors silently** — if Claude invocation fails, the cron trigger may swallow errors

### Verification Steps

1. Start orchestrator locally (`pnpm dev` in `apps/orchestrator`)
2. Check logs for cron plugin startup messages
3. Create a test one-shot job via admin UI with `fireAt` = 2 minutes from now
4. Verify: thread gets a message, assistant responds, activity records created
5. Create a test one-shot job via MCP tool in a chat
6. Verify same chain
7. Test Discord delivery: ensure Discord plugin is connected, fire a cron job, check Discord

### Fixes if Needed

- Add structured logging to cron trigger handlers (job name, threadId, result)
- Add error handling: if `sendToThread` fails, log error and optionally retry once
- Surface cron execution status in admin UI (last run status: success/error)

## Part 2: Calendar-Aware Follow-ups

### Concept

User says: "Follow up with me 10 minutes after my 2pm meeting"

Agent flow:
1. Agent calls `calendar__get_event` or `calendar__list_events` to find the 2pm meeting
2. Gets end time (e.g., 2:30pm)
3. Calls `cron__schedule_task` with `fireAt` = 2:40pm
4. One-shot job fires at 2:40pm, sends follow-up message

**No new infrastructure needed** — this is a natural combination of the calendar plugin (reads events) and the cron plugin (schedules one-shots). The agent orchestrates the two.

### What Needs to Work

1. Calendar plugin is functional (depends on Microsoft Graph plan)
2. Cron plugin's one-shot jobs fire reliably
3. Agent can chain tool calls (calendar read → cron schedule)

### Prompt Enhancement

Add to the agent's system context (via context files):

```markdown
## Calendar Follow-ups

When the user asks you to follow up after a meeting or at a relative time:
1. Use `calendar__list_events` to find the referenced event
2. Calculate the follow-up time (event end time + offset)
3. Use `cron__schedule_task` to create a one-shot reminder
4. Confirm what you scheduled and when it will fire

Example: "Follow up 10 minutes after my standup"
→ Find standup event, note end time (e.g., 10:15am)
→ Schedule one-shot at 10:25am with prompt: "Hey! Your standup just ended. How did it go? Anything I should note or follow up on?"
```

## Implementation Steps

### Step 1: Cron Verification (no code changes needed if working)
- Manual testing checklist above
- Fix any issues found

### Step 2: Cron Observability Improvements
- Add `lastRunStatus` field to CronJob model (`success` / `error` / null)
- Add `lastRunError` field (String? @db.Text)
- Update admin UI to show last run status
- Wrap cron trigger handler in try/catch, write status to DB

### Step 3: Calendar Follow-up Context
- Add context file for calendar follow-up patterns
- Test the full flow: find event → schedule one-shot → verify delivery

## Schema Changes (Optional Enhancement)

```prisma
model CronJob {
  // ... existing fields
  lastRunStatus String?    // "success" | "error"
  lastRunError  String?  @db.Text
}
```

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/cron/src/_helpers/cron-server.ts` | Modify | Add error handling + status tracking |
| `packages/database/prisma/schema.prisma` | Modify | Add lastRunStatus, lastRunError to CronJob |
| `apps/web/src/app/admin/cron-jobs/_components/*.tsx` | Modify | Show run status in admin UI |
| `apps/orchestrator/context/calendar-followups.md` | Create | Agent instructions for calendar follow-ups |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Cron fires but sendToThread silently fails | Add try/catch with status tracking per job |
| Calendar not set up yet when follow-up requested | Agent responds gracefully: "I need calendar access first" |
| Timezone bugs with one-shot fireAt | Ensure all fireAt values are UTC, log the conversion |
