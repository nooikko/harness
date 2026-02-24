# Dashboard Interface Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Harness web app from a placeholder landing page into a production-grade dashboard with persistent top bar, chat-first home page, and full admin area for managing all system entities.

**Architecture:** Dual-layout shell — a shared top bar rendered in the root layout, with two distinct sidebar layouts: chat (thread sidebar) at `/` and `/chat/[thread-id]`, and admin (entity nav sidebar) at `/admin/*`. Usage stays standalone. All new components follow the existing async server component + Suspense + skeleton pattern.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, Prisma 6, Tailwind CSS 4, ShadCN/Radix UI, Vitest, Lucide icons.

**Design doc:** `docs/plans/dashboard-interface-design.md`

---

## Task 1: Update Color Palette in globals.css

Update the CSS variables to a refined, professional SaaS palette with a desaturated blue primary and warm accent.

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Step 1: Update the :root CSS variables**

Replace the `:root` block with a refined palette:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 220 20% 14%;
  --card: 0 0% 100%;
  --card-foreground: 220 20% 14%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 20% 14%;
  --primary: 215 50% 40%;
  --primary-foreground: 210 40% 98%;
  --secondary: 214 32% 96%;
  --secondary-foreground: 220 20% 14%;
  --muted: 214 32% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 214 32% 96%;
  --accent-foreground: 220 20% 14%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 210 40% 98%;
  --border: 214 20% 90%;
  --input: 214 20% 90%;
  --ring: 215 50% 40%;
  --chart-1: 215 50% 40%;
  --chart-2: 173 58% 39%;
  --chart-3: 32 95% 52%;
  --chart-4: 142 71% 45%;
  --chart-5: 0 72% 51%;
  --radius: 0.5rem;
  --sidebar: 220 14% 97%;
}
```

Key changes: `--primary` shifts to desaturated blue (215 50% 40%), `--foreground` goes warm-dark (220 20% 14%), charts use distinct status colors, and a new `--sidebar` variable for sidebar backgrounds.

**Step 2: Add the sidebar color to the @theme block**

Add to the `@theme` block:
```css
--color-sidebar: hsl(var(--sidebar));
```

**Step 3: Verify no visual regressions**

Run: `pnpm --filter web build`
Expected: Build succeeds.

**Step 4: Commit**

```
git add apps/web/src/app/globals.css
git commit -m "style: refine color palette for professional SaaS aesthetic"
```

---

## Task 2: Create NavLink Component

A reusable client component that highlights when the current route matches its href prefix.

**Files:**
- Create: `apps/web/src/app/_components/nav-link.tsx`
- Create: `apps/web/src/app/_components/__tests__/nav-link.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/web/src/app/_components/__tests__/nav-link.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const { NavLink } = await import("../nav-link");

