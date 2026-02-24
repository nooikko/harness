# Usage Over Time Component Breakout

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single `UsageOverTimeChart` (which fetches two independent datasets sequentially) with two independent async server components that each own one query and stream via separate Suspense boundaries.

**Architecture:** `TokensOverTimeChart` inlines a `token.total` Prisma query; `CostOverTimeChart` inlines a `token.cost` query. Each groups results by date and renders a Card with meter bars. The usage page stacks them vertically in the left column of the existing 2-column grid.

**Tech Stack:** React Server Components, Prisma, ShadCN UI (Card, Skeleton), Vitest + renderToStaticMarkup

---

### Task 1: Write failing tests for TokensOverTimeChart

**Files:**
- Create: `apps/web/src/app/usage/_components/__tests__/tokens-over-time-chart.test.tsx`

**Step 1: Write the test file**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    metric: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { TokensOverTimeChart, TokensOverTimeChartSkeleton } = await import(
  "../tokens-over-time-chart"
);

describe("TokensOverTimeChart", () => {
  it("renders empty state when no data exists", async () => {
    const element = await TokensOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain("No token data for this period.");
  });

  it("renders the heading", async () => {
    const element = await TokensOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain("Tokens Over Time");
  });
});

describe("TokensOverTimeChartSkeleton", () => {
  it("renders a skeleton placeholder", () => {
    const html = renderToStaticMarkup(
      (<TokensOverTimeChartSkeleton />) as React.ReactElement,
    );
    expect(html).toContain('data-slot="skeleton"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- apps/web/src/app/usage/_components/__tests__/tokens-over-time-chart.test.tsx`
Expected: FAIL — module `../tokens-over-time-chart` does not exist

---

### Task 2: Implement TokensOverTimeChart

**Files:**
- Create: `apps/web/src/app/usage/_components/tokens-over-time-chart.tsx`

**Step 1: Write the component**

```tsx
import { prisma } from "database";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "ui";
import { formatTokenCount } from "../_helpers/format-cost";

type DailyTokens = {
  date: string;
  totalTokens: number;
};

type TokensOverTimeChartComponent = () => Promise<React.ReactNode>;

export const TokensOverTimeChart: TokensOverTimeChartComponent = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const metrics = await prisma.metric.findMany({
    where: {
      name: "token.total",
      createdAt: { gte: since },
    },
    select: {
      value: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const metric of metrics) {
    const dateKey = metric.createdAt.toISOString().substring(0, 10);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + metric.value);
  }

  const data: DailyTokens[] = Array.from(dailyMap.entries())
    .map(([date, totalTokens]) => ({ date, totalTokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tokens Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No token data for this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((day) => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {day.date.slice(5)}
              </span>
              <div className="flex-1">
                <meter
                  className="h-6 w-full appearance-none rounded bg-primary/20 [&::-webkit-meter-bar]:rounded [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:rounded [&::-webkit-meter-optimum-value]:bg-primary/40"
                  value={day.totalTokens}
                  min={0}
                  max={maxTokens}
                  aria-label={`${day.date}: ${formatTokenCount(day.totalTokens)} tokens`}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs">
                {formatTokenCount(day.totalTokens)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

type TokensOverTimeChartSkeletonComponent = () => React.ReactNode;

export const TokensOverTimeChartSkeleton: TokensOverTimeChartSkeletonComponent =
  () => <Skeleton className="h-80 w-full" />;
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter web test -- apps/web/src/app/usage/_components/__tests__/tokens-over-time-chart.test.tsx`
Expected: 3 tests PASS

---

### Task 3: Write failing tests for CostOverTimeChart

**Files:**
- Create: `apps/web/src/app/usage/_components/__tests__/cost-over-time-chart.test.tsx`

**Step 1: Write the test file**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    metric: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { CostOverTimeChart, CostOverTimeChartSkeleton } = await import(
  "../cost-over-time-chart"
);

describe("CostOverTimeChart", () => {
  it("renders empty state when no data exists", async () => {
    const element = await CostOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain("No cost data for this period.");
  });

  it("renders the heading", async () => {
    const element = await CostOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain("Cost Over Time");
  });
});

describe("CostOverTimeChartSkeleton", () => {
  it("renders a skeleton placeholder", () => {
    const html = renderToStaticMarkup(
      (<CostOverTimeChartSkeleton />) as React.ReactElement,
    );
    expect(html).toContain('data-slot="skeleton"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- apps/web/src/app/usage/_components/__tests__/cost-over-time-chart.test.tsx`
Expected: FAIL — module `../cost-over-time-chart` does not exist

---

### Task 4: Implement CostOverTimeChart

**Files:**
- Create: `apps/web/src/app/usage/_components/cost-over-time-chart.tsx`

**Step 1: Write the component**

```tsx
import { prisma } from "database";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "ui";
import { formatCost } from "../_helpers/format-cost";

type DailyCost = {
  date: string;
  totalCost: number;
};

type CostOverTimeChartComponent = () => Promise<React.ReactNode>;

export const CostOverTimeChart: CostOverTimeChartComponent = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const metrics = await prisma.metric.findMany({
    where: {
      name: "token.cost",
      createdAt: { gte: since },
    },
    select: {
      value: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const dailyMap = new Map<string, number>();
  for (const metric of metrics) {
    const dateKey = metric.createdAt.toISOString().substring(0, 10);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + metric.value);
  }

  const data: DailyCost[] = Array.from(dailyMap.entries())
    .map(([date, totalCost]) => ({ date, totalCost }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No cost data for this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.totalCost), 0.001);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((day) => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {day.date.slice(5)}
              </span>
              <div className="flex-1">
                <meter
                  className="h-6 w-full appearance-none rounded bg-primary/20 [&::-webkit-meter-bar]:rounded [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:rounded [&::-webkit-meter-optimum-value]:bg-primary/40"
                  value={day.totalCost}
                  min={0}
                  max={maxCost}
                  aria-label={`${day.date}: ${formatCost(day.totalCost)}`}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs">
                {formatCost(day.totalCost)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

type CostOverTimeChartSkeletonComponent = () => React.ReactNode;

export const CostOverTimeChartSkeleton: CostOverTimeChartSkeletonComponent =
  () => <Skeleton className="h-80 w-full" />;
```

**Step 2: Run tests to verify they pass**

Run: `pnpm --filter web test -- apps/web/src/app/usage/_components/__tests__/cost-over-time-chart.test.tsx`
Expected: 3 tests PASS

---

### Task 5: Update usage page and delete old files

**Files:**
- Modify: `apps/web/src/app/usage/page.tsx`
- Delete: `apps/web/src/app/usage/_components/usage-over-time-chart.tsx`
- Delete: `apps/web/src/app/usage/_helpers/fetch-usage-over-time.ts`
- Delete: `apps/web/src/app/usage/_components/__tests__/usage-over-time-chart.test.tsx`
- Delete: `apps/web/src/app/usage/_helpers/__tests__/fetch-usage-over-time.test.ts`

**Step 1: Rewrite page.tsx with two Suspense boundaries stacked in left column**

Replace imports and grid section. The key change: left column wraps `TokensOverTimeChart` and `CostOverTimeChart` in separate Suspense boundaries inside a `space-y-6` div.

**Step 2: Delete old files**

```bash
rm apps/web/src/app/usage/_components/usage-over-time-chart.tsx
rm apps/web/src/app/usage/_helpers/fetch-usage-over-time.ts
rm apps/web/src/app/usage/_components/__tests__/usage-over-time-chart.test.tsx
rm apps/web/src/app/usage/_helpers/__tests__/fetch-usage-over-time.test.ts
```

**Step 3: Run all usage tests**

Run: `pnpm --filter web test -- apps/web/src/app/usage/`
Expected: All tests PASS

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors
