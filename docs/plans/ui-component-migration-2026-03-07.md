# UI Component Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all rebuilt shadcn components from `apps/design/src/components/` into `packages/ui/src/components/`, replacing the old Radix-only implementations with the motion-animated design system versions, and wire up the web app to work with all API changes.

**Architecture:** Each design component is copied into `packages/ui`, imports are fixed (`from 'ui'` → `from '../index'`), `'use client'` directives are added back (required by Next.js), and `motion` is added as a runtime dependency of the UI package. New design tokens are injected into the web app's `globals.css`. Three components have breaking API changes (Tooltip, Switch, Tabs visuals); web callers are updated accordingly.

**Tech Stack:** React 19, Tailwind CSS 4, `motion/react` (Framer Motion), Radix UI primitives, Vitest + Testing Library, Next.js 16 App Router, tsup (ui package build)

**Rollback:** `git reset --hard HEAD~1` returns to the pre-migration checkpoint commit (`1c44a55`).

---

## Context: What Changed and Why It Matters

### Components with compatible APIs (same props, new internals)
Tabs, Dialog, AlertDialog, Command, DropdownMenu, Collapsible, Popover, Select, ScrollArea, Separator, Alert, AlertDialog, Card, Badge, Label, Input, Textarea, Skeleton, Table, Progress

### Components with BREAKING API changes

| Component | Old API | New API | Web files affected |
|-----------|---------|---------|-------------------|
| **Tooltip** | `<TooltipProvider><Tooltip><TooltipTrigger/><TooltipContent/></Tooltip></TooltipProvider>` | `<Tooltip content="text">{children}</Tooltip>` | **None** (not currently used in web) |
| **Switch** | Accepts all Radix SwitchPrimitive props including `id`, `disabled`, etc. | Only `{ checked, onCheckedChange }` — no `id` support | `cron-job-form.tsx`, `edit-agent-form.tsx` — fix by adding `id` + HTML attrs to new Switch |
| **Button** | `h-10` default height, uses `focus-visible:ring-*` | `h-8` default height, uses `motion.button` with spring animation | Visual change only — no prop API break |

### New component
- `kbd.tsx` — `<Kbd>⌘K</Kbd>` — keyboard shortcut display. Does not yet exist in `packages/ui`.

### CSS tokens gap
The design components use CSS custom properties not yet in `apps/web/src/app/globals.css`:
- `--border-strong`, `--border-subtle`
- `--font-mono`
- `--radius-pill`
- `--shadow-md`, `--shadow-lg`
- `--surface-card`, `--surface-hover`, `--surface-page`
- `--text-primary`, `--text-secondary`, `--text-tertiary`

These must be added to `globals.css` before the components are shipped. Values come from `apps/design/src/tokens.css`.

### Import fix required for every component
Design components use `import { cn } from 'ui'`. In `packages/ui/src/components/`, this must be `import { cn } from '../index'`.

### `'use client'` directives
Design components have no `'use client'` (Vite app). `packages/ui` is consumed by Next.js — every component that uses hooks, event handlers, or context must have `'use client'` at the top.

**Rule of thumb:** Any component file that imports `React.useState`, `React.useContext`, `React.useEffect`, event handlers (onClick, etc.), or `motion` → needs `'use client'`.

---

## Task 1: Add design tokens to web app globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Step 1: Read the current globals.css `:root` block**

Run: `head -80 apps/web/src/app/globals.css`

**Step 2: Add the missing tokens inside the `:root` block**

Find the `:root {` block and append these tokens before its closing `}`:

```css
  /* ─── Design system tokens (migrated from apps/design) ────────── */
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  --surface-page:    oklch(1.000 0.000 285);
  --surface-card:    oklch(0.980 0.005 285);
  --surface-hover:   oklch(0.945 0.013 285);

  --border-subtle:   oklch(0.920 0.012 285);
  --border-strong:   oklch(0.820 0.025 285);

  --text-primary:    oklch(0.160 0.010 285);
  --text-secondary:  oklch(0.440 0.015 285);
  --text-tertiary:   oklch(0.640 0.010 285);

  --radius-pill:     999px;

  --shadow-md: 0 2px 8px oklch(0.160 0.010 285 / 0.08), 0 1px 2px oklch(0.160 0.010 285 / 0.04);
  --shadow-lg: 0 8px 24px oklch(0.160 0.010 285 / 0.10), 0 2px 6px oklch(0.160 0.010 285 / 0.05);
```

