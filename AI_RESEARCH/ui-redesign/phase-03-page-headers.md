# Phase 3: Page Headers

**Goal**: Consistent, refined page headers that feel structural rather than decorative.

---

## Current Pattern

Every admin page repeats:
```tsx
<h1 className="text-2xl font-semibold tracking-tight">Page Title</h1>
<p className="text-sm text-muted-foreground">Subtitle description.</p>
```

The `+ New Task` button floats right on cron-jobs, but not on other pages. Breadcrumbs exist only on nested pages (cron-job edit, plugin settings).

---

## Changes

### 1. Reduce Heading Weight

`text-2xl` (24px) is large for an admin heading when the content below is 14px. The heading shouldn't be the visual center — the data should be.

Change to `text-lg font-semibold` (18px). This is closer to what Linear and Vercel use for section headings. The heading identifies where you are; the content is what you're here for.

### 2. Add Count Indicators

"Threads" → "Threads (2)". This is a small detail that signals the page is alive and knows its data. The count should be `text-muted-foreground` to avoid visual competition with the heading.

### 3. Consistent Action Button Placement

The "New X" button should always be right-aligned in the header row, inline with the heading. Currently only cron-jobs has this; add it consistently (where applicable):

- Cron Jobs: "+ New Task" (already exists)
- Threads: no create action (threads are created by the system)
- Agent Runs: no create action (runs are created by the pipeline)
- Tasks: no create action (tasks are created by delegation)
- Plugins: no create action (plugins are registered by the orchestrator)
- Usage: no create action

So actually only cron-jobs needs the button. But the header structure should be consistent regardless — a flex row with title left, optional actions right.

### 4. Breadcrumbs on All Nested Pages

Currently only plugin settings and cron-job form have breadcrumbs. Should be consistent:

- `/admin/plugins/identity` → "Plugins > identity" ✓ (already exists)
- `/admin/cron-jobs/new` → "Scheduled Tasks > New" ✓ (already exists)
- `/admin/cron-jobs/[id]/edit` → "Scheduled Tasks > Edit" (verify exists)

The admin-breadcrumb component already exists at `apps/web/src/app/admin/_components/admin-breadcrumb.tsx` — just ensure all nested routes use it.

### 5. Shared Page Header Component

Consider extracting a reusable `AdminPageHeader` component:

```tsx
<AdminPageHeader
  title="Threads"
  count={threads.length}
  description="All conversation threads across agents and sources."
  action={<Button>New Task</Button>} // optional
  breadcrumbs={[{ label: "Scheduled Tasks", href: "/admin/cron-jobs" }, { label: "New" }]} // optional
/>
```

This enforces consistency without repetition.

---

## Estimated Scope

- Possibly 1 new shared component: `AdminPageHeader`
- Touch all 6 admin `page.tsx` files for heading style
- Minor — mostly class name changes