describe("NavLink", () => {
  it("renders a link with the correct href", () => {
    render(<NavLink href="/chat">Chat</NavLink>);
    const link = screen.getByRole("link", { name: "Chat" });
    expect(link).toHaveAttribute("href", "/chat");
  });

  it("applies active styles when pathname matches href", () => {
    mockPathname = "/chat/some-thread";
    render(<NavLink href="/chat">Chat</NavLink>);
    const link = screen.getByRole("link", { name: "Chat" });
    expect(link.className).toContain("text-foreground");
  });

  it("applies inactive styles when pathname does not match", () => {
    mockPathname = "/usage";
    render(<NavLink href="/chat">Chat</NavLink>);
    const link = screen.getByRole("link", { name: "Chat" });
    expect(link.className).toContain("text-muted-foreground");
  });

  it("treats root href specially — active only on / or /chat paths", () => {
    mockPathname = "/admin/cron-jobs";
    render(<NavLink href="/">Chat</NavLink>);
    const link = screen.getByRole("link", { name: "Chat" });
    expect(link.className).toContain("text-muted-foreground");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/_components/__tests__/nav-link.test.tsx`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```tsx
// apps/web/src/app/_components/nav-link.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "ui";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

type NavLinkComponent = (props: NavLinkProps) => React.ReactNode;

export const NavLink: NavLinkComponent = ({ href, children }) => {
  const pathname = usePathname();

  const isActive =
    href === "/"
      ? pathname === "/" || pathname.startsWith("/chat")
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "text-foreground bg-secondary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      {children}
    </Link>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/_components/__tests__/nav-link.test.tsx`
Expected: PASS (4 tests).

**Step 5: Commit**

```
git add apps/web/src/app/_components/nav-link.tsx apps/web/src/app/_components/__tests__/nav-link.test.tsx
git commit -m "feat(web): add NavLink component with route-aware active states"
```

---

## Task 3: Create TopBar Component

The persistent global navigation bar rendered across all pages.

**Files:**
- Create: `apps/web/src/app/_components/top-bar.tsx`
- Create: `apps/web/src/app/_components/__tests__/top-bar.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/web/src/app/_components/__tests__/top-bar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const { TopBar } = await import("../top-bar");

describe("TopBar", () => {
  it("renders the app name as a link to home", () => {
    render(<TopBar />);
    const link = screen.getByRole("link", { name: "Harness" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders navigation links for Chat, Usage, and Admin", () => {
    render(<TopBar />);
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usage" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });

  it("renders a nav element for accessibility", () => {
    render(<TopBar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/_components/__tests__/top-bar.test.tsx`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```tsx
// apps/web/src/app/_components/top-bar.tsx
"use client";

import Link from "next/link";
import { NavLink } from "./nav-link";

type TopBarComponent = () => React.ReactNode;

export const TopBar: TopBarComponent = () => {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
      <Link href="/" className="mr-8 text-lg font-semibold tracking-tight text-foreground">
        Harness
      </Link>
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <NavLink href="/">Chat</NavLink>
        <NavLink href="/usage">Usage</NavLink>
        <NavLink href="/admin">Admin</NavLink>
      </nav>
    </header>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/_components/__tests__/top-bar.test.tsx`
Expected: PASS (3 tests).

**Step 5: Commit**

```
git add apps/web/src/app/_components/top-bar.tsx apps/web/src/app/_components/__tests__/top-bar.test.tsx
git commit -m "feat(web): add TopBar global navigation component"
```

---

## Task 4: Update Root Layout with TopBar

Add the TopBar to the root layout so it persists across all pages. Adjust the body to flex column so the top bar + content fill the screen.

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/__tests__/layout.test.tsx`

**Step 1: Update the test**

The existing test checks that `<html>`, `<body>`, and children render. Update it to also verify the TopBar is present:

```tsx
// apps/web/src/app/__tests__/layout.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "inter-mock" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const { default: RootLayout, metadata } = await import("../layout");

describe("RootLayout", () => {
  it("exports dashboard metadata with correct title", () => {
    expect(metadata.title).toBe("Harness Dashboard");
  });

  it("exports dashboard metadata with correct description", () => {
    expect(metadata.description).toBe(
      "Orchestrator dashboard — threads, tasks, crons, and real-time monitoring",
    );
  });

  it("renders children within an html structure", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Hello</p>
      </RootLayout>,
    );
    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain("<p>Hello</p>");
  });

  it("applies the Inter font className to the body", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );
    expect(html).toContain("inter-mock");
  });

  it("renders the top bar navigation", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );
    expect(html).toContain("Harness");
    expect(html).toContain("Chat");
    expect(html).toContain("Usage");
    expect(html).toContain("Admin");
  });
});
```

**Step 2: Run test to see the new test fail**

Run: `pnpm --filter web test -- src/app/__tests__/layout.test.tsx`
Expected: The "renders the top bar navigation" test fails.

**Step 3: Update the root layout**

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TopBar } from "./_components/top-bar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Harness Dashboard",
  description:
    "Orchestrator dashboard — threads, tasks, crons, and real-time monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen flex-col`}>
        <TopBar />
        <div className="flex min-h-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
```

Note: `min-h-0` on the flex child prevents flex overflow. `h-screen flex flex-col` on body makes top bar + content fill the viewport.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- src/app/__tests__/layout.test.tsx`
Expected: PASS (5 tests).

**Step 5: Commit**

```
git add apps/web/src/app/layout.tsx apps/web/src/app/__tests__/layout.test.tsx
git commit -m "feat(web): add TopBar to root layout for persistent navigation"
```

---

## Task 5: Restructure Chat Routes into (chat) Route Group

Move the chat pages into a `(chat)` route group so that `/` renders the chat layout (with thread sidebar) without the `/chat` URL prefix. The thread detail stays at `/chat/[thread-id]`.

This is the most structural change. The result:
- `app/(chat)/layout.tsx` — chat layout with thread sidebar (applies to `/` and `/chat/*`)
- `app/(chat)/page.tsx` — chat index at `/` (replaces the old home page)
- `app/(chat)/chat/[thread-id]/page.tsx` — thread detail at `/chat/[thread-id]`

**Files:**
- Delete: `apps/web/src/app/page.tsx` (old placeholder home page)
- Move: `apps/web/src/app/chat/layout.tsx` → `apps/web/src/app/(chat)/layout.tsx`
- Move: `apps/web/src/app/chat/page.tsx` → `apps/web/src/app/(chat)/page.tsx`
- Move: `apps/web/src/app/chat/[thread-id]/` → `apps/web/src/app/(chat)/chat/[thread-id]/`
- Move: `apps/web/src/app/chat/_components/` → `apps/web/src/app/(chat)/chat/_components/`
- Move: `apps/web/src/app/chat/_helpers/` → `apps/web/src/app/(chat)/chat/_helpers/`
- Move: `apps/web/src/app/chat/__tests__/` → appropriate locations
- Delete: `apps/web/src/app/__tests__/page.test.tsx` (old home page test)
- Create: `apps/web/src/app/(chat)/__tests__/layout.test.tsx`
- Create: `apps/web/src/app/(chat)/__tests__/page.test.tsx`

**Step 1: Create the (chat) route group directory structure**

```bash
mkdir -p apps/web/src/app/\(chat\)/chat/[thread-id]/__tests__
mkdir -p apps/web/src/app/\(chat\)/chat/_components/__tests__
mkdir -p apps/web/src/app/\(chat\)/chat/_helpers/__tests__
mkdir -p apps/web/src/app/\(chat\)/__tests__
```

**Step 2: Move the chat layout to the route group**

Move `apps/web/src/app/chat/layout.tsx` to `apps/web/src/app/(chat)/layout.tsx`.

Update the layout — the `h-screen` class is no longer needed since the root layout handles full-height via `flex h-screen flex-col`. Change to `h-full` or just `flex flex-1`:

```tsx
// apps/web/src/app/(chat)/layout.tsx
import type { Metadata } from "next";
import { ThreadSidebar } from "./chat/_components/thread-sidebar";

export const metadata: Metadata = {
  title: "Chat | Harness Dashboard",
  description: "Multi-thread chat interface for the Harness orchestrator",
};

type ChatLayoutProps = {
  children: React.ReactNode;
};

type ChatLayoutComponent = (props: ChatLayoutProps) => React.ReactNode;

const ChatLayout: ChatLayoutComponent = ({ children }) => {
  return (
    <div className="flex h-full flex-1">
      <ThreadSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
};

export default ChatLayout;
```

Note: import path changes from `./_components/thread-sidebar` to `./chat/_components/thread-sidebar` since the layout is now one level up.

**Step 3: Move the chat index page to (chat)/page.tsx**

Copy `apps/web/src/app/chat/page.tsx` to `apps/web/src/app/(chat)/page.tsx`. No changes needed — it becomes the home page at `/`.

**Step 4: Move components, helpers, thread-id page, and tests**

Move all files from `apps/web/src/app/chat/_components/` to `apps/web/src/app/(chat)/chat/_components/`.
Move all files from `apps/web/src/app/chat/_helpers/` to `apps/web/src/app/(chat)/chat/_helpers/`.
Move `apps/web/src/app/chat/[thread-id]/page.tsx` to `apps/web/src/app/(chat)/chat/[thread-id]/page.tsx`.
Move `apps/web/src/app/chat/[thread-id]/loading.tsx` to `apps/web/src/app/(chat)/chat/[thread-id]/loading.tsx`.

Update import paths in `[thread-id]/page.tsx` — relative paths from `(chat)/chat/[thread-id]/` to `(chat)/chat/_components/` and `(chat)/chat/_helpers/` stay the same (both are inside `chat/`).

**Step 5: Move test files to their new locations**

Move test files alongside their new source locations:
- `apps/web/src/app/chat/__tests__/layout.test.tsx` → `apps/web/src/app/(chat)/__tests__/layout.test.tsx`
- `apps/web/src/app/chat/__tests__/page.test.tsx` → `apps/web/src/app/(chat)/__tests__/page.test.tsx`
- `apps/web/src/app/chat/[thread-id]/__tests__/` → `apps/web/src/app/(chat)/chat/[thread-id]/__tests__/`
- `apps/web/src/app/chat/_components/__tests__/` → `apps/web/src/app/(chat)/chat/_components/__tests__/`
- `apps/web/src/app/chat/_helpers/__tests__/` → `apps/web/src/app/(chat)/chat/_helpers/__tests__/`

Update test import paths as needed (e.g., `await import("../layout")` stays the same for most since relative paths don't change).

**Step 6: Delete the old page.tsx and its test**

Delete `apps/web/src/app/page.tsx` (old placeholder home page).
Delete `apps/web/src/app/__tests__/page.test.tsx` (old home page test).
Delete the old `apps/web/src/app/chat/` directory (now empty).

**Step 7: Update the (chat) layout test**

```tsx
// apps/web/src/app/(chat)/__tests__/layout.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: ChatLayout, metadata } = await import("../layout");

describe("ChatLayout", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Chat | Harness Dashboard");
  });

  it("exports correct metadata description", () => {
    expect(metadata.description).toBe(
      "Multi-thread chat interface for the Harness orchestrator",
    );
  });

  it("renders children within the layout structure", () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Test child</p>
      </ChatLayout>,
    );
    expect(html).toContain("Test child");
  });

  it("renders a main content area", () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Main content</p>
      </ChatLayout>,
    );
    expect(html).toContain("<main");
    expect(html).toContain("Main content");
  });

  it("renders sidebar skeleton as Suspense fallback", () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Content</p>
      </ChatLayout>,
    );
    expect(html).toContain('data-slot="skeleton"');
  });
});
```

**Step 8: Run all tests**

Run: `pnpm --filter web test`
Expected: All tests pass. Some may need import path fixes — adjust as needed.

**Step 9: Verify build**

Run: `pnpm --filter web build`
Expected: Build succeeds. `/` serves the chat index. `/chat/[thread-id]` serves thread detail.

**Step 10: Commit**

```
git add -A
git commit -m "refactor(web): restructure chat routes into (chat) route group for home page"
```

---

## Task 6: Create AdminNavLink Component

A sidebar navigation link for the admin area — shows icon + label, highlights when active.

**Files:**
- Create: `apps/web/src/app/admin/_components/admin-nav-link.tsx`
- Create: `apps/web/src/app/admin/_components/__tests__/admin-nav-link.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/web/src/app/admin/_components/__tests__/admin-nav-link.test.tsx
import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/admin/cron-jobs";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const { AdminNavLink } = await import("../admin-nav-link");

describe("AdminNavLink", () => {
  it("renders a link with icon and label", () => {
    render(<AdminNavLink href="/admin/cron-jobs" icon={Clock} label="Cron Jobs" />);
    expect(screen.getByRole("link", { name: "Cron Jobs" })).toHaveAttribute(
      "href",
      "/admin/cron-jobs",
    );
  });

  it("applies active styles when pathname matches", () => {
    mockPathname = "/admin/cron-jobs";
    render(<AdminNavLink href="/admin/cron-jobs" icon={Clock} label="Cron Jobs" />);
    const link = screen.getByRole("link", { name: "Cron Jobs" });
    expect(link.className).toContain("bg-secondary");
  });

  it("applies inactive styles when pathname does not match", () => {
    mockPathname = "/admin/plugins";
    render(<AdminNavLink href="/admin/cron-jobs" icon={Clock} label="Cron Jobs" />);
    const link = screen.getByRole("link", { name: "Cron Jobs" });
    expect(link.className).toContain("text-muted-foreground");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/admin/_components/__tests__/admin-nav-link.test.tsx`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```tsx
// apps/web/src/app/admin/_components/admin-nav-link.tsx
"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "ui";

type AdminNavLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type AdminNavLinkComponent = (props: AdminNavLinkProps) => React.ReactNode;

export const AdminNavLink: AdminNavLinkComponent = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/admin/_components/__tests__/admin-nav-link.test.tsx`
Expected: PASS (3 tests).

**Step 5: Commit**

```
git add apps/web/src/app/admin/_components/admin-nav-link.tsx apps/web/src/app/admin/_components/__tests__/admin-nav-link.test.tsx
git commit -m "feat(web): add AdminNavLink component for admin sidebar"
```

---

## Task 7: Create AdminSidebar Component

The admin navigation sidebar with links to all admin sections.

**Files:**
- Create: `apps/web/src/app/admin/_components/admin-sidebar.tsx`
- Create: `apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/cron-jobs",
}));

const { AdminSidebar } = await import("../admin-sidebar");

describe("AdminSidebar", () => {
  it("renders a navigation element", () => {
    render(<AdminSidebar />);
    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
  });

  it("renders the Admin heading", () => {
    render(<AdminSidebar />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders links for all admin sections", () => {
    render(<AdminSidebar />);
    expect(screen.getByRole("link", { name: "Cron Jobs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agent Runs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Threads" })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/admin/_components/__tests__/admin-sidebar.test.tsx`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```tsx
// apps/web/src/app/admin/_components/admin-sidebar.tsx
"use client";

import { Activity, Clock, MessageSquare, Plug, SquareCheck } from "lucide-react";
import { Separator } from "ui";
import { AdminNavLink } from "./admin-nav-link";

type AdminSidebarComponent = () => React.ReactNode;

export const AdminSidebar: AdminSidebarComponent = () => {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Admin</h2>
      </div>
      <Separator />
      <nav className="flex flex-col gap-1 p-3" aria-label="Admin navigation">
        <AdminNavLink href="/admin/cron-jobs" icon={Clock} label="Cron Jobs" />
        <AdminNavLink href="/admin/plugins" icon={Plug} label="Plugins" />
        <AdminNavLink href="/admin/tasks" icon={SquareCheck} label="Tasks" />
        <AdminNavLink href="/admin/agent-runs" icon={Activity} label="Agent Runs" />
        <AdminNavLink href="/admin/threads" icon={MessageSquare} label="Threads" />
      </nav>
    </aside>
  );
};
```

Note: `bg-sidebar` uses the new CSS variable from Task 1. If Tailwind doesn't pick up the custom `--color-sidebar`, fall back to `bg-muted/30` or `bg-[hsl(var(--sidebar))]`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/admin/_components/__tests__/admin-sidebar.test.tsx`
Expected: PASS (3 tests).

**Step 5: Commit**

```
git add apps/web/src/app/admin/_components/admin-sidebar.tsx apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx
git commit -m "feat(web): add AdminSidebar with entity navigation links"
```

---

## Task 8: Create Admin Layout and Index Redirect

The admin layout renders the sidebar + content area. The index page redirects to `/admin/cron-jobs`.

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/admin/__tests__/layout.test.tsx`
- Create: `apps/web/src/app/admin/__tests__/page.test.tsx`

**Step 1: Write the layout test**

```tsx
// apps/web/src/app/admin/__tests__/layout.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/cron-jobs",
}));

const { default: AdminLayout, metadata } = await import("../layout");

describe("AdminLayout", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Admin | Harness Dashboard");
  });

  it("renders children within the layout", () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Admin content</p>
      </AdminLayout>,
    );
    expect(html).toContain("Admin content");
  });

  it("renders the admin sidebar", () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Content</p>
      </AdminLayout>,
    );
    expect(html).toContain("Admin");
    expect(html).toContain("Cron Jobs");
  });

  it("renders a main content area", () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Main</p>
      </AdminLayout>,
    );
    expect(html).toContain("<main");
  });
});
```

**Step 2: Write the index page test**

```tsx
// apps/web/src/app/admin/__tests__/page.test.tsx
import { describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

const { default: AdminPage } = await import("../page");

describe("AdminPage", () => {
  it("redirects to /admin/cron-jobs", () => {
    AdminPage();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/cron-jobs");
  });
});
```

**Step 3: Run tests to see them fail**

Run: `pnpm --filter web test -- src/app/admin/__tests__/`
Expected: FAIL — modules not found.

**Step 4: Write the admin layout**

```tsx
// apps/web/src/app/admin/layout.tsx
import type { Metadata } from "next";
import { AdminSidebar } from "./_components/admin-sidebar";

export const metadata: Metadata = {
  title: "Admin | Harness Dashboard",
  description: "Manage cron jobs, plugins, tasks, agent runs, and threads",
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

type AdminLayoutComponent = (props: AdminLayoutProps) => React.ReactNode;

const AdminLayout: AdminLayoutComponent = ({ children }) => {
  return (
    <div className="flex h-full flex-1">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default AdminLayout;
```

**Step 5: Write the admin index redirect**

```tsx
// apps/web/src/app/admin/page.tsx
import { redirect } from "next/navigation";

type AdminPageComponent = () => never;

const AdminPage: AdminPageComponent = () => {
  redirect("/admin/cron-jobs");
};

export default AdminPage;
```

**Step 6: Run tests to verify they pass**

Run: `pnpm --filter web test -- src/app/admin/__tests__/`
Expected: PASS (all tests).

**Step 7: Commit**

```
git add apps/web/src/app/admin/layout.tsx apps/web/src/app/admin/page.tsx apps/web/src/app/admin/__tests__/
git commit -m "feat(web): add admin layout with sidebar and index redirect"
```

---

## Task 9: Create Admin Cron Jobs Page

Table view of all cron jobs with enable/disable toggle via server action.

**Files:**
- Create: `apps/web/src/app/admin/cron-jobs/page.tsx`
- Create: `apps/web/src/app/admin/cron-jobs/_components/cron-jobs-table.tsx`
- Create: `apps/web/src/app/admin/cron-jobs/_actions/toggle-cron-job.ts`
- Create: `apps/web/src/app/admin/cron-jobs/_components/__tests__/cron-jobs-table.test.tsx`
- Create: `apps/web/src/app/admin/cron-jobs/__tests__/page.test.tsx`
- Create: `apps/web/src/app/admin/cron-jobs/_helpers/format-schedule.ts`
- Create: `apps/web/src/app/admin/cron-jobs/_helpers/__tests__/format-schedule.test.ts`

**Step 1: Write format-schedule helper test**

```ts
// apps/web/src/app/admin/cron-jobs/_helpers/__tests__/format-schedule.test.ts
import { describe, expect, it } from "vitest";
import { formatSchedule } from "../format-schedule";

describe("formatSchedule", () => {
  it("returns the raw cron expression", () => {
    expect(formatSchedule("0 8 * * *")).toBe("0 8 * * *");
  });
});
```

**Step 2: Write the helper**

```ts
// apps/web/src/app/admin/cron-jobs/_helpers/format-schedule.ts
type FormatSchedule = (schedule: string) => string;

export const formatSchedule: FormatSchedule = (schedule) => {
  return schedule;
};
```

**Step 3: Write the table component test**

```tsx
// apps/web/src/app/admin/cron-jobs/_components/__tests__/cron-jobs-table.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    cronJob: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "cron-1",
          name: "daily-summary",
          schedule: "0 8 * * *",
          prompt: "Summarize yesterday",
          enabled: true,
          lastRunAt: new Date("2026-02-23T08:00:00Z"),
          nextRunAt: new Date("2026-02-24T08:00:00Z"),
          threadId: "thread-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cron-2",
          name: "weekly-report",
          schedule: "0 0 * * 1",
          prompt: "Generate weekly report",
          enabled: false,
          lastRunAt: null,
          nextRunAt: null,
          threadId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    },
  },
}));

const { CronJobsTableInternal } = await import("../cron-jobs-table");

describe("CronJobsTableInternal", () => {
  it("renders a table with cron job data", async () => {
    const html = renderToStaticMarkup(await CronJobsTableInternal());
    expect(html).toContain("daily-summary");
    expect(html).toContain("weekly-report");
    expect(html).toContain("0 8 * * *");
  });

  it("shows enabled/disabled status", async () => {
    const html = renderToStaticMarkup(await CronJobsTableInternal());
    expect(html).toContain("Enabled");
    expect(html).toContain("Disabled");
  });
});
```

**Step 4: Write the table component**

```tsx
// apps/web/src/app/admin/cron-jobs/_components/cron-jobs-table.tsx
import { prisma } from "database";
import { Suspense } from "react";
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";
import { formatSchedule } from "../_helpers/format-schedule";

/** @internal Exported for testing only — consumers should use CronJobsTable. */
export const CronJobsTableInternal = async () => {
  const cronJobs = await prisma.cronJob.findMany({
    orderBy: { name: "asc" },
  });

  if (cronJobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No cron jobs configured.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Run</TableHead>
          <TableHead>Next Run</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cronJobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">{job.name}</TableCell>
            <TableCell className="font-mono text-xs">{formatSchedule(job.schedule)}</TableCell>
            <TableCell>
              <Badge variant={job.enabled ? "default" : "secondary"}>
                {job.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {job.lastRunAt ? job.lastRunAt.toLocaleDateString() : "Never"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {job.nextRunAt ? job.nextRunAt.toLocaleDateString() : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const CronJobsTableSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={`cron-skeleton-${i}`} className="h-12 w-full" />
    ))}
  </div>
);

export const CronJobsTable = () => (
  <Suspense fallback={<CronJobsTableSkeleton />}>
    <CronJobsTableInternal />
  </Suspense>
);
```

**Step 5: Write the server action**

```ts
// apps/web/src/app/admin/cron-jobs/_actions/toggle-cron-job.ts
"use server";

import { prisma } from "database";
import { revalidatePath } from "next/cache";

type ToggleCronJob = (id: string, enabled: boolean) => Promise<void>;

export const toggleCronJob: ToggleCronJob = async (id, enabled) => {
  await prisma.cronJob.update({
    where: { id },
    data: { enabled },
  });
  revalidatePath("/admin/cron-jobs");
};
```

**Step 6: Write the page**

```tsx
// apps/web/src/app/admin/cron-jobs/page.tsx
import type { Metadata } from "next";
import { CronJobsTable } from "./_components/cron-jobs-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cron Jobs | Admin | Harness Dashboard",
};

type CronJobsPageComponent = () => React.ReactNode;

const CronJobsPage: CronJobsPageComponent = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Cron Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage scheduled orchestrator tasks.</p>
      </div>
      <CronJobsTable />
    </div>
  );
};

