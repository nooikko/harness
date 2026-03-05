# UI Standardization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize the Harness web UI onto ShadCN components and unify navigation patterns across chat and admin.

**Architecture:** Admin layout migrates to ShadCN Sidebar (matching chat). Usage page moves into admin. All forms swap raw HTML inputs for ShadCN primitives. Admin data lists rebuild on ShadCN Table + TanStack Table.

**Tech Stack:** ShadCN UI, TanStack React Table, Next.js App Router, Tailwind CSS 4

**Design Doc:** [AI_RESEARCH/2026-03-05-ui-standardization-design.md](./2026-03-05-ui-standardization-design.md)

---

## Task 1: Add Missing ShadCN Primitives

**Files:**
- Create: `packages/ui/src/components/switch.tsx`
- Create: `packages/ui/src/components/tabs.tsx`
- Modify: `packages/ui/src/index.ts`

**Step 1: Install Switch and Tabs components**

Run from `packages/ui/`:
```bash
cd packages/ui && npx shadcn@latest add switch tabs
```

This scaffolds both components into `packages/ui/src/components/`.

**Step 2: Export from barrel**

Add to `packages/ui/src/index.ts`:
```typescript
export { Switch } from './components/switch';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
```

**Step 3: Verify exports**

Run: `pnpm typecheck`
Expected: PASS — no type errors

**Step 4: Commit**

```bash
git add packages/ui/src/components/switch.tsx packages/ui/src/components/tabs.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add Switch and Tabs shadcn components"
```

---

## Task 2: Install TanStack Table

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Add dependency**

```bash
pnpm --filter web add @tanstack/react-table
```

**Step 2: Verify install**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @tanstack/react-table dependency"
```

---

## Task 3: Admin Sidebar — ShadCN Migration

**Files:**
- Modify: `apps/web/src/app/admin/layout.tsx`
- Rewrite: `apps/web/src/app/admin/_components/admin-sidebar.tsx`
- Delete: `apps/web/src/app/admin/_components/admin-nav-link.tsx`
- Update: `apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx`

**Step 1: Rewrite AdminSidebar using ShadCN Sidebar**

Replace `apps/web/src/app/admin/_components/admin-sidebar.tsx` with:

```typescript
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@harness/ui";
import {
  Activity,
  BarChart2,
  Clock,
  MessageSquare,
  Plug,
  SquareCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/cron-jobs", icon: Clock, label: "Cron Jobs" },
  { href: "/admin/plugins", icon: Plug, label: "Plugins" },
  { href: "/admin/tasks", icon: SquareCheck, label: "Tasks" },
  { href: "/admin/agent-runs", icon: Activity, label: "Agent Runs" },
  { href: "/admin/threads", icon: MessageSquare, label: "Threads" },
  { href: "/admin/usage", icon: BarChart2, label: "Usage" },
];

type AdminSidebarComponent = () => React.ReactNode;

