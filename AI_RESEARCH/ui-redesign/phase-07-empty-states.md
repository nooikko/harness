# Phase 7: Empty States

**Goal**: Empty states should invite action, not just explain absence.

---

## Current Pattern (All Pages)

```tsx
<div className="border border-dashed rounded-lg py-20 text-center">
  <Icon className="h-10 w-10 text-muted-foreground/50" />
  <p className="font-medium">No X yet</p>
  <p className="text-muted-foreground">X appear when Y happens.</p>
</div>
```

The dashed border screams "placeholder" and "wireframe". The copy is clinical. The icon is too muted to be noticeable.

---

## New Pattern

### Remove Dashed Border
No border at all — or a very subtle solid border. The empty state should feel like part of the page, not a placeholder box. Vercel's empty states use no border.

### Warmer Copy
Instead of explaining the system ("Runs appear when agents process messages"), suggest what to do or set expectations:

| Current | New |
|---------|-----|
| "No agent runs yet. Runs appear when agents process messages." | "No runs recorded. Send a message in any thread to see agent activity here." |
| "No delegation tasks yet. Tasks appear when agents delegate work to sub-agents." | "No active tasks. Delegation tasks will appear when agents break work into sub-steps." |
| "No threads yet. Threads are created when users start conversations." | "No conversations yet. Start a new chat to create your first thread." |
| "No scheduled tasks yet. Create tasks to run prompts on a schedule." | "No scheduled tasks. Set up recurring or timed prompts for your agents." |

### Icon Treatment
- Slightly larger: 32px instead of 40px (counterintuitively, slightly smaller can look more refined)
- Actually, keep 40px but use a lighter stroke weight or a filled variant
- Use `text-muted-foreground/30` instead of `/50` — more subtle

### CTA Where Applicable
Only cron-jobs has a natural CTA ("+ New Task"). Others are system-generated, so no CTA — just informational.

### Loading/Empty Guard
Never flash empty state during loading. The Suspense fallback (skeleton) should cover the loading period completely. This is already the case with the current Suspense architecture — just verify.

---

## Shared Component

Create `apps/web/src/app/admin/_components/empty-state.tsx`:

```tsx
type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};
```

Every table uses this instead of duplicating the pattern.

---

## Estimated Scope

- 1 new shared component
- Touch all 4 table components + plugins table
- Mostly copy and class name changes — low effort