export default CronJobsPage;
```

**Step 7: Write the page test**

```tsx
// apps/web/src/app/admin/cron-jobs/__tests__/page.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: CronJobsPage, metadata } = await import("../page");

describe("CronJobsPage", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Cron Jobs | Admin | Harness Dashboard");
  });

  it("renders page heading", () => {
    const html = renderToStaticMarkup(<CronJobsPage />);
    expect(html).toContain("Cron Jobs");
  });
});
```

**Step 8: Run all tests**

Run: `pnpm --filter web test -- src/app/admin/cron-jobs/`
Expected: PASS.

**Step 9: Commit**

```
git add apps/web/src/app/admin/cron-jobs/
git commit -m "feat(web): add admin cron jobs page with table and toggle action"
```

---

## Task 10: Create Admin Plugins Page

Table/card view of all plugin configurations.

**Files:**
- Create: `apps/web/src/app/admin/plugins/page.tsx`
- Create: `apps/web/src/app/admin/plugins/_components/plugins-table.tsx`
- Create: `apps/web/src/app/admin/plugins/_actions/toggle-plugin.ts`
- Create: `apps/web/src/app/admin/plugins/_components/__tests__/plugins-table.test.tsx`
- Create: `apps/web/src/app/admin/plugins/__tests__/page.test.tsx`

**Step 1: Write the table test**

```tsx
// apps/web/src/app/admin/plugins/_components/__tests__/plugins-table.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    pluginConfig: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "plugin-1",
          pluginName: "discord",
          enabled: true,
          metadata: null,
          settings: { token: "***" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "plugin-2",
          pluginName: "web",
          enabled: false,
          metadata: null,
          settings: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    },
  },
}));

