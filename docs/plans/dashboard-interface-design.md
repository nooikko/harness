# Dashboard Interface Redesign

**Date:** 2026-02-24
**Status:** Approved

## Context

The Harness web app has basic pages (chat, usage) but lacks a cohesive interface. The home page is a placeholder hero. There is no persistent navigation, no admin area, and no global layout tying pages together. This redesign creates a production-grade dashboard with persistent layout, chat-first experience, and full admin capabilities.

## Decisions

- **Audience:** Solo admin (no auth/permissions needed)
- **Primary activity:** Chat with threads
- **Layout:** Top bar + contextual sidebar (dual-layout shell)
- **Home page:** `/` = Chat interface (no separate landing page)
- **Admin scope:** Full CRUD for all system entities (cron jobs, plugins, tasks, agent runs, threads)
- **Aesthetic:** Clean and light, professional SaaS

## Architecture: Dual-Layout Shell

Two distinct layout shells share a common top bar. The chat shell has a thread sidebar. The admin shell has an entity navigation sidebar. Usage is a standalone page.

### Route Structure

```
/                          -> Chat interface (thread sidebar + empty state)
/chat/[thread-id]          -> Thread detail (messages)
/usage                     -> Usage dashboard (no sidebar)
/admin                     -> Redirects to /admin/cron-jobs
/admin/cron-jobs           -> Cron job management
/admin/plugins             -> Plugin configuration
/admin/tasks               -> Orchestrator task list
/admin/agent-runs          -> Agent run history
/admin/threads             -> Thread management (admin view)
```

### Layout Nesting

```
app/layout.tsx              -> <TopBar /> + {children}
app/(chat)/layout.tsx       -> Thread sidebar + {children}
app/(chat)/page.tsx         -> Chat empty state
app/(chat)/chat/[thread-id] -> Thread detail
app/admin/layout.tsx        -> Admin sidebar + {children}
app/admin/cron-jobs/        -> Cron jobs page
app/admin/plugins/          -> Plugins page
app/admin/tasks/            -> Tasks page
app/admin/agent-runs/       -> Agent runs page
app/admin/threads/          -> Threads page
app/usage/page.tsx          -> Usage dashboard (standalone)
```

## Component Design

### Global Top Bar

Slim persistent bar (~48-56px) across all pages.

- **Left:** "Harness" logo/name, links to `/`
- **Center-left:** Nav tabs: Chat | Usage | Admin, route-aware active highlighting
- **Right:** Reserved for future utilities (theme toggle, search)
- **Implementation:** Client component using `usePathname()` for active states

### Chat Layout

```
+------------------------------------------+
|  Top Bar                                  |
+----------+-------------------------------+
| Threads  |  Thread header (name, badges)  |
| (280px)  |  Message list (scrollable)     |
| Sidebar  |  (future: input bar)           |
+----------+-------------------------------+
```

- Thread sidebar: ~280px, kind icon + name + relative time + status badge
- Collapsible via toggle
- Active thread highlighted with primary tint
- Message area: thread header + scrollable message bubbles
- Reuses and restyles existing ThreadSidebar, ThreadListItem, MessageList, MessageItem

### Admin Layout

```
+------------------------------------------+
|  Top Bar                                  |
+----------+-------------------------------+
| Admin    |  Page content (tables, forms)  |
| (240px)  |                                |
| Sidebar  |                                |
+----------+-------------------------------+
```

- Admin sidebar: ~240px, icon + label nav links
- Sections: Cron Jobs, Plugins, Tasks, Agent Runs, Threads
- Active page highlighted

### Admin Pages

Each follows a consistent pattern: async server component fetching data via Prisma, Suspense boundary with skeleton, Table component for data display.

| Page | Data Source | Key Columns | Actions |
|------|-------------|-------------|---------|
| Cron Jobs | CronJob | name, schedule, enabled, lastRun, nextRun | toggle, edit, view thread |
| Plugins | PluginConfig | name, enabled, settings summary | toggle, view settings |
| Tasks | OrchestratorTask | status, prompt preview, iterations, thread | expand details |
| Agent Runs | AgentRun | model, tokens, cost, status, thread, time | filter by model/date |
| Threads | Thread | name, kind, status, source, messages, activity | archive, view in chat |

### Server Actions (Admin Mutations)

- `toggle-cron-job.ts`: enable/disable cron job
- `update-cron-job.ts`: edit schedule/prompt
- `toggle-plugin.ts`: enable/disable plugin
- `archive-thread.ts`: archive a thread

All use `revalidatePath()` for cache invalidation after mutations.

## New Components

| Component | Location | Type | Purpose |
|-----------|----------|------|---------|
| TopBar | app/_components/top-bar.tsx | Client | Global nav bar |
| NavLink | app/_components/nav-link.tsx | Client | Route-aware nav link |
| AdminSidebar | app/admin/_components/admin-sidebar.tsx | Client | Admin nav sidebar |
| AdminNavLink | app/admin/_components/admin-nav-link.tsx | Client | Admin sidebar link |
| CronJobsTable | app/admin/cron-jobs/_components/ | Server | Cron job data table |
| PluginsTable | app/admin/plugins/_components/ | Server | Plugin config table |
| TasksTable | app/admin/tasks/_components/ | Server | Task data table |
| AgentRunsTable | app/admin/agent-runs/_components/ | Server | Agent run data table |
| ThreadsTable | app/admin/threads/_components/ | Server | Thread admin table |

## Visual Design

- **Theme:** Light, white backgrounds, light gray sidebars (#f8f9fa)
- **Typography:** Clean sans-serif, elevated heading weight (Plus Jakarta Sans, DM Sans, or Outfit for headings paired with Inter body)
- **Primary color:** Refined blue (slightly desaturated or teal-shifted)
- **Accent:** Warm amber/coral for attention states
- **Status colors:** Green (active), amber (warning), red (error), gray (disabled)
- **Spacing:** Generous padding, clear hierarchy
- **Cards:** Subtle shadows, rounded-xl
- **Borders:** 1px light gray, rounded corners
- **Active states:** Light primary tint background, smooth transitions
- **Tables:** Clean rows, hover highlight

## Existing Components Modified

- `app/layout.tsx`: add TopBar, become the global shell
- `app/chat/layout.tsx`: moves to route group `(chat)`, still renders thread sidebar
- Thread sidebar + message components: restyle, same data flow
- Usage page: restyle under global layout

## What This Does NOT Include

- Authentication or user management
- Real-time WebSocket updates
- Chat input/send functionality (messages come from orchestrator)
- Dark theme (future enhancement)
- Mobile responsive layouts (desktop-first for solo admin)