**Step 3: Verify web still typechecks**

Run: `pnpm --filter web typecheck 2>&1 | tail -5`
Expected: no errors

**Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): add design system tokens to globals.css"
```

---

## Task 2: Add `motion` dependency to `packages/ui`

**Files:**
- Modify: `packages/ui/package.json`

**Step 1: Add motion as a runtime dependency**

In `packages/ui/package.json`, add to `"dependencies"`:
```json
"motion": "^12.35.0"
```

**Step 2: Install**

Run: `pnpm install`
Expected: motion installed in ui package

**Step 3: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): add motion dependency for animated components"
```

---

## Task 3: Migrate simple components (no API changes, no motion)

These components: `alert`, `badge`, `card`, `input`, `label`, `skeleton`, `textarea`

All have the same external API and no motion usage. No `'use client'` needed (no hooks).

**Files:**
- Modify: `packages/ui/src/components/alert.tsx`
- Modify: `packages/ui/src/components/badge.tsx`
- Modify: `packages/ui/src/components/card.tsx`
- Modify: `packages/ui/src/components/input.tsx`
- Modify: `packages/ui/src/components/label.tsx`
- Modify: `packages/ui/src/components/skeleton.tsx`
- Modify: `packages/ui/src/components/textarea.tsx`

**Step 1: For each file, copy from design and fix the import**

Pattern for each:
1. Open `apps/design/src/components/<name>.tsx`
2. Copy content to `packages/ui/src/components/<name>.tsx`
3. Change `import { cn } from 'ui'` → `import { cn } from '../index'`
4. Do NOT add `'use client'` — these are pure render components

**Step 2: Run typecheck**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/ui/src/components/alert.tsx \
        packages/ui/src/components/badge.tsx \
        packages/ui/src/components/card.tsx \
        packages/ui/src/components/input.tsx \
        packages/ui/src/components/label.tsx \
        packages/ui/src/components/skeleton.tsx \
        packages/ui/src/components/textarea.tsx
git commit -m "feat(ui): migrate simple stateless components from design app"
```

---

## Task 4: Migrate Radix-based components (no motion, client-side)

These components: `collapsible`, `scroll-area`, `separator`, `select`, `dropdown-menu`, `popover`, `table`

All use Radix UI primitives and must have `'use client'`. No motion usage.

**Files:**
- Modify: `packages/ui/src/components/collapsible.tsx`
- Modify: `packages/ui/src/components/scroll-area.tsx`
- Modify: `packages/ui/src/components/separator.tsx`
- Modify: `packages/ui/src/components/select.tsx`
- Modify: `packages/ui/src/components/dropdown-menu.tsx`
- Modify: `packages/ui/src/components/popover.tsx`
- Modify: `packages/ui/src/components/table.tsx`

**Step 1: For each file, copy from design and fix**

1. Copy `apps/design/src/components/<name>.tsx` to `packages/ui/src/components/<name>.tsx`
2. Change `import { cn } from 'ui'` → `import { cn } from '../index'`
3. Add `'use client';` as the first line

**Step 2: Run typecheck**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`

**Step 3: Commit**

```bash
git add packages/ui/src/components/collapsible.tsx \
        packages/ui/src/components/scroll-area.tsx \
        packages/ui/src/components/separator.tsx \
        packages/ui/src/components/select.tsx \
        packages/ui/src/components/dropdown-menu.tsx \
        packages/ui/src/components/popover.tsx \
        packages/ui/src/components/table.tsx
git commit -m "feat(ui): migrate Radix-based components from design app"
```

---

## Task 5: Migrate command and progress components

`command.tsx` — mounts lazily with AnimatePresence. `progress.tsx` — uses motion for bar animation.

**Critical:** `progress.tsx` changes `value` from 0–100 scale to 0–1 scale. Must audit web callers.

**Files:**
- Modify: `packages/ui/src/components/command.tsx`
- Modify: `packages/ui/src/components/progress.tsx`

