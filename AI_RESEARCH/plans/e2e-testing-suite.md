# E2E Testing Suite Plan

## Overview
Playwright-based E2E tests for Harness's deterministic UI flows. Tests live at `apps/web/e2e/` co-located with the web app per Next.js official guidance.

## Scope
- Admin pages (cron jobs, plugins, threads, tasks, agent runs, usage, errors, integrations, profile)
- Agents CRUD
- Projects CRUD
- User Tasks CRUD
- Calendar (with mocked Graph API)
- Thread management

## Excluded
- Agent responses (non-deterministic)
- Search (non-deterministic, Qdrant)
- GitHub CI (local-only for now)
- OAuth flows (external service)

## Database Safety
- **Always Testcontainers** — fresh Postgres 16 container per test run
- **Never reads .env** — connection string constructed programmatically from container
- **Zero risk of touching production** — ephemeral port, ephemeral data

## Phases

### Phase 1: Infrastructure (current)
- Playwright in apps/web
- Testcontainer DB setup as Playwright project dependency
- Page Object Model + Fixtures foundation
- Turbo/scripts integration
- First smoke test

### Phase 2: Admin Page Tests
- Admin navigation, cron jobs CRUD, plugins, read-only pages, profile

### Phase 3: Core Entity CRUD
- Agents, Projects, User Tasks

### Phase 4: Calendar
- View rendering, event CRUD (mocked Graph API)

### Phase 5: Thread Management
- Rename, manage modal, new chat

## File Structure
```
apps/web/
├── playwright.config.ts
├── e2e/
│   ├── fixtures.ts
│   ├── setup/
│   │   ├── global.setup.ts
│   │   ├── seed-data.ts
│   │   └── test-database.ts
│   ├── pages/
│   │   ├── base.page.ts
│   │   ├── admin/
│   │   │   ├── cron-jobs.page.ts
│   │   │   ├── plugins.page.ts
│   │   │   ├── threads.page.ts
│   │   │   ├── profile.page.ts
│   │   │   └── usage.page.ts
│   │   ├── agents.page.ts
│   │   ├── projects.page.ts
│   │   ├── tasks.page.ts
│   │   ├── calendar.page.ts
│   │   └── thread.page.ts
│   ├── tests/
│   │   ├── smoke.spec.ts
│   │   ├── admin/
│   │   │   ├── cron-jobs.spec.ts
│   │   │   ├── plugins.spec.ts
│   │   │   ├── read-only-pages.spec.ts
│   │   │   └── profile.spec.ts
│   │   ├── agents.spec.ts
│   │   ├── projects.spec.ts
│   │   ├── tasks.spec.ts
│   │   ├── calendar.spec.ts
│   │   └── thread-management.spec.ts
│   └── test-results/
```

## Key Decisions
- ARIA-first locators (getByRole, getByText) — no CSS selectors unless unavoidable
- Testcontainers for DB — same pattern as tests/integration/
- Playwright project dependencies for setup (not globalSetup) — appears in reports
- Chromium only initially
- retries: 0 locally