const { PluginsTableInternal } = await import("../plugins-table");

describe("PluginsTableInternal", () => {
  it("renders plugin names", async () => {
    const html = renderToStaticMarkup(await PluginsTableInternal());
    expect(html).toContain("discord");
    expect(html).toContain("web");
  });

  it("shows enabled/disabled badges", async () => {
    const html = renderToStaticMarkup(await PluginsTableInternal());
    expect(html).toContain("Enabled");
    expect(html).toContain("Disabled");
  });
});
```

**Step 2: Write the implementation**

```tsx
// apps/web/src/app/admin/plugins/_components/plugins-table.tsx
import { prisma } from "database";
import { Suspense } from "react";
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";

/** @internal Exported for testing only — consumers should use PluginsTable. */
export const PluginsTableInternal = async () => {
  const plugins = await prisma.pluginConfig.findMany({
    orderBy: { pluginName: "asc" },
  });

  if (plugins.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No plugins configured.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plugin</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Settings</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plugins.map((plugin) => (
          <TableRow key={plugin.id}>
            <TableCell className="font-medium">{plugin.pluginName}</TableCell>
            <TableCell>
              <Badge variant={plugin.enabled ? "default" : "secondary"}>
                {plugin.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {plugin.settings ? "Configured" : "No settings"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const PluginsTableSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={`plugin-skeleton-${i}`} className="h-12 w-full" />
    ))}
  </div>
);

export const PluginsTable = () => (
  <Suspense fallback={<PluginsTableSkeleton />}>
    <PluginsTableInternal />
  </Suspense>
);
```

**Step 3: Write the server action**

```ts
// apps/web/src/app/admin/plugins/_actions/toggle-plugin.ts
"use server";

import { prisma } from "database";
import { revalidatePath } from "next/cache";

type TogglePlugin = (id: string, enabled: boolean) => Promise<void>;

export const togglePlugin: TogglePlugin = async (id, enabled) => {
  await prisma.pluginConfig.update({
    where: { id },
    data: { enabled },
  });
  revalidatePath("/admin/plugins");
};
```

**Step 4: Write the page and page test**

```tsx
// apps/web/src/app/admin/plugins/page.tsx
import type { Metadata } from "next";
import { PluginsTable } from "./_components/plugins-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plugins | Admin | Harness Dashboard",
};

type PluginsPageComponent = () => React.ReactNode;

const PluginsPage: PluginsPageComponent = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Plugins</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure and manage orchestrator plugins.</p>
      </div>
      <PluginsTable />
    </div>
  );
};

