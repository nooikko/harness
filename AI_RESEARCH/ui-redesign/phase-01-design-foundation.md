# Phase 1: Design Foundation

**Goal**: Establish the visual vocabulary that every subsequent phase builds on.

---

## 1a. Semantic Color System

Currently all status badges use purple (`variant='default'`) for enabled/active and grey (`variant='secondary'`) for disabled. This encodes no meaning — everything looks the same.

### New Status Color Map

| Semantic | Color | CSS Variable | Use Cases |
|----------|-------|-------------|-----------|
| Success/Active | Green | `--color-success` (already exists: oklch 0.580 0.115 150) | Plugin enabled, thread active, run completed, job enabled |
| Inactive/Disabled | Grey | `--color-muted-foreground` | Plugin disabled, job disabled, archived thread |
| Running/In-Progress | Blue | New: `--color-info` ~oklch(0.580 0.130 250) | Agent run in-progress, task running |
| Warning | Amber | `--color-warning` (already exists: oklch 0.680 0.105 70) | Budget approaching, approaching limits |
| Error/Failed | Red | `--color-destructive` (already exists) | Run failed, task failed |

### Implementation

Add new Badge variants or use dot indicators instead of text badges for status:

```tsx
// Instead of <Badge variant="default">Enabled</Badge>
// Use a colored dot + text
<span className="inline-flex items-center gap-1.5 text-xs">
  <span className="h-2 w-2 rounded-full bg-success" />
  Enabled
</span>
```

The dot pattern is more Linear-like and takes less visual space than a full badge. Reserve the Badge component for categorical labels (thread kind: "general", "cron", "system") where color isn't semantic.

### Files to Change
- `apps/web/src/app/globals.css` — add `--color-info` variable
- Every `*-table.tsx` component — replace Badge status with dot indicator
- May need a shared `StatusDot` component in `_components/`

---

## 1b. Relative Time Utility

Currently inconsistent: plugins use `formatRelativeTime` (relative), everything else uses `formatDate` (absolute). Standardize on relative time everywhere with tooltip for exact.

### Shared Helper

Create `apps/web/src/app/admin/_helpers/format-relative-time.ts` — one source of truth:

```
now → "just now"
<60s → "just now"
<60m → "3m ago"
<24h → "2h ago"
<7d → "3d ago"
<30d → "Mar 4"
>30d → "Mar 4, 2025"
```

Tooltip shows full datetime: "March 4, 2026 at 10:00 PM MST"

### Files to Change
- New: `apps/web/src/app/admin/_helpers/format-relative-time.ts`
- All `*-table.tsx` components — replace `formatDate` calls
- Consider a `<RelativeTime date={date} />` client component with tooltip

---

## 1c. Model Name Humanizer

Agent runs currently display `claude-haiku-4-5-20251001`. This is unreadable.

### Short Name Map

```
claude-haiku-4-5-20251001 → "Haiku 4.5"
claude-sonnet-4-5-20250514 → "Sonnet 4.5"
claude-opus-4-5-20250514 → "Opus 4.5"
claude-sonnet-4-6 → "Sonnet 4.6"
claude-opus-4-6 → "Opus 4.6"
```

Create `apps/web/src/app/admin/_helpers/humanize-model-name.ts` with fallback to short ID for unknown models.

---

## 1d. Animation Tokens

Add to globals.css or a shared utility:

```css
/* Transition timings */
--transition-hover: 200ms ease;
--transition-press: 150ms cubic-bezier(.2, .8, .2, 1);
--transition-fade: 150ms ease-out;

/* Standard keyframes */
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
```

---

## Estimated Scope

- 1 new CSS variable
- 2-3 new shared helpers
- 1 possible new shared component (StatusDot or RelativeTime)
- Touch every table component to swap formatDate → formatRelativeTime
- Touch every status badge to swap Badge → dot indicator
