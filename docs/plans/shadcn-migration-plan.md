# ShadCN Component Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install ShadCN UI primitives into `packages/ui/` and migrate all hand-rolled components in the web app to use them.

**Architecture:** Port ShadCN v4 component source directly into `packages/ui/src/components/`, adapting imports to use the local `cn()` utility and individual `@radix-ui/*` packages. Then refactor existing page components to import from `"ui"` instead of hand-rolling markup. Arrow functions only (no `function` keyword). React 19 component props pattern (no `forwardRef` needed for new components).

**Tech Stack:** React 19, Radix UI primitives, CVA, Tailwind CSS 4, Vitest + Testing Library

---

### Task 1: Install Radix UI dependencies

**Files:**
- Modify: `packages/ui/package.json`

**Step 1: Install Phase 1 Radix packages**

Run:
```bash
pnpm --filter ui add @radix-ui/react-progress @radix-ui/react-scroll-area
```

Expected: packages added to `packages/ui/package.json` dependencies

**Step 2: Verify install**

Run: `pnpm --filter ui typecheck`
Expected: PASS (no type errors)

---

### Task 2: Create Card component

**Files:**
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/__tests__/card.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../card";

describe("Card", () => {
  it("renders a card with content", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("merges custom className on Card", () => {
    render(<Card data-testid="card" className="custom-class">Test</Card>);
    expect(screen.getByTestId("card").className).toContain("custom-class");
  });

  it("applies data-slot attributes", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header" />
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-slot", "card");
    expect(screen.getByTestId("header")).toHaveAttribute("data-slot", "card-header");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/card.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement Card component**

```tsx
// packages/ui/src/components/card.tsx
import * as React from "react";

import { cn } from "../index";

const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card"
    className={cn(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      className,
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-header"
    className={cn(
      "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
      className,
    )}
    {...props}
  />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-title"
    className={cn("leading-none font-semibold", className)}
    {...props}
  />
);

const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
);

const CardAction = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-action"
    className={cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className,
    )}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-content"
    className={cn("px-6", className)}
    {...props}
  />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="card-footer"
    className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
    {...props}
  />
);

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/card.test.tsx`
Expected: PASS

---

### Task 3: Create Alert component

**Files:**
- Create: `packages/ui/src/components/alert.tsx`
- Create: `packages/ui/src/components/__tests__/alert.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/alert.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "../alert";

describe("Alert", () => {
  it("renders with default variant", () => {
    render(
      <Alert data-testid="alert">
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>Description text</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByTestId("alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(screen.getByText("Heads up!")).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("renders destructive variant", () => {
    render(<Alert data-testid="alert" variant="destructive">Error</Alert>);
    expect(screen.getByTestId("alert").className).toContain("text-destructive");
  });

  it("merges custom className", () => {
    render(<Alert data-testid="alert" className="my-class">Test</Alert>);
    expect(screen.getByTestId("alert").className).toContain("my-class");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/alert.test.tsx`
Expected: FAIL

**Step 3: Implement Alert component**

```tsx
// packages/ui/src/components/alert.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../index";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;

const Alert = ({ className, variant, ...props }: AlertProps) => (
  <div
    data-slot="alert"
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);

const AlertTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="alert-title"
    className={cn(
      "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
      className,
    )}
    {...props}
  />
);

const AlertDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="alert-description"
    className={cn(
      "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
      className,
    )}
    {...props}
  />
);

export { Alert, alertVariants, AlertDescription, AlertTitle };
export type { AlertProps };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/alert.test.tsx`
Expected: PASS

---

### Task 4: Create Badge component

**Files:**
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/__tests__/badge.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-primary");
  });

  it("renders secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary").className).toContain("bg-secondary");
  });

  it("renders outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline").className).toContain("border-border");
  });

  it("renders destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error").className).toContain("bg-destructive");
  });

  it("merges custom className", () => {
    render(<Badge className="extra">Test</Badge>);
    expect(screen.getByText("Test").className).toContain("extra");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/badge.test.tsx`
Expected: FAIL

**Step 3: Implement Badge component**

```tsx
// packages/ui/src/components/badge.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../index";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean };

const Badge = ({
  className,
  variant = "default",
  asChild = false,
  ...props
}: BadgeProps) => {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
};

export { Badge, badgeVariants };
export type { BadgeProps };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/badge.test.tsx`
Expected: PASS

---

### Task 5: Create Skeleton component

**Files:**
- Create: `packages/ui/src/components/skeleton.tsx`
- Create: `packages/ui/src/components/__tests__/skeleton.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/skeleton.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders with animate-pulse", () => {
    render(<Skeleton data-testid="skeleton" />);
    const el = screen.getByTestId("skeleton");
    expect(el.className).toContain("animate-pulse");
  });

  it("merges custom className", () => {
    render(<Skeleton data-testid="skeleton" className="h-10 w-40" />);
    const el = screen.getByTestId("skeleton");
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-40");
  });

  it("has data-slot attribute", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("data-slot", "skeleton");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/skeleton.test.tsx`
Expected: FAIL

**Step 3: Implement Skeleton component**

```tsx
// packages/ui/src/components/skeleton.tsx
import * as React from "react";

import { cn } from "../index";

const Skeleton = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="skeleton"
    className={cn("bg-accent animate-pulse rounded-md", className)}
    {...props}
  />
);