export const AdminSidebar: AdminSidebarComponent = () => {
  const pathname = usePathname();

  return (
    <Sidebar className="w-64 border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
```

**Step 2: Update admin layout to use SidebarProvider**

Replace `apps/web/src/app/admin/layout.tsx` with:

```typescript
import { SidebarInset, SidebarProvider } from "@harness/ui";
import type { Metadata } from "next";
import { AdminSidebar } from "./_components/admin-sidebar";

export const metadata: Metadata = {
  title: "Admin | Harness Dashboard",
  description:
    "Manage cron jobs, plugins, tasks, agent runs, and threads",
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

type AdminLayoutComponent = (props: AdminLayoutProps) => React.ReactNode;

const AdminLayout: AdminLayoutComponent = ({ children }) => {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
```

**Step 3: Delete the old AdminNavLink component**

Delete `apps/web/src/app/admin/_components/admin-nav-link.tsx` — no longer used. Its functionality is now inline via `SidebarMenuButton`.

**Step 4: Update admin sidebar test**

Update the test in `apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx` to check for ShadCN sidebar structure:
- Test all 6 nav items render (Cron Jobs, Plugins, Tasks, Agent Runs, Threads, Usage)
- Test active state works for current pathname
- Test links have correct hrefs

**Step 5: Run tests**

```bash
pnpm --filter web test -- admin-sidebar
```

**Step 6: Commit**

```bash
git commit -m "feat(admin): migrate sidebar to ShadCN Sidebar system"
```

---

## Task 4: Move Usage Page into Admin

**Files:**
- Move: `apps/web/src/app/usage/` → `apps/web/src/app/admin/usage/`
- Modify: `apps/web/src/app/_components/settings-menu.tsx` — change `/usage` → `/admin/usage`
- Modify: `apps/web/src/app/(chat)/chat/_components/user-profile-menu.tsx` — change `/usage` → `/admin/usage`
- Modify: `apps/web/src/app/(chat)/chat/_components/thread-cost-badge.tsx` — update import path for `format-cost`
- Update: `apps/web/src/app/_components/__tests__/nav-link.test.tsx` — update `/usage` references
- Delete: old `apps/web/src/app/usage/` directory after move

**Step 1: Move the usage directory**

```bash
mv apps/web/src/app/usage apps/web/src/app/admin/usage
```

**Step 2: Update import in thread-cost-badge.tsx**

Change:
```typescript
import { formatCost } from '@/app/usage/_helpers/format-cost';
```
To:
```typescript
import { formatCost } from '@/app/admin/usage/_helpers/format-cost';
```

**Step 3: Update link in settings-menu.tsx**

Change `href='/usage'` to `href='/admin/usage'`.

**Step 4: Update link in user-profile-menu.tsx**

Change `href='/usage'` to `href='/admin/usage'`.

**Step 5: Update nav-link.test.tsx**

Replace all `/usage` route references with `/admin/usage`.

**Step 6: Update usage page metadata**

In `apps/web/src/app/admin/usage/page.tsx`, the metadata title can stay as "Token Usage | Harness Dashboard" — it inherits the admin layout automatically.

**Step 7: Run tests**

```bash
pnpm --filter web test
```

Fix any broken imports — the tests inside `admin/usage/_components/__tests__/` should still pass since they use relative imports internally.

**Step 8: Verify in browser**

Navigate to `http://localhost:4000/admin/usage` — should show the usage dashboard inside the admin sidebar layout.

**Step 9: Commit**

```bash
git commit -m "refactor(web): move usage page into admin section"
```

---

## Task 5: Plugin Sidebar — ShadCN Migration

**Files:**
- Modify: `apps/web/src/app/admin/plugins/layout.tsx`
- Modify: `apps/web/src/app/admin/plugins/_components/plugins-nav.tsx`

**Step 1: Rewrite plugins layout**

Replace the raw `<aside>` in `apps/web/src/app/admin/plugins/layout.tsx` with ShadCN sidebar primitives. Since this is a nested sidebar within admin, use a `SidebarGroup` or a secondary nav panel — NOT a full `<Sidebar>` (that would conflict with the parent admin sidebar).

Use a simple card-like side panel:
```typescript
import { prisma } from "@harness/database";
import { ScrollArea, Separator } from "@harness/ui";
import { PluginsNav } from "./_components/plugins-nav";

type PluginsLayoutProps = { children: React.ReactNode };
type PluginsLayoutComponent = (
  props: PluginsLayoutProps,
) => Promise<React.ReactNode>;

const PluginsLayout: PluginsLayoutComponent = async ({ children }) => {
  const configs = await prisma.pluginConfig.findMany({
    orderBy: { pluginName: "asc" },
  });

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-56 shrink-0 border-r border-border">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plugins
          </p>
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <PluginsNav configs={configs} />
        </ScrollArea>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};

export default PluginsLayout;
```

This keeps the structural pattern but adds `Separator` and `ScrollArea` from ShadCN. The outer `<main>` is no longer needed since the admin layout already provides one.

**Step 2: Update PluginsNav to use consistent link styling**

In `plugins-nav.tsx`, ensure links match the ShadCN sidebar button styling. The green dot pattern is fine to keep — it's domain-specific.

**Step 3: Run tests**

```bash
pnpm --filter web test -- plugins-nav
```

**Step 4: Commit**

```bash
git commit -m "refactor(admin): clean up plugin sidebar with ShadCN primitives"
```

---

## Task 6: Form Fixes — CreateAgentForm (raw textarea → Textarea)

**Files:**
- Modify: `apps/web/src/app/(chat)/agents/_components/create-agent-form.tsx`
- Modify: `apps/web/src/app/(chat)/agents/_components/__tests__/create-agent-form.test.tsx` (if exists)

**Step 1: Replace raw textareas**

In `create-agent-form.tsx`, import `Textarea` from `@harness/ui` and replace all 3 raw `<textarea>` elements (soul, identity, backstory) with `<Textarea>`. The ShadCN Textarea uses the same API (`value`, `onChange`, `placeholder`, `rows`, `className`).

Replace each instance like:
```typescript
<textarea
  id='agent-soul'
  value={soul}
  onChange={(e) => setSoul(e.target.value)}
  className='w-full rounded-md border ...'
  rows={6}
  placeholder='...'
/>
```
With:
```typescript
<Textarea
  id='agent-soul'
  value={soul}
  onChange={(e) => setSoul(e.target.value)}
  rows={6}
  placeholder='...'
/>
```

Remove the manually-duplicated className strings — `Textarea` handles its own styling.

**Step 2: Run tests**

```bash
pnpm --filter web test -- create-agent-form
```

**Step 3: Commit**

```bash
git commit -m "fix(agents): replace raw textarea with ShadCN Textarea in CreateAgentForm"
```

---

## Task 7: Form Fixes — Checkboxes → Switch

**Files:**
- Modify: `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx` (3 checkboxes)
- Modify: `apps/web/src/app/admin/cron-jobs/_components/cron-job-form.tsx` (1 checkbox)
- Modify: `apps/web/src/app/(chat)/agents/_components/__tests__/edit-agent-form.test.tsx`
- Modify: `apps/web/src/app/admin/cron-jobs/_components/__tests__/cron-job-form.test.tsx`

**Step 1: Replace checkboxes in EditAgentForm**

Import `Switch` from `@harness/ui`. Replace each `<input type='checkbox'>` with `<Switch>`.

ShadCN Switch API: `<Switch checked={value} onCheckedChange={setValue} id="..." />`

Replace pattern:
```typescript
<input
  id='edit-agent-enabled'
  type='checkbox'
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
  className='...'
/>
```
With:
```typescript
<Switch
  id='edit-agent-enabled'
  checked={enabled}
  onCheckedChange={setEnabled}
  aria-label='Enabled'
/>
```

Do this for all 3 toggles: enabled, memoryEnabled, reflectionEnabled.

**Step 2: Replace checkbox in CronJobForm**

Same pattern for the single `enabled` toggle in `cron-job-form.tsx`.

**Step 3: Update tests**

ShadCN Switch renders as `<button role="switch">` not `<input type="checkbox">`. Tests that use `getByLabelText('Enabled')` should still work if the `id` + `<Label htmlFor>` pairing is maintained. But `toBeChecked()` won't work on a button — use `toHaveAttribute('data-state', 'checked')` or `toHaveAttribute('aria-checked', 'true')` instead.

Update test assertions in both `edit-agent-form.test.tsx` and `cron-job-form.test.tsx`:
```typescript
// Before
expect(checkbox).toBeChecked();
// After
expect(toggle).toHaveAttribute('aria-checked', 'true');
```

And click interactions change from `fireEvent.click` to `await user.click` (the Switch should respond to clicks the same way).

**Step 4: Run tests**

```bash
pnpm --filter web test -- edit-agent-form cron-job-form
```

**Step 5: Commit**

```bash
git commit -m "fix(forms): replace raw checkboxes with ShadCN Switch"
```

---

## Task 8: Form Fixes — Raw select → ShadCN Select (SettingsForm)

**Files:**
- Modify: `apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx`

**Step 1: Replace raw select**

Import `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@harness/ui`.

Replace the raw `<select>` block (around line 59):
```typescript
<select
  id={field.name}
  name={field.name}
  defaultValue={...}
  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
>
  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
</select>
```
With:
```typescript
<Select name={field.name} defaultValue={...}>
  <SelectTrigger id={field.name}>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    {field.options.map(opt => (
      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Note: ShadCN Select uses Radix which doesn't natively submit via `<form>`. Since `settings-form.tsx` uses a server action with `FormData`, you may need to add a hidden `<input>` or switch to controlled state. Check how the form submits — if it uses `useFormState`/`useActionState`, a hidden input is the cleanest approach.

**Step 2: Run tests**

```bash
pnpm --filter web test -- settings-form
```

**Step 3: Commit**

```bash
git commit -m "fix(admin): replace raw select with ShadCN Select in plugin settings"
```

---

## Task 9: Form Fixes — Alert Banners

**Files:**
- Modify: `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx`
- Modify: `apps/web/src/app/(chat)/agents/_components/create-agent-form.tsx`
- Modify: `apps/web/src/app/admin/cron-jobs/_components/cron-job-form.tsx`
- Modify: `apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx`
- Modify: `apps/web/src/app/admin/plugins/[name]/page.tsx`

**Step 1: Replace error/success/warning banners**

Import `Alert, AlertDescription` from `@harness/ui`.

Error banners — replace:
```typescript
<p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p>
```
With:
```typescript
<Alert variant='destructive'>
  <AlertDescription>{error}</AlertDescription>
</Alert>
```

Success banners — replace:
```typescript
<p className='rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400'>Agent updated successfully.</p>
```
With:
```typescript
<Alert>
  <AlertDescription>Agent updated successfully.</AlertDescription>
</Alert>
```

Warning banners (plugin disabled, required fields) — replace:
```typescript
<div className='rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>...</div>
```
With:
```typescript
<Alert>
  <AlertDescription>...</AlertDescription>
</Alert>
```

Do this in all 5 files listed above. The exact instances:
1. `edit-agent-form.tsx:94` — error banner
2. `edit-agent-form.tsx:95` — success banner
3. `create-agent-form.tsx:74` — error banner
4. `cron-job-form.tsx:153` — error banner
5. `cron-job-form.tsx:155` — success banner
6. `settings-form.tsx:40` — required fields warning
7. `settings-form.tsx:45` — error banner
8. `plugins/[name]/page.tsx:39` — disabled plugin warning

**Step 2: Run tests**

```bash
pnpm --filter web test
```

**Step 3: Commit**

```bash
git commit -m "fix(forms): replace raw alert divs with ShadCN Alert"
```

---

## Task 10: Memory Browser — Tabs Migration

**Files:**
- Modify: `apps/web/src/app/(chat)/agents/_components/agent-memory-browser.tsx`

**Step 1: Replace raw button tabs**

Import `Tabs, TabsList, TabsTrigger` from `@harness/ui`.

Replace the raw `<button>` tab row (around line 97-113) with:

```typescript
<Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)}>
  <TabsList>
    {FILTER_TABS.map((tab) => (
      <TabsTrigger key={tab} value={tab}>
        {tab === 'ALL' ? 'All' : MEMORY_TYPE_LABELS[tab]}
        <Badge variant='secondary' className='ml-1.5'>
          {tab === 'ALL' ? memories.length : memories.filter((m) => m.type === tab).length}
        </Badge>
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

Remove the old `<div className='flex border-b'>` wrapper. The filtered content rendering below stays the same — it's driven by `activeFilter` state which is now set via `onValueChange`.

**Step 2: Run tests**

```bash
pnpm --filter web test -- agent-memory-browser
```

**Step 3: Commit**

```bash
git commit -m "fix(agents): replace raw filter buttons with ShadCN Tabs in memory browser"
```

---

## Task 11: Admin Tables — CronJobsTable

**Files:**
- Rewrite: `apps/web/src/app/admin/cron-jobs/_components/cron-jobs-table.tsx`
- Update: `apps/web/src/app/admin/cron-jobs/_components/__tests__/cron-jobs-table.test.tsx`

**Step 1: Rewrite using TanStack Table + ShadCN Table**

Create column definitions for: Name, Schedule/FireAt, Agent, Status (Badge), Last Run, Next Run, Actions (toggle form, edit link, delete button).

Use `useReactTable` with `getCoreRowModel` and `getSortedRowModel`. Render with ShadCN `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell`.

Keep the existing server action form patterns for toggle/delete — just wrap them in table cells.

Add sortable column headers (click to toggle sort direction) for Name, Last Run, Next Run.

**Step 2: Update tests**

Tests should check:
- Table headers render
- Rows render for each cron job
- Badge shows correct status (Enabled/Disabled)
- Action buttons present (toggle, edit, delete)
- Empty state message when no jobs

**Step 3: Run tests**

```bash
pnpm --filter web test -- cron-jobs-table
```

**Step 4: Commit**

```bash
git commit -m "refactor(admin): rebuild CronJobsTable with ShadCN Table + TanStack"
```

---

## Task 12: Admin Tables — PluginsTable

**Files:**
- Rewrite: `apps/web/src/app/admin/plugins/_components/plugins-table.tsx`
- Update: `apps/web/src/app/admin/plugins/_components/__tests__/plugins-table.test.tsx`

**Step 1: Rewrite**

Columns: Name, Status (Badge — Enabled/Disabled), Actions (Disable/Enable button).

Simple table — no sorting needed (alphabetical by default from DB query).

**Step 2: Update tests and run**

```bash
pnpm --filter web test -- plugins-table
```

**Step 3: Commit**

```bash
git commit -m "refactor(admin): rebuild PluginsTable with ShadCN Table + TanStack"
```

---

## Task 13: Admin Tables — TasksTable

**Files:**
- Rewrite: `apps/web/src/app/admin/tasks/_components/tasks-table.tsx`
- Update: `apps/web/src/app/admin/tasks/_components/__tests__/tasks-table.test.tsx`

**Step 1: Rewrite**

Columns: Name, Status (Badge), Agent, Thread, Created.

Sortable by Created date.

**Step 2: Update tests and run**

```bash
pnpm --filter web test -- tasks-table
```

**Step 3: Commit**

```bash
git commit -m "refactor(admin): rebuild TasksTable with ShadCN Table + TanStack"
```

---

## Task 14: Admin Tables — AgentRunsTable

**Files:**
- Rewrite: `apps/web/src/app/admin/agent-runs/_components/agent-runs-table.tsx`
- Update: `apps/web/src/app/admin/agent-runs/__tests__/page.test.tsx`

**Step 1: Rewrite**

Columns: Agent, Model, Input Tokens, Output Tokens, Cost, Duration, Date.

Sortable by Date, Cost.

**Step 2: Update tests and run**

```bash
pnpm --filter web test -- agent-runs
```

**Step 3: Commit**

```bash
git commit -m "refactor(admin): rebuild AgentRunsTable with ShadCN Table + TanStack"
```

---

## Task 15: Admin Tables — ThreadsTable

**Files:**
- Rewrite: `apps/web/src/app/admin/threads/_components/threads-table.tsx`
- Update: `apps/web/src/app/admin/threads/__tests__/page.test.tsx`

**Step 1: Rewrite**

Columns: Name, Status (Badge), Kind (Badge), Source, Messages, Last Activity, Actions (View link, Archive button).

Sortable by Last Activity.

**Step 2: Update tests and run**

```bash
pnpm --filter web test -- threads
```

**Step 3: Commit**

```bash
git commit -m "refactor(admin): rebuild ThreadsTable with ShadCN Table + TanStack"
```

---

## Task 16: Final Validation

**Step 1: Full test suite**

```bash
pnpm test
```

**Step 2: Type check**

```bash
pnpm typecheck
```

**Step 3: Lint**

```bash
pnpm lint
```

**Step 4: Build**

```bash
pnpm build
```

**Step 5: Visual verification**

Navigate through all pages in browser at `http://localhost:4000`:
- `/chat/*` — unchanged (benchmark)
- `/agents` — agent cards unchanged
- `/agents/[id]` — Switch toggles, ShadCN Textarea consistency, Tabs in memory browser, Alert banners
- `/agents/new` — ShadCN Textarea
- `/admin/cron-jobs` — ShadCN Table, ShadCN Sidebar
- `/admin/plugins` — ShadCN Table, cleaned plugin sidebar
- `/admin/plugins/[name]` — ShadCN Select, Alert banners
- `/admin/tasks` — ShadCN Table
- `/admin/agent-runs` — ShadCN Table
- `/admin/threads` — ShadCN Table
- `/admin/usage` — usage dashboard inside admin layout

**Step 6: Commit any remaining fixes**

```bash
git commit -m "chore(web): final cleanup from UI standardization pass"
```

---

## Task Dependencies

```
Task 1 (ShadCN primitives) ──┐
Task 2 (TanStack install)  ──┼── Can run in parallel
                              │
Task 3 (Admin sidebar)     ←──┘ depends on Task 1 (uses SidebarProvider)
Task 4 (Move usage)        ←── depends on Task 3 (sidebar has Usage link)
Task 5 (Plugin sidebar)    ←── depends on Task 3 (admin layout changed)
                              │
Task 6 (Textarea fix)      ──┐
Task 7 (Switch fix)        ──┤ depend on Task 1 (Switch component)
Task 8 (Select fix)        ──┤ independent
Task 9 (Alert fix)         ──┤ independent
Task 10 (Tabs fix)         ──┘ depends on Task 1 (Tabs component)
                              │
Tasks 11-15 (Tables)       ←── depend on Task 2 (TanStack) + Task 3 (admin layout)
                              │
Task 16 (Validation)       ←── depends on all above
```

Tasks 6-10 (form fixes) are independent of Tasks 3-5 (layout changes) and can be parallelized.
Tasks 11-15 (tables) are independent of each other and can be parallelized.
