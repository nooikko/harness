# Research: E2E Testing Approaches for Next.js 16 + Node.js Monorepo
Date: 2026-03-02

## Summary

Six E2E testing topics researched for this monorepo (Next.js 16 App Router, Node.js orchestrator, Prisma/PostgreSQL, WebSockets, pnpm + Turborepo). The dominant pattern that emerges: **Playwright is the right primary tool for full E2E**, Testcontainers handles real database isolation, and Vitest browser mode is a secondary tool for component-level work — not a replacement for Playwright in this stack.

---

## 1. Playwright for Next.js 16 App Router

### What it covers
Full browser-level E2E testing of the rendered application. When Playwright navigates to a page it receives fully-rendered HTML — this means Server Components are tested through their output, not their internals.

### Official Next.js 16 stance
The Next.js 16 docs (last updated 2026-02-27, version 16.1.6) explicitly recommend **End-to-End Testing over Unit Testing for `async` Server Components**:

> "Since `async` Server Components are new to the React ecosystem, some tools do not fully support them. In the meantime, we recommend using End-to-End Testing over Unit Testing for `async` components."

Source: https://nextjs.org/docs/app/guides/testing

### Server Actions testing
Server Actions are tested indirectly through the UI: Playwright clicks a button, submits a form, and asserts on the resulting DOM state or network response. There is no official mechanism to call Server Actions directly in Playwright — they are HTTP endpoints and the test goes through the page. A GitHub Discussion (vercel/next.js #67136) tracks intercepting/mocking Server Actions during E2E, but this is not officially supported.

### webServer configuration (official)
The official Next.js Playwright guide recommends using the `webServer` Playwright feature:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

The docs specifically note: "We recommend running your tests against your production code to more closely resemble how your application will behave." This means `next build && next start`, not `next dev`.

Source: https://nextjs.org/docs/pages/guides/testing/playwright

### Fixtures for auth state

Playwright's `storageState` fixture captures cookies + localStorage + IndexedDB after login and replays it for subsequent tests, avoiding re-login overhead (reportedly reduces auth test time by 60-80%):

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [async ({ browser }, use) => {
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);
    if (fs.existsSync(fileName)) { await use(fileName); return; }
    // ... perform login, save state
    await page.context().storageState({ path: fileName });
    await use(fileName);
  }, { scope: 'worker' }],
});
```

Source: Context7 / playwright.dev auth docs

### Fixtures for database seeding
The `globalSetup` hook runs once before all tests — the right place to seed the database, start ancillary services, or obtain auth tokens:

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
});

// global-setup.ts
export default async function globalSetup(config: FullConfig) {
  // seed database, start services
  // pass values via process.env for tests to read
}
```

Source: Context7 / playwright.dev global setup docs

### Setup complexity
- Low-to-medium. `pnpm create playwright` initializes config. The `webServer` array starts services automatically.
- Browsers must be installed in CI: `npx playwright install --with-deps`

### CI/CD
GitHub Actions matrix sharding is natively supported:

```yaml
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]
steps:
  - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
  - uses: actions/upload-artifact@v4
    with:
      name: blob-report-${{ matrix.shardIndex }}
      path: blob-report
```

Source: Context7 / playwright.dev CI sharding docs

### Tradeoffs
| Pro | Con |
|-----|-----|
| Tests Server Components by output (correct level of abstraction) | Cannot unit-test server-only logic |
| Covers full browser rendering, routing, hydration | Slow: requires build + running server |
| Auth state reuse across workers is well-supported | Browser binary download adds ~200-400MB CI overhead |
| Server Actions tested as real HTTP (most accurate) | Cannot intercept/mock Server Actions in tests |
| Official Next.js recommendation for async components | No way to test Server Component internals directly |

---

## 2. Vitest Browser Mode

### What it covers
Runs test files natively inside a real browser (via Playwright under the hood) rather than in Node.js + jsdom. Designed for **component-level testing** with real browser APIs, CSS layout, focus management, and event propagation.

### Configuration (official, from vitest-dev docs)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

Packages required: `@vitest/browser`, `@vitest/browser-playwright`

Source: Context7 / vitest-dev browser mode docs

### Mixed Node + Browser projects
Vitest supports running both Node tests and browser tests in the same config via `projects`:

```typescript
export default defineConfig({
  test: {
    projects: [
      { test: { include: ['tests/unit/**/*.test.ts'], name: 'unit', environment: 'node' } },
      { test: { include: ['tests/browser/**/*.test.ts'], name: 'browser', browser: { enabled: true, ... } } },
    ],
  },
});
```

Source: Context7 / vitest-dev browser mode docs

