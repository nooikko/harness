# UI Standardization Design

**Date:** 2026-03-05
**Status:** Approved
**Audit:** [2026-03-05-ui-standardization-audit.md](./2026-03-05-ui-standardization-audit.md)

---

## Goal

Standardize the Harness web UI onto ShadCN components so that a future design system can be applied uniformly. No new features — only component alignment and structural cleanup.

## Decisions

- Admin keeps a **separate layout** with its own ShadCN Sidebar (not merged into chat sidebar)
- Both chat and admin **share the existing top header bar**
- Admin data lists become **ShadCN Table + TanStack Table** (sorting, column headers, empty states)
- Boolean toggles use **ShadCN Switch** (not Checkbox)
- Memory browser filter row uses **ShadCN Tabs**

---

## 1. Admin Layout — ShadCN Sidebar Migration

### Current State
- `AdminSidebar` is a raw `<aside>` with manual `w-60`, border, and nav
- Admin layout uses `<div className='flex'>` + `<main>`

### Target State
- Admin layout wraps in `<SidebarProvider>` + `<SidebarInset>` (same pattern as chat layout)
- `AdminSidebar` rebuilt using ShadCN `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
- Nav items: Cron Jobs, Plugins, Tasks, Agent Runs, Threads, **Usage** (new)

### Files Changed
- `apps/web/src/app/admin/layout.tsx` — wrap in SidebarProvider
- `apps/web/src/app/admin/_components/admin-sidebar.tsx` — rebuild with ShadCN Sidebar
- `apps/web/src/app/admin/_components/admin-nav-link.tsx` — replace with SidebarMenuButton

---

## 2. Usage Page → Admin

### Current State
- Standalone route at `apps/web/src/app/usage/`
- No sidebar, no layout wrapper
- 4 child components: `cost-over-time-chart`, `tokens-over-time-chart`, `usage-by-model-table`, `usage-summary-section`

### Target State
- Move to `apps/web/src/app/admin/usage/`
- Inherits admin layout (ShadCN Sidebar)
- Add "Usage" nav entry to admin sidebar
- Remove old `/usage` route

### Files Moved
- `apps/web/src/app/usage/page.tsx` → `apps/web/src/app/admin/usage/page.tsx`
- `apps/web/src/app/usage/_components/*` → `apps/web/src/app/admin/usage/_components/*`
- Update any links pointing to `/usage`

---

## 3. Admin Data Tables — ShadCN Table + TanStack Table

### Current State
All 5 admin "table" components use a custom `<div>` list pattern with `<div className='mx-1 h-px bg-border/40'>` dividers. No headers, no sorting, no filtering. The only component using ShadCN `Table` is `AgentScheduledTasks`.

### Target State
Each table component rebuilt with:
- ShadCN `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell`
- TanStack Table (`@tanstack/react-table`) for column definitions, sorting state
- Proper empty states with messaging
- Consistent column structure

### Table Specifications

| Component | Columns |
|-----------|---------|
| `CronJobsTable` | Name, Schedule/FireAt, Agent, Status (badge), Last Run, Next Run, Actions (toggle, edit, delete) |
| `PluginsTable` | Name, Status (badge), Actions (enable/disable) |
| `TasksTable` | Name, Status (badge), Agent, Thread, Created |
| `AgentRunsTable` | Agent, Model, Input Tokens, Output Tokens, Cost, Duration, Date |
| `ThreadsTable` | Name, Status (badge), Kind (badge), Source, Messages, Last Activity, Actions (view, archive) |

### Dependencies
- `@tanstack/react-table` — add to `apps/web/package.json`

---

## 4. Form Component Fixes

### New ShadCN Components to Add
```bash
npx shadcn@latest add switch tabs
```
Added to `packages/ui/src/components/` and exported from `packages/ui/src/index.ts`.

### Substitutions

| Current | Replacement | Files |
|---------|-------------|-------|
| Raw `<textarea>` | ShadCN `Textarea` | `CreateAgentForm` (soul, identity, backstory fields) |
| Raw `<input type="checkbox">` | ShadCN `Switch` | `EditAgentForm` (enabled, memoryEnabled, reflectionEnabled), `CronJobForm` (enabled) |
| Raw `<select>` | ShadCN `Select` | `SettingsForm` (plugin settings select-type fields) |
| Raw alert `<div>` with hardcoded colors | ShadCN `Alert` + `AlertDescription` | `SettingsForm` (warning/success), `CronJobForm` (error), plugin detail pages (warning) |
| Raw `<button>` filter tabs | ShadCN `Tabs` + `TabsList` + `TabsTrigger` | `AgentMemoryBrowser` (All/Episodic/Semantic/Reflection tabs) |

---

## 5. Plugin Sidebar Cleanup

### Current State
`apps/web/src/app/admin/plugins/layout.tsx` has a hand-coded `<aside>` with raw `<nav>`, `<p>`, and link elements for the plugin list.

### Target State
Rebuild using ShadCN sidebar primitives — nested within the admin layout. Use `SidebarGroup` with plugin links as `SidebarMenuButton` items. Maintain the green status dots.

### Files Changed
- `apps/web/src/app/admin/plugins/layout.tsx`

---

## 6. Out of Scope

- Design system / color theme / typography changes
- New pages or features
- Chat interface changes (benchmark — don't touch)
- Projects page 404 (separate issue)
- Pagination (data sets are small enough)
- Mobile responsiveness overhaul
