# Research: Next.js E2E Testing — Official Docs, Patterns, and Community Consensus

Date: 2026-03-19

## Summary

As of early 2026 (Next.js 16.2.0), Playwright is the de facto standard for E2E testing in Next.js applications. The official Next.js docs treat it as the primary E2E option. Vitest is explicitly scoped to unit testing and does not replace Playwright. Cypress remains supported but carries more friction for App Router projects. Database seeding follows a Prisma + Docker test-database pattern. The Page Object Model (POM) is Playwright's officially documented pattern for larger test suites.

## Prior Research

No prior E2E testing research found in AI_RESEARCH/.

## Current Findings

---

### 1. Vercel/Next.js Official Recommendations

**Source:** https://nextjs.org/docs/app/guides/testing (version 16.2.0, last updated 2026-02-03)

The official testing overview lists four supported tools:
- **Playwright** — recommended for E2E Testing
- **Cypress** — recommended for E2E Testing and Component Testing
- **Vitest** — recommended for Unit Testing
- **Jest** — recommended for Unit Testing and Snapshot Testing

**Critical quote directly from the docs (Confidence: HIGH):**
> "Since `async` Server Components are new to the React ecosystem, some tools do not fully support them. In the meantime, we recommend using **End-to-End Testing** over **Unit Testing** for `async` components."

This is the most important statement for App Router development: the official position is that async Server Components (the bread-and-butter of App Router) should be covered by E2E tests, not unit tests.

**Playwright is the primary E2E example.** The official `create-next-app` quickstart for E2E is `--example with-playwright`. There is no equivalent quickstart for Cypress in the same prominent position.

**Vitest docs explicitly state (Confidence: HIGH):**
> "Since `async` Server Components are new to the React ecosystem, Vitest currently does not support them. While you can still run **unit tests** for synchronous Server and Client Components, we recommend using **E2E tests** for `async` components."

---

### 2. Next.js 15/16 App Router Considerations

**Source:** nextjs.org/docs/app/guides/testing, nextjs.org/docs/app/guides/testing/playwright

#### Async Server Components
Async Server Components cannot be unit-tested with Vitest or Jest. The official recommendation is to cover them with Playwright E2E tests instead. This is documented in both the Playwright and Vitest guides.

#### Server Actions
No framework-specific guidance exists in the official docs for testing Server Actions directly. The practical pattern is:
- **E2E**: Submit a form in a real browser, verify the resulting UI or database state
- **API testing**: Use Playwright's `request` fixture to POST directly to the action's endpoint (Server Actions are accessible as `POST` endpoints) and verify the response

#### Cypress and Component Testing
Cypress's component testing explicitly **does not support async Server Components**:
> "Cypress currently doesn't support Component Testing for `async` Server Components. We recommend using E2E testing."

This means Cypress component tests are only viable for Client Components. For App Router heavy apps, Cypress has a meaningful coverage gap at the component level.

#### Summary of framework fit for App Router:

| Feature | Playwright E2E | Cypress E2E | Cypress Component | Vitest |
|---|---|---|---|---|
| Async Server Components | Yes (via full render) | Yes (via full render) | No | No |
| Client Components | Yes | Yes | Yes | Yes (jsdom) |
| Server Actions | Yes (via form/API) | Yes (via form) | N/A | Partial (mocked) |
| App Router navigation | Yes | Yes | N/A | N/A |

---

### 3. Community Consensus

**Official Vercel example repository:** https://github.com/vercel/next.js/tree/canary/examples/with-playwright

The official Next.js GitHub has a maintained `with-playwright` example that:
- Uses an `e2e/` directory for test files
- Configures `webServer` to auto-start Next.js dev server
- Sets `baseURL: http://localhost:${PORT || 3000}`
- Tests Desktop Chrome, Mobile Chrome (Pixel 5), and Mobile Safari (iPhone 12)
- Sets 30-second test timeout with 2 retries on failure
- Enables trace recording on retry