### Critical limitation for this project
Vitest browser mode **runs test files in the browser** — it does not start or know about a Next.js server. It is fundamentally a **component test tool**, not an integration or E2E tool. It cannot:

- Navigate to pages rendered by Next.js
- Test Server Components as integrated routes
- Test Server Actions through the actual HTTP layer
- Test WebSocket connections to the orchestrator

The vitest docs acknowledge this: "Playwright component tests run in a Node.js process and control the browser remotely. Vitest's browser mode runs tests natively in the browser... but it does have some limitations."

Source: Context7 / vitest comparisons docs

### What it is good for in this stack
Testing **shared UI components** from `packages/ui/` — shadcn components, custom inputs, etc. — in a real browser environment. This catches CSS layout bugs, focus management, and Radix UI behavior that jsdom cannot simulate.

### Setup complexity
Medium. Requires Vite-compatible component setup. Next.js App Router components (those using server-only imports, `use server`, `cookies()`, `headers()`) **cannot be tested in browser mode** without mocking all Next.js internals.

### CI/CD
Runs headless via Playwright; same browser binary requirement. Integrates with existing Vitest coverage pipeline.

### Tradeoffs
| Pro | Con |
|-----|-----|
| Real browser APIs, no jsdom limitations | Not applicable to Server Components |
| Catches CSS/layout bugs unit tests miss | Cannot test routing, navigation, or Next.js layers |
| Same DX as Vitest (watch mode, coverage) | Requires Vite config, separate from Next.js config |
| Good for packages/ui/ component library | No WebSocket or HTTP API coverage |
| Faster feedback than full Playwright E2E | Still slower than jsdom unit tests |

---

## 3. Testcontainers + PostgreSQL + Prisma

### What it covers
Spins up a real PostgreSQL Docker container per test suite (or globally), runs Prisma migrations against it, and provides a real DB for integration tests. The container is ephemeral — torn down after the suite.

### PostgreSQL module (official docs)

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const container = await new PostgreSqlContainer('postgres:15')
  .withDatabase('testdb')
  .withUsername('testuser')
  .withPassword('testpass')
  .start();

const connectionUri = container.getConnectionUri();
// postgres://testuser:testpass@localhost:RANDOM_PORT/testdb
```

Package: `@testcontainers/postgresql`

Source: https://node.testcontainers.org/modules/postgresql/

### Snapshot/restore for test isolation
The PostgreSQL module supports database snapshots — migrate once, snapshot, then restore between tests instead of re-running migrations:

```typescript
// After migrations run:
await container.snapshot('migrated_template');

// Before each test:
await container.restoreSnapshot('migrated_template');
```

Critical: Do NOT use the `postgres` system database as the container database when using snapshots.

Source: https://node.testcontainers.org/modules/postgresql/

### Integration with Prisma + Vitest (global setup pattern)

```typescript
// vitest.globalSetup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:15').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('npx prisma migrate deploy'); // run existing migrations
  await container.snapshot('after-migrations');
}

export async function teardown() {
  await container.stop();
}
```

Alternative per-suite isolation pattern (from douglasgoulart.com guide):

```typescript
// Creates a unique schema per test suite rather than a new container:
function generateDatabaseURL(schema: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schema);
  return url.toString();
}

// vitest environment setup:
export default {
  name: 'prisma',
  async setup() {
    const schema = randomUUID();
    process.env.DATABASE_URL = generateDatabaseURL(schema);
    execSync('npx prisma migrate deploy');
    return {
      async teardown() {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await prisma.$disconnect();
      }
    };
  }
};
```

Source: https://www.douglasgoulart.com/writings/creating-a-complete-nodejs-test-environment-with-vitest-postgresql-and-prisma

### Vitest config wire-up

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globalSetup: './vitest.globalSetup.ts',
  }
});
```

Source: Context7 / testcontainers-node global setup docs

### Setup complexity
Medium-high.
- Requires Docker available in the test environment (and in CI runners)
- Cold start: `postgres:15` pull + container start adds ~5-15 seconds on first run (cached after)
- Prisma migrations must be run inside the test setup
- `DATABASE_URL` must be propagated to Prisma client before it initializes

