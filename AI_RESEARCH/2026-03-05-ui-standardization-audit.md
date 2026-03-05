# UI Standardization Audit

**Date:** 2026-03-05
**Purpose:** Identify inconsistencies and missing ShadCN usage to prepare for design system implementation.

---

## Visual Observations (from screenshots)

### What Looks Good
- **Chat page** — The most polished area. Clean sidebar with ShadCN `Sidebar` system, well-structured message bubbles, pipeline step indicators, and input area. This is the design benchmark.
- **Top header bar** — Consistent across all pages: "Harness" brand, search bar with `Cmd+K` hint, settings gear. Clean and minimal.
- **Admin sidebar** — Simple, functional nav with icons. Consistent across all admin pages.

### What Looks Disjointed
- **Usage page** — No sidebar at all. Standalone page with card grid. Feels like a different app from the chat/admin sections. Cards have a distinct light-blue tinted border style not seen elsewhere.
- **Agent edit form** — Very long vertical form with raw textarea styling. Labels use ALL CAPS (`SOUL`, `IDENTITY`, `USER CONTEXT`, `CHARACTER`) which is a different typographic convention than anywhere else.
- **New Agent form** — Different visual weight from the edit form. Uses a `Card` wrapper that the edit page doesn't. Textareas look different (raw vs shadcn).
- **Admin data lists** — All five admin tables (cron, plugins, tasks, agent-runs, threads) use a custom `<div>`-based list pattern with thin dividers. They're consistent with *each other* but feel like a prototype — minimal information density, lots of whitespace, no sorting/filtering.
- **Plugin settings page** — Plain form inputs with no visual grouping. Empty number inputs with no default values shown.
- **Projects** — 404. The sidebar links to `/chat/projects` which doesn't exist.
- **Empty states** — Generic "No X found." text with no illustration or action guidance. Tasks and Agent Runs pages are just a heading + one line of text in a sea of whitespace.

---

## Component Usage Audit

### ShadCN Components Available (in `packages/ui/`)

```
AlertDialog, Alert, Badge, Button, Card, Collapsible, Command, Dialog,
DropdownMenu, Input, Label, Popover, Progress, ScrollArea, Select,
Separator, Sidebar, Skeleton, Table, Textarea, Tooltip
```

### Where ShadCN is Used Correctly

| Component | Where | Notes |
|-----------|-------|-------|
| `Sidebar` system | Chat layout | Full ShadCN sidebar (Provider, Content, Separator, etc.) |
| `Card` | Agent cards on `/agents`, `CreateAgentForm`, `CronJobForm` | Consistent card usage |
| `Badge` | Status badges across admin, agent cards, thread list | Good, consistent |
| `Button` | Throughout | Primary action buttons use Button correctly |
| `Select` | `CronJobForm`, `ProjectSettingsForm`, `ChatInput` agent/model selectors | Proper ShadCN Select with trigger/content/item |
| `Table` | `AgentScheduledTasks` only | The ONE component using proper Table |
| `Skeleton` | Admin list loading states | Consistent loading pattern |
| `ScrollArea` | `ChatArea` | Proper scroll container |
| `Input` | Forms throughout | Consistent |
| `Textarea` | `EditAgentForm` | Correct usage |
| `Dialog` | Thread management modal | Correct |

### Missing ShadCN Usage (Standardization Opportunities)

#### Priority 1 — High Impact, Easy Wins

| Issue | Where | Fix |
|-------|-------|-----|
| **Raw `<textarea>` in CreateAgentForm** | `agents/new` — `CreateAgentForm` | Replace with ShadCN `Textarea` (already used in `EditAgentForm` for same fields) |
| **Raw `<input type="checkbox">`** | `EditAgentForm` (enabled, memory, reflection toggles), `CronJobForm` (enabled toggle) | Replace with ShadCN `Checkbox` (not yet in `packages/ui/` — needs `npx shadcn add checkbox`) |
| **Raw `<select>` in SettingsForm** | `admin/plugins/[name]` settings form for select-type fields | Replace with ShadCN `Select` |
| **Alert banners as raw `<div>`** | Plugin settings (warning/success), `CronJobForm` errors, `EditAgentForm` errors | Replace with ShadCN `Alert` + `AlertDescription` |

#### Priority 2 — Structural Consistency