**Step 1: Copy and fix command.tsx**

1. Copy `apps/design/src/components/command.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

**Step 2: Copy and fix progress.tsx**

1. Copy `apps/design/src/components/progress.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

New Progress type:
```typescript
type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number; // 0–1 (fractional), NOT 0–100
  label?: string;
  showPercent?: boolean;
};
```

**Step 3: Find and fix all Progress callers in web**

Run: `grep -rn "<Progress" apps/web/src --include="*.tsx"`

For every `value={N}` usage where N is on a 0–100 scale, change to `value={N / 100}`.

**Step 4: Typecheck**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`
Run: `pnpm --filter web typecheck 2>&1 | tail -10`

**Step 5: Commit**

```bash
git add packages/ui/src/components/command.tsx \
        packages/ui/src/components/progress.tsx
git commit -m "feat(ui): migrate command and progress (value now 0-1 scale)"
```

---

## Task 6: Migrate dialog and alert-dialog with motion animations

Both now animate with Framer Motion. `dialog.tsx` adds an optional `showCloseButton` prop (default `true`). `alert-dialog.tsx` now uses `@radix-ui/react-dialog` internally (not `@radix-ui/react-alert-dialog`).

**Files:**
- Modify: `packages/ui/src/components/dialog.tsx`
- Modify: `packages/ui/src/components/alert-dialog.tsx`

**Step 1: Copy and fix dialog.tsx**

1. Copy `apps/design/src/components/dialog.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

**Step 2: Copy and fix alert-dialog.tsx**

1. Copy `apps/design/src/components/alert-dialog.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

**Step 3: Verify alert-dialog exports match index.ts**

The new `alert-dialog.tsx` must export all of: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`

Check by reading both files and comparing.

**Step 4: Typecheck both packages**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`
Run: `pnpm --filter web typecheck 2>&1 | tail -10`

**Step 5: Commit**

```bash
git add packages/ui/src/components/dialog.tsx packages/ui/src/components/alert-dialog.tsx
git commit -m "feat(ui): migrate dialog and alert-dialog with motion animations"
```

---

## Task 7: Migrate breaking-change components (Button, Tabs, Switch)

### 7a: Button

Uses `motion.button` with spring press/hover. Visual change only — no prop API break.

**Files:** `packages/ui/src/components/button.tsx`

1. Copy `apps/design/src/components/button.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

Verify `Button` and `buttonVariants` are still exported (both are in the design version).

### 7b: Tabs

Custom React context replaces Radix internally. External API is identical.

**Files:** `packages/ui/src/components/tabs.tsx`

1. Copy `apps/design/src/components/tabs.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top

### 7c: Switch — add back `id` and `disabled` props

The new Switch has `{ checked, onCheckedChange }` only. Web passes `id` for label associations. Must extend props.

**Files:** `packages/ui/src/components/switch.tsx`

1. Copy `apps/design/src/components/switch.tsx`
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top
4. Update `SwitchProps` to include `id`, `disabled`, and `className`:

```typescript
type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
};
```

5. Pass `id` and `aria-disabled` to the `motion.div`, guard click on disabled:

```tsx
const Switch = ({ checked, onCheckedChange, id, disabled, className }: SwitchProps) => (
  <motion.div
    id={id}
    role='switch'
    aria-checked={checked}
    aria-disabled={disabled}
    onClick={() => !disabled && onCheckedChange(!checked)}
    // ... rest unchanged
  >
```

**Step 1: Run typecheck after all three**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`
Run: `pnpm --filter web typecheck 2>&1 | tail -10`

**Step 2: Commit**

```bash
git add packages/ui/src/components/button.tsx \
        packages/ui/src/components/tabs.tsx \
        packages/ui/src/components/switch.tsx
git commit -m "feat(ui): migrate button (motion), tabs (context), switch (custom + id/disabled)"
```

---

## Task 8: Migrate Tooltip — new simple API

Replaces `TooltipProvider/TooltipTrigger/TooltipContent` with `<Tooltip content={...}>{children}</Tooltip>`.
No web files use Tooltip — confirmed by grep returning empty.

**Files:**
- Modify: `packages/ui/src/components/tooltip.tsx`
- Modify: `packages/ui/src/index.ts`

**Step 1: Copy and fix tooltip.tsx**

1. Copy `apps/design/src/components/tooltip.tsx` (already fixed with biome-ignore comments)
2. Change `from 'ui'` → `from '../index'`
3. Add `'use client';` at top (uses useState)

**Step 2: Update index.ts**

Find:
```typescript
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';
```

Replace with:
```typescript
export { Tooltip } from './components/tooltip';
```

**Step 3: Verify no web imports break**

Run: `grep -rn "TooltipProvider\|TooltipTrigger\|TooltipContent" apps/web/src --include="*.tsx"`
Expected: no results

**Step 4: Typecheck**

Run: `pnpm --filter @harness/ui typecheck 2>&1 | tail -10`
Run: `pnpm --filter web typecheck 2>&1 | tail -10`

**Step 5: Commit**

```bash
git add packages/ui/src/components/tooltip.tsx packages/ui/src/index.ts
git commit -m "feat(ui): replace radix tooltip with custom hover tooltip"
```

---

## Task 9: Add new Kbd component

**Files:**
- Create: `packages/ui/src/components/kbd.tsx`
- Create: `packages/ui/src/components/__tests__/kbd.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Step 1: Create kbd.tsx**

Copy `apps/design/src/components/kbd.tsx` and fix:
1. Change `from 'ui'` → `from '../index'`
2. No `'use client'` needed

**Step 2: Add export to index.ts**

Add after the last export:
```typescript
export { Kbd } from './components/kbd';
```

**Step 3: Write tests**

`packages/ui/src/components/__tests__/kbd.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kbd } from '../kbd';