### CI/CD
- GitHub Actions runners have Docker available by default
- Container startup is the primary overhead; snapshot/restore makes per-test isolation fast
- Ryuk (testcontainers' resource cleanup daemon) ensures no orphaned containers even if tests crash
- `TESTCONTAINERS_RYUK_DISABLED=true` can be set if CI runner lacks Docker socket access (some restrictive environments)

### Tradeoffs
| Pro | Con |
|-----|-----|
| Real PostgreSQL — catches dialect-specific bugs | Requires Docker in all environments |
| Prisma migrations tested exactly as in production | ~5-15s cold start per test run |
| Snapshot/restore gives fast isolation between tests | More complex setup than SQLite mock |
| No mocking — full FK, constraint, index behavior | `DATABASE_URL` propagation requires care with Prisma singleton |
| Works with any test runner (Vitest, Jest) | Parallel test suites may compete for container resources |

---

## 4. WebSocket Testing in Playwright

### Two distinct patterns

**Pattern A: Observe real WebSocket traffic (full E2E)**

Playwright fires `page.on('websocket')` whenever the page opens a WebSocket. You can then listen to frames:

```typescript
test('receives pipeline:complete event after message', async ({ page }) => {
  const wsMessages: string[] = [];

  page.on('websocket', ws => {
    ws.on('framereceived', frame => {
      wsMessages.push(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString());
    });
  });

  await page.goto('/');
  // trigger an action that causes the orchestrator to fire pipeline:complete
  await page.fill('[data-testid="chat-input"]', 'hello');
  await page.keyboard.press('Enter');

  // wait for the pipeline:complete broadcast to arrive
  await page.waitForFunction(
    (msgs) => msgs.some(m => m.includes('pipeline:complete')),
    wsMessages,
    { timeout: 30_000 }
  );

  expect(wsMessages.some(m => m.includes('pipeline:complete'))).toBe(true);
});
```

Key APIs:
- `page.on('websocket', handler)` — fires on WebSocket creation
- `ws.on('framereceived', handler)` — captures frames arriving from server
- `ws.on('framesent', handler)` — captures frames sent from browser
- `ws.waitForEvent('framereceived', predicate, timeout)` — waits with a filter

**Pattern B: Mock/intercept WebSocket (unit-style E2E)**

`page.routeWebSocket(url, handler)` intercepts connections before they reach the real server. This is useful when the orchestrator is not running (isolated frontend tests):

```typescript
// Pure mock — no real server
await page.routeWebSocket('ws://localhost:3000/ws', ws => {
  ws.onMessage(message => {
    if (message === '{"type":"ping"}') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });
});

// Selective intercept — real server + modify specific messages
await page.routeWebSocket('wss://example.com/ws', ws => {
  const server = ws.connectToServer();
  ws.onMessage(message => {
    if (message === 'request') server.send('request2');
    else server.send(message);
  });
  // messages from server to page are auto-forwarded unless you call server.onMessage()
});
```

`ws.connectToServer()` returns a server-side `WebSocketRoute` — from that point, messages arriving from the real server are automatically forwarded to the page unless you install a handler.

Source: Playwright docs / WebSocketRoute API; Context7 playwright.dev mock docs

### For this project's architecture
The orchestrator broadcasts events like `pipeline:complete`, `pipeline:step`, `thread:name-updated` via `ctx.broadcast()` -> web plugin's `onBroadcast` -> WebSocket fan-out. Testing these end-to-end with Pattern A is the correct approach: start both services, trigger an action in the UI, wait for the WebSocket frame to arrive.

### Known limitation
`extraHTTPHeaders` does not work with WebSockets on Chromium. If WebSocket auth is done via headers (not cookies), Chromium-specific workarounds are needed. Firefox does not have this issue.

### Setup complexity
Low for observation (Pattern A) — just add a `page.on('websocket')` listener.
Medium for mocking (Pattern B) — requires knowing the exact WebSocket URL pattern.

### Tradeoffs
| Pro | Con |
|-----|-----|
| First-class API in Playwright, no extra packages | Chromium header bug affects WS auth via headers |
| Can test real broadcast events end-to-end | Timing-sensitive: must handle async message arrival |
| `routeWebSocket` enables isolated frontend WS tests | Mocking hides real server behavior |
| Bidirectional frame inspection | Frame payloads may be binary (need Buffer handling) |

---

## 5. Multi-Service Monorepo E2E Testing

### Turborepo-specific patterns

The official Turborepo Playwright guide (turborepo.dev/docs/guides/tools/playwright) recommends:

1. **One Playwright package per application** (not one global E2E package for the whole monorepo). For this repo: an `e2e/` package or `apps/e2e/` that depends on `web` and `orchestrator` builds.

2. **Task dependency graph** in `turbo.json`:

```json
{
  "tasks": {
    "e2e": {
      "dependsOn": ["^build"],
      "passThroughEnv": ["PLAYWRIGHT_*", "DATABASE_URL", "ORCHESTRATOR_URL"]
    }
  }
}
```

`dependsOn: ["^build"]` ensures all packages build before E2E runs. `passThroughEnv` exposes Playwright internal variables without busting cache.

3. **Use `--only` flag** when you want to run E2E without rebuilding: `turbo run e2e --only`.

Source: turborepo.dev/docs/guides/tools/playwright

### Starting multiple services with Playwright `webServer`

Playwright's `webServer` accepts an array, enabling orchestration of both the Next.js app and the Node.js orchestrator in one config:

```typescript
// playwright.config.ts
export default defineConfig({
  webServer: [
    {
      command: 'pnpm --filter web start',
      url: 'http://127.0.0.1:3000',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter orchestrator start',
      url: 'http://127.0.0.1:4000',  // orchestrator HTTP port
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: { baseURL: 'http://localhost:3000' },
  globalSetup: './global-setup.ts',  // seed DB, await readiness
});
```

Source: Context7 / playwright.dev multi-webServer release notes

### `globalSetup` for database + service coordination

```typescript
// global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

export default async function globalSetup() {
  // 1. Start database
  const container = await new PostgreSqlContainer('postgres:15').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  globalThis.__pg_container__ = container;

  // 2. Run migrations
  execSync('pnpm db:push', { env: process.env });

  // 3. Seed test data via Prisma
  execSync('pnpm db:seed', { env: process.env });
}

// global-teardown.ts
export default async function globalTeardown() {
  await globalThis.__pg_container__?.stop();
}
```

Playwright's `globalSetup` runs before any `webServer` processes are started. This means the database must be ready before the orchestrator starts.

**Note:** `webServer` processes receive environment variables from the parent process — `process.env.DATABASE_URL` set in `globalSetup` is inherited by child processes. Verify this works in your shell; some CI environments sanitize env between steps.

### CI/CD architecture

For a monorepo CI run:

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      # Alternative: use docker-compose or testcontainers (not GitHub services)
      # for DB, since testcontainers handles its own Docker lifecycle
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm build  # or turbo run build
      - run: npx playwright install --with-deps chromium
      - run: pnpm turbo run e2e
        env:
          CI: true
```

### Tradeoffs
| Pro | Con |
|-----|-----|
| `webServer` array handles multi-service startup automatically | Process startup order matters: DB -> orchestrator -> web |
| Turborepo caching can skip builds if source unchanged | Cold build on CI can be 3-5 min before first test runs |
| One `playwright.config.ts` controls the entire test environment | `globalSetup` DATABASE_URL propagation to child processes needs verification |
| Tests exercise the real inter-service communication path | Any service failure blocks all tests |
| Sharding distributes test load across CI workers | Sharded workers each need their own DB instance (or shared + careful isolation) |

---

## 6. Playwright Fixture Patterns

### Core fixture system
Fixtures are Playwright's DI mechanism for test setup. They replace `beforeEach`/`afterEach` boilerplate and compose cleanly:

```typescript
// test-fixtures.ts
import { test as base, expect } from '@playwright/test';
import { prisma } from 'database';

type TestFixtures = {
  authenticatedPage: Page;
  testThread: { id: string; name: string };
};

export const test = base.extend<TestFixtures>({
  // Page with auth cookies pre-loaded
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpass');
    await page.click('[type="submit"]');
    await page.waitForURL('/');
    await use(page);
  },

  // Database record created before test, deleted after
  testThread: async ({}, use) => {
    const thread = await prisma.thread.create({
      data: { name: 'Test Thread', kind: 'primary' }
    });
    await use({ id: thread.id, name: thread.name });
    await prisma.thread.delete({ where: { id: thread.id } });
  },
});