export default PluginsPage;
```

```tsx
// apps/web/src/app/admin/plugins/__tests__/page.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: PluginsPage, metadata } = await import("../page");

describe("PluginsPage", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Plugins | Admin | Harness Dashboard");
  });

  it("renders page heading", () => {
    const html = renderToStaticMarkup(<PluginsPage />);
    expect(html).toContain("Plugins");
  });
});
```

**Step 5: Run tests and commit**

Run: `pnpm --filter web test -- src/app/admin/plugins/`
Expected: PASS.

```
git add apps/web/src/app/admin/plugins/
git commit -m "feat(web): add admin plugins page with table and toggle action"
```

---

## Task 11: Create Admin Tasks Page

Table view of orchestrator tasks with status filtering.

**Files:**
- Create: `apps/web/src/app/admin/tasks/page.tsx`
- Create: `apps/web/src/app/admin/tasks/_components/tasks-table.tsx`
- Create: `apps/web/src/app/admin/tasks/_components/__tests__/tasks-table.test.tsx`
- Create: `apps/web/src/app/admin/tasks/__tests__/page.test.tsx`

**Step 1: Write the table test**

```tsx
// apps/web/src/app/admin/tasks/_components/__tests__/tasks-table.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    orchestratorTask: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "task-1",
          threadId: "thread-1",
          parentTaskId: null,
          status: "completed",
          prompt: "Analyze the logs",
          result: "Analysis complete",
          maxIterations: 3,
          currentIteration: 2,
          createdAt: new Date("2026-02-23T10:00:00Z"),
          updatedAt: new Date("2026-02-23T10:05:00Z"),
          thread: { id: "thread-1", name: "Primary" },
        },
      ]),
    },
  },
}));

