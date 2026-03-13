# Phase 6: Form Polish

**Goal**: Settings and forms should feel like Vercel's settings pages — grouped, purposeful, with clear affordances.

---

## 6a. Plugin Settings Pages

**Current file**: `apps/web/src/app/admin/plugins/[name]/page.tsx` + `_components/settings-form.tsx`
**Current state**: Naked label → description → input, stacked vertically with no card wrapper. Looks like a wireframe.

### Target: Entity Pattern (Vercel-style)

Each setting becomes a horizontal row:
```
┌──────────────────────────────────────────────────────────────┐
│ Importance Threshold                              [  6  ]    │
│ Minimum score (1-10) for a memory to be saved.              │
├──────────────────────────────────────────────────────────────┤
│ Memory Limit                                      [ 10  ]    │
│ Max memories injected per prompt.                            │
├──────────────────────────────────────────────────────────────┤
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│                                            [ Save Settings ] │
└──────────────────────────────────────────────────────────────┘
```

- Label + description on the left
- Control (input, select, toggle) on the right, vertically centered
- Subtle divider between each row (1px border-b)
- All wrapped in a single Card
- Show placeholder with default value: `placeholder="Default: 6"`

### Responsive Behavior
On mobile, stack vertically (label+description above, control below). On desktop, side-by-side.

---

## 6b. Cron Job Form

**Current file**: `apps/web/src/app/admin/cron-jobs/_components/cron-job-form.tsx`
**Current state**: All fields stacked in one card, separator lines between groups. Functional but flat.

### Changes

1. **Section headers** within the card:
   - "Identity" section: Name, Agent, Thread, Project
   - "Schedule" section: Type toggle, cron expression or datetime
   - "Execution" section: Prompt, Enabled toggle

2. **Segmented control for Type** instead of two buttons. The current implementation uses two styled buttons — replace with a proper segmented control that looks like a single element with two states.

3. **Human-readable schedule preview**: Below the cron expression input, show "Every day at 2:00 PM UTC" parsed from the expression. Libraries like `cronstrue` do this. This is the kind of detail that separates a product from a form.

4. **Prompt textarea improvements**: Larger default height (at least 120px → 180px). Consider monospace font option since prompts are often structured text.

5. **Form actions**: "Cancel" should be ghost/link, "Create Job" should be primary. Align right. This matches Vercel's pattern.

---

## Estimated Scope

- 2 files primarily: `settings-form.tsx`, `cron-job-form.tsx`
- Possibly new dependency: `cronstrue` for human-readable cron
- Moderate effort — form restructuring is fiddly