export { expect };
```

Usage:

```typescript
import { test, expect } from './test-fixtures';

test('can send a message', async ({ authenticatedPage, testThread }) => {
  await authenticatedPage.goto(`/chat/${testThread.id}`);
  // ...
});
```

### Worker-scoped vs test-scoped fixtures
- **`{ scope: 'worker' }`**: runs once per parallel worker process, shared across all tests in that worker. Use for expensive setup: DB seeding, login.
- **Default (test-scoped)**: runs once per test. Use for fixtures that must be clean per test: database records, page state.

### Auth fixture (worker-scoped, official pattern)
```typescript
workerStorageState: [async ({ browser }, use) => {
  const id = test.info().parallelIndex;
  const fileName = `.auth/${id}.json`;
  if (fs.existsSync(fileName)) { await use(fileName); return; }
  const page = await browser.newPage({ storageState: undefined });
  // ... perform login
  await page.context().storageState({ path: fileName });
  await page.close();
  await use(fileName);
}, { scope: 'worker' }],
```

Source: Context7 / playwright.dev auth docs

### MSW integration for API mocking
Playwright has a `router` fixture (experimental) that integrates with MSW handlers, useful when you want to mock the orchestrator's HTTP API but test the frontend:

```typescript
import { handlers } from '@src/mocks/handlers';