describe('Kbd', () => {
  it('renders keyboard shortcut text', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('renders as kbd element', () => {
    render(<Kbd>Enter</Kbd>);
    expect(screen.getByText('Enter').tagName).toBe('KBD');
  });

  it('applies custom className', () => {
    render(<Kbd className='custom-class'>Tab</Kbd>);
    expect(screen.getByText('Tab')).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(<Kbd data-testid='shortcut'>Esc</Kbd>);
    expect(screen.getByTestId('shortcut')).toBeInTheDocument();
  });
});
```

**Step 4: Run tests**

Run: `pnpm --filter @harness/ui test src/components/__tests__/kbd.test.tsx 2>&1 | tail -10`
Expected: 4 tests pass

**Step 5: Commit**

```bash
git add packages/ui/src/components/kbd.tsx \
        packages/ui/src/components/__tests__/kbd.test.tsx \
        packages/ui/src/index.ts
git commit -m "feat(ui): add Kbd component for keyboard shortcut display"
```

---

## Task 10: Update existing component tests

Run all ui tests first. Read failures carefully before rewriting.

**Step 1: Run full test suite**

Run: `pnpm --filter @harness/ui test 2>&1`

**Step 2: Update tooltip.test.tsx for new API**

New test structure (replace entire file):

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip } from '../tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content='Hello'><button type='button'>Hover me</button></Tooltip>);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip content on mouseenter', async () => {
    const user = userEvent.setup();
    render(<Tooltip content='tip text'><button type='button'>Trigger</button></Tooltip>);
    await user.hover(screen.getByText('Trigger'));
    expect(screen.getByText('tip text')).toBeInTheDocument();
  });

  it('hides tooltip content on mouseleave', async () => {
    const user = userEvent.setup();
    render(<Tooltip content='tip text'><button type='button'>Trigger</button></Tooltip>);
    await user.hover(screen.getByText('Trigger'));
    await user.unhover(screen.getByText('Trigger'));
    expect(screen.queryByText('tip text')).not.toBeInTheDocument();
  });
});
```

**Step 3: Update switch.test.tsx for new API**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders with role switch', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects checked state via aria-checked', () => {
    render(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange with toggled value when clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('passes id to the switch element', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} id='my-switch' />);
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-switch');
  });

  it('does not call onCheckedChange when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={onChange} disabled />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 4: Update tabs.test.tsx**

The new Tabs uses React context. Key behavioral differences:
- `TabsContent` renders `null` when not active (no `data-state="inactive"` hidden element)
- `TabsTrigger` sets `aria-selected` directly

Update tests to check rendered output rather than Radix data-state attributes.

**Step 5: Update button.test.tsx**

- If tests check for `h-10` class — update to `h-8`
- motion.button renders as `button` in the DOM — role-based queries still work
- If tests check `focus-visible:ring-*` classes — update to the new class names

**Step 6: Fix remaining failures**

For each remaining failure, read the test output, understand what changed, update the assertion to test behavior (not implementation details).

**Step 7: Confirm all pass**

Run: `pnpm --filter @harness/ui test 2>&1 | grep -E "pass|fail|Tests"`
Expected: all tests pass

**Step 8: Commit**

```bash
git add packages/ui/src/components/__tests__/
git commit -m "test(ui): update component tests for migrated design system components"
```

---

## Task 11: Update apps/design to use ui package instead of local components

After migration, `apps/design/src/components/` is redundant — the design app should import from `'ui'` for all shared components.

**Files:**
- Modify: `apps/design/src/blocks/*.tsx`
- Modify: `apps/design/src/_sections/*.tsx`
- Modify: `apps/design/src/app.tsx`
- Modify: `apps/design/src/_components/markdown-content.tsx`

**Step 1: Find all relative component imports in design app**

Run: `grep -rn "from '\.\./components\|from '\./components" apps/design/src --include="*.tsx"`

**Step 2: Replace local component imports with 'ui' imports**

For example, if `apps/design/src/blocks/chat-input.tsx` imports:
```typescript
import { Button } from '../components/button';
import { Tooltip } from '../components/tooltip';
```

Change to:
```typescript
import { Button, Tooltip } from 'ui';
```

**Step 3: Typecheck design app**

Run: `pnpm --filter design typecheck 2>&1 | tail -20`

Fix any errors (e.g., `Kbd` might need to be added to the `ui` import, or a specific component API changed).

**Step 4: Lint design app**

Run: `pnpm --filter design lint 2>&1 | tail -10`

**Step 5: Commit**

```bash
git add apps/design/
git commit -m "refactor(design): import all components from ui package"
```

---

## Task 12: Full integration check

**Step 1: Typecheck everything**

Run: `pnpm typecheck 2>&1 | tail -30`

Fix any errors.

**Step 2: Run all tests**

Run: `pnpm test 2>&1 | tail -30`

Fix any failures.

**Step 3: Build everything**

Run: `pnpm build 2>&1 | tail -20`

Fix any build errors.

**Step 4: Lint everything**

Run: `pnpm lint 2>&1 | tail -20`

Fix any lint errors.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore(ui): ui component migration complete — all checks pass"
```

---

## Reference: Component migration checklist

| Component | Action | API Break? | motion? | `'use client'`? | Task |
|-----------|--------|-----------|---------|-----------------|------|
| alert | Replace | No | No | No | 3 |
| badge | Replace | No | No | No | 3 |
| card | Replace | No | No | No | 3 |
| input | Replace | No | No | No | 3 |
| label | Replace | No | No | No | 3 |
| skeleton | Replace | No | No | No | 3 |
| textarea | Replace | No | No | No | 3 |
| collapsible | Replace | No | No | Yes | 4 |
| scroll-area | Replace | No | No | Yes | 4 |
| separator | Replace | No | No | Yes | 4 |
| select | Replace | No | No | Yes | 4 |
| dropdown-menu | Replace | No | No | Yes | 4 |
| popover | Replace | No | No | Yes | 4 |
| table | Replace | No | No | No | 4 |
| command | Replace | No | Yes | Yes | 5 |
| progress | Replace | value: 0–100→0–1 | Yes | Yes | 5 |
| dialog | Replace | No (+showCloseButton) | Yes | Yes | 6 |
| alert-dialog | Replace | No (same exports) | Yes | Yes | 6 |
| button | Replace | Visual only | Yes | Yes | 7a |
| tabs | Replace | No (context vs Radix) | Yes | Yes | 7b |
| switch | Replace | Add id/disabled back | Yes | Yes | 7c |
| tooltip | Replace | Yes (new simple API) | Yes | Yes | 8 |
| kbd | **Add new** | N/A | No | No | 9 |
| sidebar | **Keep existing** | N/A | N/A | N/A | — |