const { TasksTableInternal } = await import("../tasks-table");

describe("TasksTableInternal", () => {
  it("renders task data", async () => {
    const html = renderToStaticMarkup(await TasksTableInternal());
    expect(html).toContain("Analyze the logs");
    expect(html).toContain("completed");
  });

  it("shows iteration progress", async () => {
    const html = renderToStaticMarkup(await TasksTableInternal());
    expect(html).toContain("2/3");
  });
});
```

**Step 2: Write the implementation**

```tsx
// apps/web/src/app/admin/tasks/_components/tasks-table.tsx
import { prisma } from "database";
import { Suspense } from "react";
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
};

/** @internal Exported for testing only — consumers should use TasksTable. */
export const TasksTableInternal = async () => {
  const tasks = await prisma.orchestratorTask.findMany({
    orderBy: { createdAt: "desc" },
    include: { thread: { select: { id: true, name: true } } },
    take: 50,
  });

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Prompt</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Iterations</TableHead>
          <TableHead>Thread</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="max-w-xs truncate font-medium">{task.prompt}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[task.status] ?? "outline"}>
                {task.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {task.currentIteration}/{task.maxIterations}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {task.thread.name ?? task.thread.id.slice(0, 8)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {task.createdAt.toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const TasksTableSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 5 }, (_, i) => (
      <Skeleton key={`task-skeleton-${i}`} className="h-12 w-full" />
    ))}
  </div>
);

export const TasksTable = () => (
  <Suspense fallback={<TasksTableSkeleton />}>
    <TasksTableInternal />
  </Suspense>
);
```

**Step 3: Write the page and page test**

```tsx
// apps/web/src/app/admin/tasks/page.tsx
import type { Metadata } from "next";
import { TasksTable } from "./_components/tasks-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tasks | Admin | Harness Dashboard",
};

type TasksPageComponent = () => React.ReactNode;

const TasksPage: TasksPageComponent = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">View orchestrator task history and status.</p>
      </div>
      <TasksTable />
    </div>
  );
};

export default TasksPage;
```

```tsx
// apps/web/src/app/admin/tasks/__tests__/page.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: TasksPage, metadata } = await import("../page");