test.beforeEach(async ({ router }) => {
  await router.use(...handlers);
});
```

Source: Context7 / playwright.dev component testing docs

### Database seeding strategies
1. **Seed in `globalSetup`**: one-time seed for the entire test run. Fast, but tests share state.
2. **Seed in worker-scoped fixture**: once per worker, each worker gets its own seed data. Better isolation.
3. **Seed in test-scoped fixture + teardown**: maximum isolation, full cleanup after each test. Slowest.
4. **Use Testcontainers snapshot/restore**: seed once, snapshot, restore between tests. Best balance of speed and isolation.

### Tradeoffs
| Pro | Con |
|-----|-----|
| Fixtures compose: `authenticatedPage` can depend on `testThread` | Fixture teardown runs in reverse order — ordering matters |
| Worker-scoped fixtures dramatically reduce login overhead | Worker-scoped fixtures cannot share a single DB cleanly without schema-per-worker |
| `storageState` auth reuse is transparent to tests | Auth tokens expire — fixtures must handle refresh |
| Custom fixtures are just TypeScript — fully typed | API fixture for direct Prisma access introduces coupling to DB in E2E layer |

---

## Key Takeaways for This Project

1. **Primary E2E tool: Playwright.** The Next.js 16 recommendation for async Server Components is explicit. All App Router routes, Server Actions, and WebSocket events are testable through it.

2. **Testcontainers for database isolation.** The snapshot/restore capability is the most practical pattern: one container startup + migration, then fast restore between tests. This avoids re-running `prisma migrate deploy` per test.

3. **Vitest browser mode is not a replacement for Playwright here.** It covers `packages/ui/` component testing. It cannot test Next.js routes, Server Actions, or WebSocket connections to the orchestrator.

4. **Multi-service `webServer` array is the right wiring.** `playwright.config.ts` starts `web` and `orchestrator` as array entries. `globalSetup` starts the database first.

5. **WebSocket testing is native in Playwright.** `page.on('websocket')` captures all frames. For the orchestrator's `pipeline:complete` broadcast: trigger a chat action, wait on a `framereceived` predicate.

6. **Turborepo pattern: one E2E package per app.** Likely `apps/e2e/` with `dependsOn: ["^build"]` in `turbo.json`. Use `passThroughEnv` for Playwright variables.

7. **Auth fixtures use `storageState` at worker scope.** One login per parallel worker process, JSON file cached across test files.

8. **`DATABASE_URL` propagation is the key integration risk.** Testcontainers sets a random port; this must reach the orchestrator process started by `webServer`. One approach: write the URL to `.env.test` in `globalSetup` before `webServer` processes launch.

---

## Sources

- [Next.js 16 Testing Guide (official, 2026-02-27)](https://nextjs.org/docs/app/guides/testing)
- [Next.js Playwright Setup Guide (official, 2026-02-27)](https://nextjs.org/docs/pages/guides/testing/playwright)
- [Playwright Fixtures Documentation](https://playwright.dev/docs/test-fixtures)
- [Playwright Auth Documentation](https://playwright.dev/docs/auth)
- [Playwright WebSocket API](https://playwright.dev/docs/api/class-websocket)
- [Playwright WebSocketRoute API](https://playwright.dev/docs/api/class-websocketroute)
- [Playwright Network Documentation](https://playwright.dev/docs/network)
- [Playwright CI Documentation](https://playwright.dev/docs/ci)
- [Playwright Global Setup/Teardown](https://playwright.dev/docs/test-global-setup-teardown)
- [Turborepo Playwright Guide](https://turborepo.dev/docs/guides/tools/playwright)
- [Testcontainers Node.js PostgreSQL Module](https://node.testcontainers.org/modules/postgresql/)
- [Testcontainers Node.js Getting Started](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)
- [Vitest Browser Mode Documentation](https://vitest.dev/guide/browser/)
- [Vitest + PostgreSQL + Prisma guide](https://www.douglasgoulart.com/writings/creating-a-complete-nodejs-test-environment-with-vitest-postgresql-and-prisma)
- [Blazing fast Prisma + Postgres tests in Vitest (Codepunkt)](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/)
- [BrowserStack Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices)
- [Kyrre Gjerstad: E2E Testing Monorepo Setup](https://www.kyrre.dev/blog/end-to-end-testing-setup)
