# Phase 4: Tables — The Core Transformation

**Goal**: Replace card-list pattern with interactive tables where data is naturally columnar. Each cell is designed for its data type and interaction model.

**Key insight from user**: "Linear uses tables with intention — custom designs, dropdowns, interactions, configuration modals." This is not about swapping `<Card>` for `<Table>`. It's about making each cell a purpose-built interaction surface.

---

## Design Decisions Per Page

### Decision: What stays as cards, what becomes a table?

| Page | Verdict | Reasoning |
|------|---------|-----------|
| Threads | **Table** | Columnar data (name, agent, source, kind, messages, activity). You scan, filter, act. |
| Cron Jobs | **Table** | Columnar data (name, schedule, agent, last/next run, enabled). You toggle, edit, monitor. |
| Agent Runs | **Table** | Dense monitoring data (model, tokens, cost, duration, status). You scan for anomalies. |
| Tasks | **Table** | Status tracking (prompt, thread, iterations, status). You monitor progress. |
| Plugins | **Cards** (keep) | Discrete entities with identity. Toggle + configure per-plugin. Cards fit. |
| Agents | **Cards** (keep, but enrich) | Identity-heavy entities. Name, role, soul preview — cards give room for personality. |

---

## 4a. Threads Table

**Current data** (from `threads-table.tsx` Prisma query):
- `name`, `source`, `kind`, `status`, `lastActivity`
- `agent.name`, `project.name`, `_count.messages` (text only)

**Table Design**:

| Column | Width | Cell Content | Interaction |
|--------|-------|-------------|-------------|
| Name | flex-1 | Thread name or `source/sourceId` fallback. Truncate long names. | **Click → navigate to `/chat/[id]`** |
| Agent | 120px | Agent name or "—" if none | Display only |
| Source | 80px | "web", "discord", "cron" — small badge-like | Display only |
| Kind | 80px | "general", "cron", "system" — muted text | Display only |
| Messages | 60px | Count number, right-aligned | Display only |
| Last Active | 100px | Relative time ("2h ago") with tooltip | Display only |
| Status | 80px | Green/grey dot + text | Display only (archive is rare enough for row menu) |
| | 32px | `...` button on hover | **Click → dropdown**: View, Archive |

**Row behavior**:
- Hover: `bg-muted/50` background transition
- The `...` menu button appears only on hover (opacity transition)
- Clicking the name cell navigates; clicking elsewhere in the row does nothing (avoid accidental navigation)

**Empty state**: Remove dashed border. Centered icon + text + no CTA (threads are system-created).

**Skeleton**: 8-10 rows of `h-[44px]` skeleton bars matching column widths.

**Server component note**: This is an async server component. The table itself is static (no client-side sorting/filtering yet). The `...` menu needs a small client component for the dropdown.

---

## 4b. Cron Jobs Table

**Current data** (from `cron-jobs-table.tsx` via `listCronJobs()`):
- `name`, `schedule`, `fireAt`, `enabled`, `lastRunAt`, `nextRunAt`
- `agentName`, `projectName`

**Table Design**:

| Column | Width | Cell Content | Interaction |
|--------|-------|-------------|-------------|
| Name | flex-1 | Job name | **Click → navigate to edit page** |
| Type | 40px | Repeat icon (recurring) or Clock icon (one-shot) | Display — icon only, tooltip explains |
| Schedule | 140px | Cron expression in monospace OR datetime for one-shot | Display only |
| Agent | 120px | Agent name | Display only |
| Last Run | 100px | Relative time or "—" | Display only |
| Next Run | 100px | Relative time or "—". Emphasized if <1h away. | Display only |
| Enabled | 60px | **Toggle switch** | **Inline toggle** — server action, no confirmation |
| | 32px | `...` on hover | **Click → dropdown**: Edit, Delete |

**The inline toggle is the key interaction**. Currently there's an "Enable"/"Disable" button that looks like every other button. A switch communicates state AND affordance in one element — you see it's off, you click to turn it on. No label needed.

**Delete behavior**: In the `...` dropdown, "Delete" uses the two-click pattern — first click changes text to "Delete?" with red styling, resets after 3s.

---

## 4c. Agent Runs Table

**Current data** (from `agent-runs-table.tsx` Prisma query):
- `model`, `inputTokens`, `outputTokens`, `costEstimate`, `durationMs`, `status`
- `startedAt`, `completedAt`, `thread.name`, `thread.id`

**Table Design** (compact — 36px rows for density):

| Column | Width | Cell Content | Interaction |
|--------|-------|-------------|-------------|
| Thread | flex-1 | Thread name or truncated ID | **Click → navigate to thread** |
| Model | 100px | Human-readable name ("Haiku 4.5") | Display only |
| Input | 80px | Token count, right-aligned, muted | Display only |
| Output | 80px | Token count, right-aligned | Display only |
| Cost | 80px | "$0.0080" monospace, right-aligned | Display only |
| Duration | 70px | "10.5s" or "—" if running | Display only |
| Status | 70px | Colored dot (green=completed, red=failed, blue pulse=running) | Display only |
| Time | 90px | Relative ("2h ago") | Tooltip with exact |

**Design note**: This is a **monitoring table** — pure read-only, high density. No actions needed per-row (you can't edit or delete a run). The value is scanning: "are runs completing? what's the cost? any failures?"

**Compact mode**: Use 36px row height, 12px font size for data cells. This should feel like a log viewer.

**Error expansion**: If `status === 'failed'` and `error` exists, consider an expandable row that shows the error message on click.

---

## 4d. Tasks Table

**Current data** (from `tasks-table.tsx` Prisma query):
- `status`, `prompt`, `maxIterations`, `currentIteration`
- `thread.name`, `thread.id`, `createdAt`, `updatedAt`
- `result` (if completed)

**Table Design**:

| Column | Width | Cell Content | Interaction |
|--------|-------|-------------|-------------|
| Task | flex-1 | First 80 chars of prompt, truncated | Tooltip or expandable for full prompt |
| Thread | 150px | Thread name or truncated ID | **Click → navigate to thread** |
| Progress | 80px | "2/4" iterations — consider a mini progress bar | Display only |
| Status | 90px | Colored dot + text (pending/running/completed/failed) | Display only |
| Created | 90px | Relative time | Tooltip with exact |

**Result preview**: If completed, maybe show first line of result in an expandable area below the row.

---

## Shared Table Infrastructure

All four tables will share patterns. Consider:

1. **`<DataTable>` wrapper** — handles the consistent table chrome (border, header styling, row hover)
2. **Row menu component** — `...` button that appears on hover, renders a DropdownMenu
3. **Status dot component** — colored dot with consistent sizing
4. **Relative time component** — client component with tooltip

These shared pieces prevent drift as each table is built independently.

---

## Server Component Architecture

All four tables are async server components. The interactive elements (toggle switch, dropdown menu, expanding rows) need to be client component islands within the server-rendered table.

Pattern:
```tsx
// Server component renders the table structure + data
export const CronJobsTableInternal = async () => {
  const jobs = await listCronJobs();
  return (
    <table>
      <thead>...</thead>
      <tbody>
        {jobs.map(job => (
          <tr key={job.id}>
            <td>{job.name}</td>
            {/* Client component island for interactive cell */}
            <td><CronJobToggle id={job.id} enabled={job.enabled} /></td>
            <td><RowMenu actions={[...]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## Estimated Scope

- 4 table components rewritten (threads, cron-jobs, agent-runs, tasks)
- 3-4 shared components (DataTable, RowMenu, StatusDot, RelativeTime)
- Small client component islands for interactive cells
- All existing tests need updates (they test card-based markup)
- This is the largest single phase — estimate ~50% of total redesign effort
