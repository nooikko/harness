# UI Package Usage

All shadcn/Radix UI primitives live in `packages/ui/` and are imported as `@harness/ui`.

---

## The Rule

**Primitives come from `@harness/ui`. Always.**

A "primitive" is any general-purpose UI building block: Button, Dialog, Select, Badge, Tabs, Switch, Input, ScrollArea, Avatar, Form, Toggle, etc. These are the shadcn/Radix components that any feature might use.

```tsx
// CORRECT — import primitives from the UI package
import { Button, Dialog, DialogContent, Badge } from "@harness/ui";
import { cn } from "@harness/ui";

// WRONG — local copies of primitives
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

---

## App-Specific Compositions Are Fine Locally

Components that compose primitives into feature-specific UI belong in the app, co-located with their feature:

```
apps/web/src/app/(chat)/calendar/_components/calendar-day-view.tsx   ← uses ScrollArea, DayPicker
apps/web/src/app/(chat)/chat/_components/delegation-card.tsx          ← uses Badge, Progress
apps/web/src/app/admin/cron-jobs/_components/cron-job-form.tsx        ← uses Input, Select, Button
```

These are NOT primitives — they are feature compositions. They import from `@harness/ui` and live next to the feature that owns them.

---

## If a Primitive Is Missing

If you need a shadcn/Radix primitive that `@harness/ui` doesn't export yet:

1. Add the component to `packages/ui/src/components/`
2. Export it from `packages/ui/src/index.ts`
3. Import it from `@harness/ui` in the consuming app

Do NOT create a local copy in `apps/web/src/components/ui/`. That directory exists only for calendar-specific components that are tightly coupled to calendar context and will be migrated over time.

---

## shadcn CLI

The `components.json` in `packages/ui/` controls where `npx shadcn add` places new components. Always run shadcn commands from the UI package directory, not from `apps/web/`.

```bash
# CORRECT
cd packages/ui && npx shadcn@latest add [component]

# WRONG
cd apps/web && npx shadcn@latest add [component]
```

---

## cn() Utility

The `cn()` function (clsx + tailwind-merge) is exported from `@harness/ui`. Use it from there:

```tsx
import { cn } from "@harness/ui";
```

Do not import from `@/lib/utils` — that path exists only as a legacy artifact.
