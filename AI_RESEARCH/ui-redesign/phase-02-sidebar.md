# Phase 2: Sidebar Redesign

**Goal**: Transform the flat nav list into a grouped, visually anchored navigation that signals structure.

**Current**: 6 items in a flat list under "Admin" label. Active state is a subtle background tint.
**File**: `apps/web/src/app/admin/_components/admin-sidebar.tsx`

---

## Changes

### 1. Group Navigation Items

Current flat list → three semantic groups:

```
Configuration
  Plugins          (Puzzle icon)
  Cron Jobs        (Calendar icon)

Activity
  Agent Runs       (Play icon → Activity icon)
  Tasks            (CheckSquare icon)
  Threads          (MessageSquare icon)

Analytics
  Usage            (BarChart3 icon)
```

The grouping tells the user: "Plugins and Cron Jobs are things you configure. Agent Runs, Tasks, and Threads are things you monitor. Usage is data you observe."

Reorder: Configuration first (you set things up), Activity second (you monitor what happens), Analytics third (you review trends).

### 2. Stronger Active State

Current: `SidebarMenuButton isActive` gives a slight background tint.

Target: Left accent bar (2px wide, primary color) + slightly more opaque background. The accent bar is what Linear does — it's a strong positional anchor that lets you find your place instantly even peripherally.

Implementation: Override in the sidebar component or via CSS:
```css
[data-active="true"] {
  position: relative;
}
[data-active="true"]::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;
  background: var(--color-primary);
}
```

### 3. Icon Refinements

- Agent Runs: Change `Play` → `Activity` (Play implies "start something", Activity implies "monitoring")
- Consider `Zap` for Agent Runs if Activity feels too generic
- Keep all other icons — they're descriptive

### 4. Group Label Styling

The `SidebarGroupLabel` should be:
- ALL CAPS, 10px, letter-spacing: 0.05em, text-muted-foreground/50
- This is the Linear/Vercel pattern — tiny muted labels that organize without competing

---

## Implementation

This is mostly a restructure of the `NAV_ITEMS` array into groups + CSS changes. The `SidebarGroup` and `SidebarGroupLabel` components from `@harness/ui` already support this — the current code just uses one group.

```tsx
const NAV_GROUPS = [
  {
    label: 'Configuration',
    items: [
      { href: '/admin/plugins', label: 'Plugins', icon: Puzzle },
      { href: '/admin/cron-jobs', label: 'Cron Jobs', icon: Calendar },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/admin/agent-runs', label: 'Agent Runs', icon: Activity },
      { href: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/admin/threads', label: 'Threads', icon: MessageSquare },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
    ],
  },
];
```

---

## Estimated Scope

- 1 file changed: `admin-sidebar.tsx`
- Minor CSS additions for active state accent bar
- No new dependencies