There is no equivalent maintained `with-cypress` example at the same level of Vercel's own tooling and documentation investment.

**Vercel blog:** Specific blog posts on this topic returned 404, suggesting they may have been removed or consolidated. The docs are the authoritative source.

**Vitest browser mode community note:** The Vitest docs themselves state browser mode "is still in its early stages of development" and recommend augmenting with "a standalone browser-side test runner like WebdriverIO, Cypress or Playwright."

---

### 4. Page Object Model vs Other Patterns

**Source:** https://playwright.dev/docs/pom (official Playwright documentation)

Playwright officially documents and recommends the Page Object Model pattern for larger test suites:

> "Page objects **simplify authoring** by creating a higher-level API which suits your application and **simplify maintenance** by capturing element selectors in one place and create reusable code to avoid repetition."

The POM pattern in Playwright uses TypeScript classes that:
- Encapsulate page locators as class properties
- Expose methods for user interactions (`login()`, `submitForm()`, etc.)
- Use the `page` fixture from `test.extend()`

**Official Playwright best practices** (source: https://playwright.dev/docs/best-practices) complement POM with:

1. **Use locators** — prefer ARIA roles, text content, and test IDs over CSS selectors. `page.getByRole('button', { name: 'Submit' })` is preferred over `page.locator('.btn-submit')`.
2. **Web-first assertions** — use `expect(locator).toBeVisible()` rather than manual `waitForSelector` — Playwright auto-retries web-first assertions.
3. **Test isolation** — each test should be fully independent with its own data and state.
4. **Avoid third-party dependencies** — mock external services with Playwright's Network API rather than calling real APIs.

**Fixture pattern (complements POM):** For test data management, the recommended pattern is Playwright fixtures:

```typescript
export const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
    await todoPage.cleanup(); // teardown
  },
});
```

This combines the Page Object pattern (the `TodoPage` class) with Playwright's fixture system (the `test.extend()` registration). For large apps, this is the current best-practice pattern: POMs for page abstractions, fixtures for setup/teardown lifecycle.

**Alternative patterns not recommended for large apps:**
- Inline selectors scattered across test files — breaks when markup changes
- Shared mutable state between tests — causes flakiness in parallel execution

---

### 5. Database Seeding Strategies

**Sources:**
- https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing
- https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- https://playwright.dev/docs/test-global-setup-teardown
- https://playwright.dev/docs/test-fixtures

#### Prisma Official Pattern

**Isolated test database via Docker:**
```
1. docker-compose up (PostgreSQL on port 5433, separate from dev on 5432)
2. npx prisma migrate deploy (applies migrations to test DB)
3. Run tests
4. docker-compose down
```

Uses a separate `.env.test` with `DATABASE_URL=postgresql://prisma:prisma@localhost:5433/tests`.

**Seed/teardown in tests:**
```typescript
// beforeAll — seed
await prisma.user.createMany({ data: testUsers });

// afterAll — cleanup (in dependency order)
await prisma.$transaction([
  prisma.post.deleteMany(),
  prisma.user.deleteMany(),
]);
await prisma.$disconnect();
```

For complex schemas, Prisma recommends raw SQL `TRUNCATE` statements rather than chained `deleteMany()`.

**Prisma seed scripts** (as of Prisma ORM v7): Seeding is only triggered explicitly with `npx prisma db seed`. The seed command is configured in `prisma.config.ts`:
```typescript
export default defineConfig({
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
```

Custom CLI args are supported via `npx prisma db seed -- --environment test`, allowing environment-specific seed logic.

#### Playwright Global Setup Pattern

**Recommended: Project Dependencies** (preferred over the legacy `globalSetup`/`globalTeardown` config properties):

```typescript
// playwright.config.ts
{
  projects: [
    { name: 'setup db', testMatch: /global\.setup\.ts/ },
    { name: 'e2e tests', dependencies: ['setup db'] },
  ]
}
```

This is preferred because:
- Setup failures appear in the HTML report
- Full trace recording works in setup
- Playwright fixtures can be used in setup

**Recommended pattern combining all three:**

1. `global.setup.ts` — runs `npx prisma db seed` or direct Prisma calls to seed test data
2. POM classes in `e2e/pages/` — encapsulate locators and interactions
3. Fixtures in `e2e/fixtures.ts` — extend `test` with database-aware setup/teardown per test
4. `global.teardown.ts` — truncate test tables, stop services

---

### 6. Monorepo / pnpm Workspace Considerations

**Sources:** Turborepo docs redirected (404), official Playwright `webServer` docs, Next.js `with-playwright` example config

The Turborepo testing guide was unavailable. Based on Playwright's `webServer` documentation and the official Next.js example:

#### Placement of E2E tests in a monorepo

The Vercel official example places tests in `e2e/` at the **app root** (`apps/web/e2e/`), not in a separate package. This is the standard pattern — E2E tests test the deployed app, not individual packages, so they live next to the app they test.

**Alternative pattern (separate `apps/e2e` package):** Some large monorepos create a dedicated `apps/e2e` package with its own `package.json` and `playwright.config.ts`. This is useful when testing multiple apps from one suite.

#### pnpm workspace `playwright.config.ts` setup

```typescript
// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',  // or 'pnpm build && pnpm start' for production build
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    cwd: process.cwd(), // important: ensure correct cwd in monorepo
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

**Turborepo `turbo.json` task:**
```json
{
  "tasks": {
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

E2E tests should generally not be cached in Turborepo (side effects, network calls). Set `"cache": false`.

**Key monorepo considerations:**
- Run E2E tests against a production build (`pnpm build && pnpm start`) on CI for accuracy — dev server can mask SSR bugs
- The `webServer.cwd` option ensures Playwright spawns the server from the correct package directory
- The `DATABASE_URL` in the E2E test environment must point to the test database, not the development database — use `.env.test.local` or CI environment variables

---

### 7. Vitest Browser Mode — Can It Replace Playwright?

**Sources:**
- https://vitest.dev/guide/browser/why
- https://vitest.dev/guide/browser/playwright (Playwright as Vitest provider)
- nextjs.org/docs/app/guides/testing/vitest

**Short answer: No. Vitest browser mode is complementary, not a replacement.**

**Official Vitest statement (Confidence: HIGH):**
> "It is recommended that users augment their Vitest browser experience with a standalone browser-side test runner like WebdriverIO, Cypress or Playwright"

**What Vitest browser mode actually is:**
- Uses Playwright (or WebdriverIO) as the browser *engine* to run Vitest's test framework in a real browser context
- Solves the jsdom accuracy problem: "testing frameworks like Jest using jsdom only simulate a browser environment, creating false positives or negatives"
- Scoped to **unit and component testing** in real browser environments
- Still in "early stages of development" per official docs

**Critical limitation:** "Vitest opens a single page to run all tests that are defined in the same file. This means that isolation is restricted to a single test file, not to every individual test." This is fundamentally different from Playwright's per-test isolated browser context model.

**Not supported in Vitest (browser mode or otherwise):**
- Async Server Components (requires a running Next.js server)
- Multi-page user flows (no page navigation between tests by design)
- Full App Router rendering pipeline (no server-side rendering in Vitest context)

**Next.js explicit position:** The official Vitest guide for Next.js does not mention browser mode at all. It only documents jsdom-based unit testing.

**Verdict:** Vitest browser mode is useful for testing interactive Client Components in a real browser (better than jsdom for DOM APIs), but does not replace Playwright for:
- Testing async Server Components
- Testing Server Actions in context
- Testing App Router navigation flows
- Testing auth flows, redirects, middleware
- Any multi-page user journey

---

## Key Takeaways

1. **Playwright is the official Next.js E2E choice.** Next.js 16 docs, `create-next-app --example with-playwright`, and the Vercel GitHub all point here.

2. **Async Server Components must be tested via E2E.** This is an explicit official recommendation from Next.js docs — Vitest and Jest cannot test async Server Components.

3. **Vitest browser mode is not production-ready for E2E.** It is an enhancement for component unit testing in real browsers, not a Playwright replacement. Its own docs recommend using Playwright alongside it.

4. **Page Object Model + Playwright Fixtures is the recommended organizational pattern** for large test suites. POMs for page abstractions, fixtures for lifecycle management.

5. **Prisma + Docker test database is the standard seeding approach.** Use a separate PostgreSQL instance on a different port, apply migrations before tests, seed in `beforeAll`, truncate in `afterAll`.

6. **E2E tests belong in `apps/web/e2e/`** in a monorepo — next to the app they test. Use `"cache": false` in Turborepo for E2E tasks. Set `webServer.cwd` explicitly.

7. **Test against production builds on CI.** `pnpm build && pnpm start` catches SSR and build-time issues that dev mode hides.

---

## Gaps Identified

- Turborepo official E2E testing docs returned 404 — the turborepo.dev domain may have changed. No authoritative monorepo-specific guidance was found.
- No official Vercel blog posts on E2E testing with Next.js App Router found (all URLs 404'd). This content may have been consolidated into the main docs.
- Server Actions testing patterns are not officially documented — only community patterns exist. Direct API testing via Playwright's `request` fixture is the practical approach but not officially endorsed for actions specifically.
- No official statement found on whether `pnpm` workspace hoisting causes any Playwright installation issues (`@playwright/test` browsers installed at workspace root vs app level).

## Recommendations for Next Steps

- For this codebase (Next.js 16, App Router, Prisma, pnpm monorepo): place E2E tests at `apps/web/e2e/`, configure `playwright.config.ts` with `webServer` pointing to `pnpm start` (production build) for CI and `reuseExistingServer: true` for local dev.
- Use `global.setup.ts` as a project dependency (not `globalSetup` config) to seed test data via Prisma before tests run.
- Adopt the Page Object + Fixture hybrid pattern: POM classes in `apps/web/e2e/pages/`, shared fixtures in `apps/web/e2e/fixtures.ts`.
- Do not use Vitest browser mode as an E2E substitute — keep Vitest for unit/helper testing and Playwright for anything that requires a running Next.js server.

## Sources

| URL | What it covers |
|-----|---------------|
| https://nextjs.org/docs/app/guides/testing | Official Next.js testing overview (v16.2.0, 2026-02-03) |
| https://nextjs.org/docs/app/guides/testing/playwright | Official Playwright setup guide for Next.js |
| https://nextjs.org/docs/app/guides/testing/cypress | Official Cypress setup guide for Next.js |
| https://nextjs.org/docs/app/guides/testing/vitest | Official Vitest setup guide for Next.js |
| https://playwright.dev/docs/pom | Official Playwright Page Object Model documentation |
| https://playwright.dev/docs/best-practices | Official Playwright testing best practices |
| https://playwright.dev/docs/test-fixtures | Official Playwright fixtures documentation |
| https://playwright.dev/docs/test-global-setup-teardown | Official Playwright global setup/teardown docs |
| https://playwright.dev/docs/api-testing | Official Playwright API testing documentation |
| https://playwright.dev/docs/test-webserver | Official Playwright webServer configuration |
| https://vitest.dev/guide/browser/ | Vitest browser mode overview |
| https://vitest.dev/guide/browser/why | Vitest browser mode rationale |
| https://vitest.dev/guide/browser/playwright | Playwright provider for Vitest |
| https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing | Prisma integration testing patterns |
| https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding | Prisma seeding documentation |
| https://github.com/vercel/next.js/tree/canary/examples/with-playwright | Official Next.js + Playwright example |