| Issue | Where | Fix |
|-------|-------|-----|
| **5 admin "tables" as div lists** | `AgentRunsTable`, `CronJobsTable`, `PluginsTable`, `TasksTable`, `ThreadsTable` | Standardize on either ShadCN `Table` (like `AgentScheduledTasks`) or a shared `DataList` component. Current div-list pattern is consistent but not leveraging available components. |
| **Plugin sidebar is hand-coded** | `admin/plugins/layout.tsx` | Replace raw `<aside>/<nav>` with ShadCN `Sidebar` system (or at minimum reuse the `AdminSidebar` pattern) |
| **Memory browser filter tabs** | `AgentMemoryBrowser` — raw `<button>` elements | Replace with a proper tab component or ShadCN `Button` variant="ghost" with active state |

#### Priority 3 — Visual Polish

| Issue | Where | Fix |
|-------|-------|-----|
| **Empty states** | Tasks, Agent Runs, Memory browser, Threads (when empty) | Create a shared `EmptyState` component with icon, message, and optional action button |
| **Usage page has no nav** | `/usage` | Integrate into either the chat layout sidebar or admin sidebar |
| **ALL CAPS labels** | Agent edit form (`SOUL`, `IDENTITY`, etc.) | Standardize label typography across all forms |
| **Hardcoded color values** | Warning banners (`bg-yellow-50`, `text-yellow-800`), success (`bg-green-500/10`) | Use theme variables or ShadCN `Alert` variants |
| **Projects link is 404** | Sidebar links to `/chat/projects` | Either build the page or remove the sidebar link |

---

## Layout Architecture Summary

```
Root Layout (no sidebar)
├── (chat) Layout — ShadCN Sidebar system
│   ├── /chat/[thread-id]      — chat page (polished)
│   ├── /agents                — agent list (decent)
│   ├── /agents/new            — create form (card-wrapped)
│   └── /agents/[id]           — edit form (no card, long form)
├── Admin Layout — custom sidebar (not ShadCN)
│   ├── /admin/cron-jobs       — div list
│   ├── /admin/plugins         — div list + nested hand-coded sidebar
│   ├── /admin/tasks           — div list (empty)
│   ├── /admin/agent-runs      — div list (empty)
│   └── /admin/threads         — div list
└── /usage                     — NO layout wrapper (standalone)
```

**Key architectural inconsistency:** The chat area uses the ShadCN Sidebar system. The admin area uses a hand-coded sidebar. The usage page has no sidebar. Three different navigation paradigms.

---

## New ShadCN Components Needed

These components are NOT yet in `packages/ui/` but should be added:

1. **Checkbox** — for all toggle/boolean fields (currently raw `<input type="checkbox">`)
2. **Switch** — alternative to Checkbox for on/off toggles (better UX for enable/disable)
3. **Tabs** — for memory browser filter tabs, potentially for admin section switching

Install via: `npx shadcn@latest add checkbox switch tabs`

---

## Recommendations for Design System Prep

### Before implementing a design system:

1. **Add missing ShadCN primitives** — Checkbox/Switch, Tabs (3 components)
2. **Fix the 7 raw-HTML-instead-of-ShadCN issues** in Priority 1 above — these are direct substitutions
3. **Decide on a data list pattern** — either commit to ShadCN `Table` for all admin lists or create a shared `DataList` component that formalizes the current div-list pattern
4. **Unify layout structure** — decide if usage page lives inside admin or chat, and whether admin should also use ShadCN Sidebar
5. **Create shared micro-components**: `EmptyState`, `PageHeader` (title + description + action), `StatusBadge` (standardize the enabled/disabled/active badges)
6. **Standardize form patterns** — all forms should use the same label style, error display, and input components

### The design system will have the easiest time if:
- All pages use ShadCN primitives (no raw HTML equivalents)
- There's one sidebar system (ShadCN Sidebar everywhere, or a thin wrapper)
- Color usage goes through CSS variables / theme tokens, not hardcoded Tailwind classes
- Typography follows one scale (no ad-hoc ALL CAPS or font-size overrides)

---

## Screenshots Reference

All screenshots saved in `screenshots/` directory:
- `01-chat-main.png` — Chat page (benchmark)
- `02-agents-list.png` — Agent listing
- `03-agent-edit.png` — Agent edit form
- `04-agent-new.png` — New agent form
- `05-projects-404.png` — Projects page (404)
- `06-admin-cron-jobs.png` — Cron jobs admin
- `07-admin-plugins.png` — Plugins list
- `08-admin-tasks.png` — Tasks (empty)
- `09-admin-agent-runs.png` — Agent runs (empty)
- `10-admin-threads.png` — Threads admin
- `11-admin-plugin-detail.png` — Plugin settings (identity)
- `12-usage.png` — Token usage dashboard