describe("TasksPage", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Tasks | Admin | Harness Dashboard");
  });

  it("renders page heading", () => {
    const html = renderToStaticMarkup(<TasksPage />);
    expect(html).toContain("Tasks");
  });
});
```

**Step 4: Run tests and commit**

Run: `pnpm --filter web test -- src/app/admin/tasks/`
Expected: PASS.

```
git add apps/web/src/app/admin/tasks/
git commit -m "feat(web): add admin tasks page with status badges and iteration display"
```

---

## Task 12: Create Admin Agent Runs Page

Table view of agent run history showing model, tokens, cost, and status.

**Files:**
- Create: `apps/web/src/app/admin/agent-runs/page.tsx`
- Create: `apps/web/src/app/admin/agent-runs/_components/agent-runs-table.tsx`
- Create: `apps/web/src/app/admin/agent-runs/_components/__tests__/agent-runs-table.test.tsx`
- Create: `apps/web/src/app/admin/agent-runs/__tests__/page.test.tsx`

**Step 1: Write the table test**

```tsx
// apps/web/src/app/admin/agent-runs/_components/__tests__/agent-runs-table.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    agentRun: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "run-1",
          threadId: "thread-1",
          taskId: null,
          model: "claude-sonnet-4-5-20250514",
          inputTokens: 1500,
          outputTokens: 800,
          costEstimate: 0.012,
          durationMs: 3200,
          status: "completed",
          error: null,
          startedAt: new Date("2026-02-23T10:00:00Z"),
          completedAt: new Date("2026-02-23T10:00:03Z"),
          thread: { id: "thread-1", name: "Primary" },
        },
      ]),
    },
  },
}));

const { AgentRunsTableInternal } = await import("../agent-runs-table");

describe("AgentRunsTableInternal", () => {
  it("renders agent run data", async () => {
    const html = renderToStaticMarkup(await AgentRunsTableInternal());
    expect(html).toContain("claude-sonnet-4-5-20250514");
    expect(html).toContain("completed");
  });

  it("shows token counts", async () => {
    const html = renderToStaticMarkup(await AgentRunsTableInternal());
    expect(html).toContain("1,500");
    expect(html).toContain("800");
  });
});
```

**Step 2: Write the implementation**

```tsx
// apps/web/src/app/admin/agent-runs/_components/agent-runs-table.tsx
import { prisma } from "database";
import { Suspense } from "react";
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  running: "default",
  completed: "secondary",
  failed: "destructive",
};

type FormatTokens = (count: number) => string;

const formatTokens: FormatTokens = (count) => {
  return count.toLocaleString();
};

type FormatCost = (cost: number) => string;

const formatCost: FormatCost = (cost) => {
  return `$${cost.toFixed(4)}`;
};

/** @internal Exported for testing only — consumers should use AgentRunsTable. */
export const AgentRunsTableInternal = async () => {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: "desc" },
    include: { thread: { select: { id: true, name: true } } },
    take: 50,
  });

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No agent runs found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Input</TableHead>
          <TableHead className="text-right">Output</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead>Thread</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="font-mono text-xs">{run.model}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[run.status] ?? "outline"}>
                {run.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-sm">{formatTokens(run.inputTokens)}</TableCell>
            <TableCell className="text-right text-sm">{formatTokens(run.outputTokens)}</TableCell>
            <TableCell className="text-right text-sm font-mono">{formatCost(run.costEstimate)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {run.thread.name ?? run.thread.id.slice(0, 8)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {run.startedAt.toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const AgentRunsTableSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 5 }, (_, i) => (
      <Skeleton key={`run-skeleton-${i}`} className="h-12 w-full" />
    ))}
  </div>
);

export const AgentRunsTable = () => (
  <Suspense fallback={<AgentRunsTableSkeleton />}>
    <AgentRunsTableInternal />
  </Suspense>
);
```

**Step 3: Write the page and page test**

```tsx
// apps/web/src/app/admin/agent-runs/page.tsx
import type { Metadata } from "next";
import { AgentRunsTable } from "./_components/agent-runs-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Runs | Admin | Harness Dashboard",
};

type AgentRunsPageComponent = () => React.ReactNode;

const AgentRunsPage: AgentRunsPageComponent = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent Runs</h1>
        <p className="mt-1 text-sm text-muted-foreground">View model invocations, token usage, and costs per run.</p>
      </div>
      <AgentRunsTable />
    </div>
  );
};

export default AgentRunsPage;
```

```tsx
// apps/web/src/app/admin/agent-runs/__tests__/page.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: AgentRunsPage, metadata } = await import("../page");

describe("AgentRunsPage", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Agent Runs | Admin | Harness Dashboard");
  });

  it("renders page heading", () => {
    const html = renderToStaticMarkup(<AgentRunsPage />);
    expect(html).toContain("Agent Runs");
  });
});
```

**Step 4: Run tests and commit**

Run: `pnpm --filter web test -- src/app/admin/agent-runs/`
Expected: PASS.

```
git add apps/web/src/app/admin/agent-runs/
git commit -m "feat(web): add admin agent runs page with token and cost display"
```

---

## Task 13: Create Admin Threads Page

Table view of all threads with archive action.

**Files:**
- Create: `apps/web/src/app/admin/threads/page.tsx`
- Create: `apps/web/src/app/admin/threads/_components/threads-table.tsx`
- Create: `apps/web/src/app/admin/threads/_actions/archive-thread.ts`
- Create: `apps/web/src/app/admin/threads/_components/__tests__/threads-table.test.tsx`
- Create: `apps/web/src/app/admin/threads/__tests__/page.test.tsx`

**Step 1: Write the table test**

```tsx
// apps/web/src/app/admin/threads/_components/__tests__/threads-table.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("database", () => ({
  prisma: {
    thread: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "thread-1",
          source: "discord",
          sourceId: "channel-1",
          name: "Primary Thread",
          kind: "primary",
          status: "open",
          parentThreadId: null,
          lastActivity: new Date("2026-02-23T12:00:00Z"),
          createdAt: new Date("2026-02-20T10:00:00Z"),
          updatedAt: new Date("2026-02-23T12:00:00Z"),
          _count: { messages: 42 },
        },
      ]),
    },
  },
}));

const { ThreadsTableInternal } = await import("../threads-table");

