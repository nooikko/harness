# Admin UI Redesign — Master Plan

**Goal**: Transform the admin area from a database viewer into something that feels like Linear, Vercel, or Recall — a product you'd pay for.

**Design direction**: Quiet Precision — dense but scannable, semantic color, hover-reveal interactions, purposeful motion.

**Constraint**: No cost/token display in the chat interface. Cost data lives in admin (Usage, Agent Runs) only.

---

## Architecture of Change

The current admin has one pattern repeated 6 times: big heading, subtitle, card list or card grid, Edit/Delete buttons. Every page looks the same regardless of whether it's showing 4 cron jobs or 50 agent runs. Products don't work this way — each view is shaped by its data and the workflows it supports.

### What Each Page Actually Is

| Page | Data Shape | Primary Workflow | Current Pattern | Target Pattern |
|------|-----------|-----------------|----------------|----------------|
| Cron Jobs | List of scheduled items with status | Toggle, edit, monitor timing | Card stack | Interactive table with inline toggles |
| Plugins | Registry of modules with on/off | Toggle, configure | Card grid (3-col) | Tighter card grid with hover actions |
| Tasks | Delegation activity log | Monitor, inspect | Card stack | Compact table (monitoring density) |
| Agent Runs | Invocation log with metrics | Monitor, correlate | Card stack | Compact table (monitoring density) |
| Threads | Conversation registry | Navigate, manage status | Card stack | Interactive table with inline status |
| Usage | Metrics dashboard | Observe trends | Cards + charts | Refined dashboard with trend data |

### Data Available Per Page (from Prisma schema)

**Threads** — `name`, `source`, `kind`, `status`, `model`, `lastActivity`, `agentId→agent.name`, `projectId→project.name`, `_count.messages`, `parentThreadId` (delegation threads)

**Cron Jobs** — `name`, `schedule`, `fireAt`, `enabled`, `lastRunAt`, `nextRunAt`, `agentId→agent.name`, `projectId→project.name`, `threadId` (null = auto-create), `prompt` (preview)

**Agent Runs** — `model`, `inputTokens`, `outputTokens`, `costEstimate`, `durationMs`, `status`, `error`, `startedAt`, `completedAt`, `threadId→thread.name`, `taskId→task.prompt` (preview)

**Tasks** — `status`, `prompt` (preview), `maxIterations`, `currentIteration`, `threadId→thread.name`, `_count.agentRuns`, `createdAt`, `updatedAt`

**Plugins** — `pluginName`, `enabled`, `settings` (JSON), `updatedAt` + settings schema from registry

**Agents** — `name`, `slug`, `version`, `enabled`, `role`, `goal`, `soul` (preview), `_count.threads`, `_count.memories`, `_count.cronJobs`, `config.memoryEnabled`, `config.reflectionEnabled`, `config.bootstrapped`

---

## Implementation Phases

### Phase 1: Design Foundation
- Semantic color system (green/grey/blue/amber/red replacing purple-for-everything)
- Animation timing standards
- Row/item sizing constants

### Phase 2: Sidebar
- Grouped sections (Configuration, Activity, Analytics)
- Active state with left accent bar
- Tighter spacing (28px line-height)

### Phase 3: Page Headers
- Smaller headings, consistent breadcrumbs
- Count indicators ("Threads (2)")
- Action buttons integrated into header row

### Phase 4: Tables
- Threads, Cron Jobs, Agent Runs, Tasks → interactive tables
- Each cell type designed for its interaction (toggle, link, popover, display)
- Row hover reveals context menu
- Inline actions where appropriate

### Phase 5: Plugin Cards
- Tighter cards with inline toggle
- Hover-reveal settings button
- Connection status indicators

### Phase 6: Forms
- Entity pattern (label+description left, control right)
- Section grouping
- Better type toggles and input affordances

### Phase 7: Empty States
- Remove dashed borders
- Warmer illustrations and copy
- Never flash empty state during loading

### Phase 8: Usage Dashboard
- Trend indicators on summary cards
- Better chart styling
- Human-readable model names
- Progressive budget visualization

### Phase 9: Agents Page
- Richer cards with soul preview, memory count, config flags
- Thread/memory/cron-job counts surfaced

### Phase 10: Motion & Polish
- Content fade-in, row hover transitions
- Sidebar press animation
- Toggle switch spring animation
- Skeleton → content crossfade

---

## Detailed Plans

Each phase has its own plan file in this directory:
- `phase-01-design-foundation.md`
- `phase-02-sidebar.md`
- `phase-03-page-headers.md`
- `phase-04-tables.md`
- `phase-05-plugin-cards.md`
- `phase-06-forms.md`
- `phase-07-empty-states.md`
- `phase-08-usage-dashboard.md`
- `phase-09-agents-page.md`
- `phase-10-motion-polish.md`

---

## Design Principles (Non-Negotiable)

1. **Every cell is an interaction surface** — if data can be changed, the cell that shows it should change it
2. **Actions on hover, not always visible** — reduce visual clutter, reward exploration
3. **Color means something** — green=healthy, grey=inactive, blue=in-progress, amber=attention, red=error
4. **Density serves monitoring** — agent runs and tasks are operational data; pack it tight
5. **Relative time everywhere** — "2h ago" not "Mar 4, 10:00 PM"; tooltip for exact
6. **No cost in chat** — cost data lives exclusively in admin (Usage page, Agent Runs table)
7. **Honest states** — loading shows skeleton, empty shows invitation, error shows what happened