export { Skeleton };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/skeleton.test.tsx`
Expected: PASS

---

### Task 6: Create Table component

**Files:**
- Create: `packages/ui/src/components/table.tsx`
- Create: `packages/ui/src/components/__tests__/table.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/table.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

describe("Table", () => {
  it("renders a complete table structure", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
            <TableCell>100</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("wraps in overflow container", () => {
    const { container } = render(<Table>Content</Table>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("overflow-x-auto");
  });

  it("merges custom className on table", () => {
    render(<Table className="my-table">Content</Table>);
    expect(screen.getByRole("table").className).toContain("my-table");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/table.test.tsx`
Expected: FAIL

**Step 3: Implement Table component**

```tsx
// packages/ui/src/components/table.tsx
"use client";

import * as React from "react";

import { cn } from "../index";

const Table = ({ className, ...props }: React.ComponentProps<"table">) => (
  <div data-slot="table-container" className="relative w-full overflow-x-auto">
    <table
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

const TableHeader = ({ className, ...props }: React.ComponentProps<"thead">) => (
  <thead
    data-slot="table-header"
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
);

const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => (
  <tbody
    data-slot="table-body"
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
);

const TableFooter = ({ className, ...props }: React.ComponentProps<"tfoot">) => (
  <tfoot
    data-slot="table-footer"
    className={cn(
      "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
);

const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => (
  <tr
    data-slot="table-row"
    className={cn(
      "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
      className,
    )}
    {...props}
  />
);

const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => (
  <th
    data-slot="table-head"
    className={cn(
      "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => (
  <td
    data-slot="table-cell"
    className={cn(
      "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
);

const TableCaption = ({ className, ...props }: React.ComponentProps<"caption">) => (
  <caption
    data-slot="table-caption"
    className={cn("text-muted-foreground mt-4 text-sm", className)}
    {...props}
  />
);

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/table.test.tsx`
Expected: PASS

---

### Task 7: Create Progress component

**Files:**
- Create: `packages/ui/src/components/progress.tsx`
- Create: `packages/ui/src/components/__tests__/progress.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/progress.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "../progress";

describe("Progress", () => {
  it("renders with progressbar role", () => {
    render(<Progress value={50} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("reflects the value attribute", () => {
    render(<Progress value={75} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "75");
  });

  it("merges custom className", () => {
    render(<Progress value={0} className="h-4" />);
    expect(screen.getByRole("progressbar").className).toContain("h-4");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/progress.test.tsx`
Expected: FAIL

**Step 3: Implement Progress component**

```tsx
// packages/ui/src/components/progress.tsx
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "../index";

const Progress = ({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) => (
  <ProgressPrimitive.Root
    data-slot="progress"
    className={cn(
      "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className="bg-primary h-full w-full flex-1 transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);

export { Progress };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/progress.test.tsx`
Expected: PASS

---

### Task 8: Create ScrollArea component

**Files:**
- Create: `packages/ui/src/components/scroll-area.tsx`
- Create: `packages/ui/src/components/__tests__/scroll-area.test.tsx`

**Step 1: Write the test**

```tsx
// packages/ui/src/components/__tests__/scroll-area.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "../scroll-area";

describe("ScrollArea", () => {
  it("renders children", () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    );
    expect(screen.getByText("Scrollable content")).toBeInTheDocument();
  });

  it("merges custom className", () => {
    render(
      <ScrollArea className="h-48" data-testid="scroll">
        Content
      </ScrollArea>,
    );
    expect(screen.getByTestId("scroll").className).toContain("h-48");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter ui test -- --run src/components/__tests__/scroll-area.test.tsx`
Expected: FAIL

**Step 3: Implement ScrollArea component**

```tsx
// packages/ui/src/components/scroll-area.tsx
"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "../index";

const ScrollBar = ({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    data-slot="scroll-area-scrollbar"
    orientation={orientation}
    className={cn(
      "flex touch-none p-px transition-colors select-none",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      data-slot="scroll-area-thumb"
      className="bg-border relative flex-1 rounded-full"
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
);

const ScrollArea = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) => (
  <ScrollAreaPrimitive.Root
    data-slot="scroll-area"
    className={cn("relative", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);

export { ScrollArea, ScrollBar };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter ui test -- --run src/components/__tests__/scroll-area.test.tsx`
Expected: PASS

---

### Task 9: Update exports and commit Phase 1

**Files:**
- Modify: `packages/ui/src/index.ts`

**Step 1: Add exports for all new components**

Update `packages/ui/src/index.ts` to add exports for Card, Alert, Badge, Skeleton, Table, Progress, ScrollArea after the existing Button exports. Each component gets a named export line. Keep the `cn` function definition at the top (this is NOT a barrel file — it has real logic).

The full list of new exports:

```ts
// Card
export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/card";

// Alert
export type { AlertProps } from "./components/alert";
export { Alert, alertVariants, AlertDescription, AlertTitle } from "./components/alert";

// Badge
export type { BadgeProps } from "./components/badge";
export { Badge, badgeVariants } from "./components/badge";

// Skeleton
export { Skeleton } from "./components/skeleton";

// Table
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./components/table";

// Progress
export { Progress } from "./components/progress";

// ScrollArea
export { ScrollArea, ScrollBar } from "./components/scroll-area";
```

**Step 2: Run all UI package tests**

Run: `pnpm --filter ui test`
Expected: All tests PASS

**Step 3: Typecheck**

Run: `pnpm --filter ui typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/ui/
git commit -m "feat: add ShadCN Phase 1 components to shared UI package

Add Card, Alert, Badge, Skeleton, Table, Progress, and ScrollArea
components ported from ShadCN v4 with tests. All components use
arrow functions, Radix UI primitives, and CVA variants.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Migrate usage-summary-cards to Card

**Files:**
- Modify: `apps/web/src/app/usage/_components/usage-summary-cards.tsx`

**Step 1: Refactor to use Card components**

Replace the hand-rolled `<div className="rounded-lg border bg-card p-6 shadow-sm">` with `<Card>`, `<CardHeader>`, and `<CardContent>` from `"ui"`.

The key changes:
- Import `{ Card, CardContent, CardHeader, CardTitle }` from `"ui"`
- Replace outer card div with `<Card>`
- Use `<CardHeader>` for the icon + label row
- Use `<CardTitle>` for the label text
- Use `<CardContent>` for the metric value and detail

**Step 2: Verify the page still renders**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 11: Migrate budget-warning to Alert + Progress

**Files:**
- Modify: `apps/web/src/app/usage/_components/budget-warning.tsx`

**Step 1: Refactor to use Alert and Progress**

Replace hand-rolled alert styling with `<Alert>` and `<AlertTitle>` from `"ui"`. Replace the CSS progress bar div with `<Progress>` from `"ui"`.

The key changes:
- Import `{ Alert, AlertTitle, AlertDescription, Progress, Card, CardContent }` from `"ui"`
- Normal state (< 80%): use `<Card>` with `<Progress value={usagePercent}>`
- Warning state (>= 80%): use `<Alert>` with warning styling + `<Progress>`
- Critical state (>= 100%): use `<Alert variant="destructive">` + `<Progress>`

Note: The Alert component's default variants only cover `default` and `destructive`. The warning (yellow) state will use `<Alert>` with custom className overrides for the yellow styling, since ShadCN's Alert doesn't have a `warning` variant out of the box.

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 12: Migrate usage-by-model-table to Table

**Files:**
- Modify: `apps/web/src/app/usage/_components/usage-by-model-table.tsx`

**Step 1: Refactor to use Table components**

Replace raw `<table>/<thead>/<tbody>/<tr>/<th>/<td>` with ShadCN Table components from `"ui"`.

The key changes:
- Import `{ Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow }` from `"ui"`
- Wrap in `<Card>` with `<CardHeader><CardTitle>` for the heading
- Replace `<table>` with `<Table>`
- Replace `<thead>` with `<TableHeader>`, `<th>` with `<TableHead>`
- Replace `<tbody>` with `<TableBody>`, `<tr>` with `<TableRow>`, `<td>` with `<TableCell>`

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 13: Migrate usage-over-time-chart to Card

**Files:**
- Modify: `apps/web/src/app/usage/_components/usage-over-time-chart.tsx`

**Step 1: Refactor wrapper to use Card**

Replace the outer `<div className="rounded-lg border bg-card p-6">` with `<Card>`, `<CardHeader>`, `<CardTitle>`, and `<CardContent>`. Keep the meter-based chart logic as-is.

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 14: Commit usage dashboard migration

**Step 1: Run full typecheck and build**

Run: `pnpm typecheck && pnpm --filter web build`
Expected: PASS

**Step 2: Commit**

```bash
git add apps/web/src/app/usage/
git commit -m "refactor: migrate usage dashboard to ShadCN components

Replace hand-rolled card/table/alert/progress markup with Card,
Table, Alert, and Progress components from the shared UI package.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: Migrate thread-sidebar to ScrollArea

**Files:**
- Modify: `apps/web/src/app/chat/_components/thread-sidebar.tsx`

**Step 1: Refactor scrollable nav to ScrollArea**

Replace `<nav className="flex-1 overflow-y-auto p-2">` with `<ScrollArea className="flex-1"><nav className="p-2">...</nav></ScrollArea>`.

Import `{ ScrollArea }` from `"ui"`.

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 16: Migrate message-list to ScrollArea

**Files:**
- Modify: `apps/web/src/app/chat/_components/message-list.tsx`

**Step 1: Refactor scrollable container to ScrollArea**

Replace `<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">` with `<ScrollArea className="flex-1"><div className="flex flex-col gap-4 p-4">...</div></ScrollArea>`.

Import `{ ScrollArea }` from `"ui"`.

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 17: Migrate loading.tsx to Skeleton

**Files:**
- Modify: `apps/web/src/app/chat/[thread-id]/loading.tsx`

**Step 1: Replace animate-pulse divs with Skeleton**

Replace each `<div className="h-X w-X animate-pulse rounded bg-muted" />` with `<Skeleton className="h-X w-X" />`.

Import `{ Skeleton }` from `"ui"`.

The Skeleton component already applies `animate-pulse rounded-md bg-accent`, so remove those classes from the className overrides. Keep only sizing classes (h-X, w-X).

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 18: Migrate notification-message to Alert

**Files:**
- Modify: `apps/web/src/app/chat/_components/notification-message.tsx`

**Step 1: Refactor notification banner to use Alert**

Replace the hand-rolled notification div with `<Alert>`, `<AlertTitle>`, and `<AlertDescription>` from `"ui"`.

The notification has custom green/red coloring which extends beyond Alert's default/destructive variants. Use the Alert component with className overrides:
- Completed: `<Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">`
- Failed: `<Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">`

Keep the StatusIcon, content structure, and "View thread" link.

**Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

---

### Task 19: Commit chat migration and verify

**Step 1: Run full typecheck and build**

Run: `pnpm typecheck && pnpm --filter web build`
Expected: PASS

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/chat/
git commit -m "refactor: migrate chat components to ShadCN primitives

Replace hand-rolled scrollable containers with ScrollArea, loading
skeletons with Skeleton, and notification banners with Alert from
the shared UI package.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 20: Install Phase 2 dependencies

**Files:**
- Modify: `packages/ui/package.json`

**Step 1: Install Phase 2 Radix packages**

Run:
```bash
pnpm --filter ui add @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-tooltip
```

Expected: packages added to `packages/ui/package.json`

---

### Task 21: Create Phase 2 components — Input, Label, Separator

**Files:**
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/label.tsx`
- Create: `packages/ui/src/components/separator.tsx`
- Create: `packages/ui/src/components/__tests__/input.test.tsx`
- Create: `packages/ui/src/components/__tests__/label.test.tsx`
- Create: `packages/ui/src/components/__tests__/separator.test.tsx`

**Step 1: Write tests for all three**

Input test: renders an input element, applies type prop, merges className.
Label test: renders a label element, merges className.
Separator test: renders horizontal by default, renders vertical when specified, merges className.

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter ui test`
Expected: New tests FAIL, existing PASS

**Step 3: Implement Input**

```tsx
// packages/ui/src/components/input.tsx
import * as React from "react";

import { cn } from "../index";

const Input = ({ className, type, ...props }: React.ComponentProps<"input">) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
      className,
    )}
    {...props}
  />
);

export { Input };
```

**Step 4: Implement Label**

```tsx
// packages/ui/src/components/label.tsx
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "../index";

const Label = ({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) => (
  <LabelPrimitive.Root
    data-slot="label"
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
);

export { Label };
```

**Step 5: Implement Separator**

```tsx
// packages/ui/src/components/separator.tsx
"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "../index";

const Separator = ({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) => (
  <SeparatorPrimitive.Root
    data-slot="separator"
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
      className,
    )}
    {...props}
  />
);

export { Separator };
```

**Step 6: Run tests to verify they pass**

Run: `pnpm --filter ui test`
Expected: All PASS

---

### Task 22: Create Phase 2 components — Dialog, DropdownMenu, Tooltip

**Files:**
- Create: `packages/ui/src/components/dialog.tsx`
- Create: `packages/ui/src/components/dropdown-menu.tsx`
- Create: `packages/ui/src/components/tooltip.tsx`
- Create: `packages/ui/src/components/__tests__/dialog.test.tsx`
- Create: `packages/ui/src/components/__tests__/dropdown-menu.test.tsx`
- Create: `packages/ui/src/components/__tests__/tooltip.test.tsx`

**Step 1: Write tests**

Dialog test: renders trigger, opens on click, shows content.
DropdownMenu test: renders trigger, opens on click, shows items.
Tooltip test: renders trigger, shows content on hover.

**Step 2: Implement Dialog**

Port from ShadCN v4 source. Key adaptation: import `Button` from `"./button"` (local path) instead of registry path. Import Dialog primitives from `"@radix-ui/react-dialog"`. Import `XIcon` from `"lucide-react"`. Use arrow functions for all sub-components.

**Step 3: Implement DropdownMenu**

Port from ShadCN v4 source. Import from `"@radix-ui/react-dropdown-menu"`. Import icons from `"lucide-react"`. Arrow functions throughout.

**Step 4: Implement Tooltip**

Port from ShadCN v4 source. Import from `"@radix-ui/react-tooltip"`. Arrow functions. Export `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`.

**Step 5: Run tests**

Run: `pnpm --filter ui test`
Expected: All PASS

---

### Task 23: Export Phase 2 components and final commit

**Files:**
- Modify: `packages/ui/src/index.ts`

**Step 1: Add Phase 2 exports to index.ts**

Add exports for Input, Label, Separator, Dialog (all sub-components), DropdownMenu (all sub-components), Tooltip (all sub-components).

**Step 2: Run full CI checks**

Run: `pnpm typecheck && pnpm lint && pnpm --filter web build && pnpm test`
Expected: All PASS

**Step 3: Commit**

```bash
git add packages/ui/
git commit -m "feat: add ShadCN Phase 2 components (Dialog, Input, Label, DropdownMenu, Separator, Tooltip)

Install future-useful components for forms, menus, and overlays.
All components ported from ShadCN v4 with tests and Radix UI primitives.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 24: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the UI Package section**

Update the description of the UI package in CLAUDE.md to reflect that it now contains ShadCN components. Update the note about where shadcn/ui components live (they're now in `packages/ui/`, not app-local).

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect ShadCN migration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