describe("ThreadsTableInternal", () => {
  it("renders thread data", async () => {
    const html = renderToStaticMarkup(await ThreadsTableInternal());
    expect(html).toContain("Primary Thread");
    expect(html).toContain("primary");
    expect(html).toContain("open");
  });

  it("shows message count", async () => {
    const html = renderToStaticMarkup(await ThreadsTableInternal());
    expect(html).toContain("42");
  });
});
```

**Step 2: Write the implementation**

```tsx
// apps/web/src/app/admin/threads/_components/threads-table.tsx
import { prisma } from "database";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  open: "default",
  closed: "secondary",
  archived: "outline",
};

/** @internal Exported for testing only — consumers should use ThreadsTable. */
export const ThreadsTableInternal = async () => {
  const threads = await prisma.thread.findMany({
    orderBy: { lastActivity: "desc" },
    include: { _count: { select: { messages: true } } },
    take: 50,
  });

  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No threads found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {threads.map((thread) => {
          const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;
          return (
            <TableRow key={thread.id}>
              <TableCell className="font-medium">{displayName}</TableCell>
              <TableCell>
                <Badge variant="outline">{thread.kind}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[thread.status] ?? "outline"}>
                  {thread.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{thread.source}</TableCell>
              <TableCell className="text-right text-sm">{thread._count.messages}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {thread.lastActivity.toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Link
                  href={`/chat/${thread.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const ThreadsTableSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-8 w-full" />
    {Array.from({ length: 5 }, (_, i) => (
      <Skeleton key={`thread-skeleton-${i}`} className="h-12 w-full" />
    ))}
  </div>
);

export const ThreadsTable = () => (
  <Suspense fallback={<ThreadsTableSkeleton />}>
    <ThreadsTableInternal />
  </Suspense>
);
```

**Step 3: Write the server action**

```ts
// apps/web/src/app/admin/threads/_actions/archive-thread.ts
"use server";

import { prisma } from "database";
import { revalidatePath } from "next/cache";

type ArchiveThread = (id: string) => Promise<void>;

export const archiveThread: ArchiveThread = async (id) => {
  await prisma.thread.update({
    where: { id },
    data: { status: "archived" },
  });
  revalidatePath("/admin/threads");
};
```

**Step 4: Write the page and page test**

```tsx
// apps/web/src/app/admin/threads/page.tsx
import type { Metadata } from "next";
import { ThreadsTable } from "./_components/threads-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Threads | Admin | Harness Dashboard",
};

type ThreadsPageComponent = () => React.ReactNode;

const ThreadsPage: ThreadsPageComponent = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Threads</h1>
        <p className="mt-1 text-sm text-muted-foreground">View and manage all conversation threads.</p>
      </div>
      <ThreadsTable />
    </div>
  );
};

export default ThreadsPage;
```

```tsx
// apps/web/src/app/admin/threads/__tests__/page.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: ThreadsPage, metadata } = await import("../page");

describe("ThreadsPage", () => {
  it("exports correct metadata title", () => {
    expect(metadata.title).toBe("Threads | Admin | Harness Dashboard");
  });

  it("renders page heading", () => {
    const html = renderToStaticMarkup(<ThreadsPage />);
    expect(html).toContain("Threads");
  });
});
```

**Step 5: Run tests and commit**

Run: `pnpm --filter web test -- src/app/admin/threads/`
Expected: PASS.

```
git add apps/web/src/app/admin/threads/
git commit -m "feat(web): add admin threads page with message counts and archive action"
```

---

## Task 14: Restyle Usage Page Under Global Layout

The usage page now sits inside the root layout with the top bar above it. Remove any redundant min-h-screen or standalone padding. Keep the content as-is.

**Files:**
- Modify: `apps/web/src/app/usage/page.tsx`
- Modify: `apps/web/src/app/usage/__tests__/page.test.tsx` (if needed)

**Step 1: Check if any layout changes are needed**

The usage page uses `mx-auto max-w-6xl space-y-6 p-6` which should work fine inside the new `flex min-h-0 flex-1` content area. No changes may be needed. Verify by checking that the test still passes and the page renders correctly under the new root layout.

Run: `pnpm --filter web test -- src/app/usage/__tests__/page.test.tsx`

If it passes, the usage page needs no changes. If styling looks off during manual testing, add `overflow-auto` to the usage page wrapper or adjust padding.

**Step 2: Commit if changes were needed**

```
git add apps/web/src/app/usage/
git commit -m "style(web): adjust usage page layout for global shell"
```

---

## Task 15: Full Test Suite & Build Verification

Run the complete test suite, typecheck, lint, and build to ensure everything works together.

**Step 1: Run all tests**

Run: `pnpm --filter web test`
Expected: All tests pass.

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors.

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

**Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds for all packages.

**Step 5: Fix any issues found**

If any step fails, fix the issue and re-run. Common issues:
- Import path mismatches after the route group restructure
- Missing `"use client"` directives
- Tailwind class names not resolving (check `@source` paths in globals.css)

**Step 6: Final commit if any fixes were needed**

```
git add -A
git commit -m "fix(web): resolve test and build issues from dashboard restructure"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Color palette update | 0 | 1 (globals.css) |
| 2 | NavLink component | 2 | 0 |
| 3 | TopBar component | 2 | 0 |
| 4 | Root layout update | 0 | 2 (layout + test) |
| 5 | (chat) route group restructure | ~5 | ~15 (moves + path updates) |
| 6 | AdminNavLink component | 2 | 0 |
| 7 | AdminSidebar component | 2 | 0 |
| 8 | Admin layout + redirect | 4 | 0 |
| 9 | Cron Jobs admin page | 7 | 0 |
| 10 | Plugins admin page | 5 | 0 |
| 11 | Tasks admin page | 4 | 0 |
| 12 | Agent Runs admin page | 4 | 0 |
| 13 | Threads admin page | 5 | 0 |
| 14 | Usage page adjustment | 0 | 0-2 |
| 15 | Full verification | 0 | 0-N (fixes) |

**Total: ~42 new files, ~18 modified/moved files, 15 tasks, ~15 commits**
