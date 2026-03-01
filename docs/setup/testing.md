# Testing

How to run the test suite, what each layer tests, and how the pre-commit gates work.

---

## Test Layers

| Layer | Location | Tool | What it tests |
|-------|----------|------|---------------|
| Unit tests | `packages/*/src/**/__tests__/` and `apps/*/src/**/__tests__/` | Vitest | Individual functions and components in isolation |
| Integration tests | `tests/integration/` | Vitest + Testcontainers | Plugins wired to a real PostgreSQL database |

---

## Running Unit Tests

```bash
# Run all unit tests across every workspace package
pnpm test

# Watch mode (re-runs on file save)
pnpm test:watch

# Run tests for a single package
pnpm --filter web test
pnpm --filter orchestrator test
pnpm --filter ui test
pnpm --filter @harness/plugin-activity test
```

Unit tests run in parallel across packages via Turborepo. Each package has its own `vitest.config.ts`.

---

## Running Integration Tests

**Requirement: Docker must be running.** Integration tests use [Testcontainers](https://testcontainers.com) to spin up a real PostgreSQL 17 container. The container is created automatically — you do not need to start it manually.

```bash
# Run only integration tests
pnpm --filter integration-tests test:integration

# Run all tests including integration
pnpm test:integration

# Watch mode
pnpm --filter integration-tests test:integration:watch
```

The first run will pull the `postgres:17-alpine` Docker image (~85 MB). Subsequent runs reuse the cached layer.

### What integration tests do

Each test file covers one plugin. The `createTestHarness` factory at `tests/integration/helpers/create-harness.ts`:

1. Starts a real `PrismaClient` pointed at the Testcontainers database
2. Creates a mock `invoker.invoke` function (Claude is never called)
3. Boots a real `Orchestrator` instance and registers the plugin under test
4. Creates a test `Thread` row in the database
5. Returns `{ orchestrator, prisma, invoker, threadId, cleanup }`

Because Claude is mocked, integration tests are fast and require no API key. They verify that plugins interact correctly with the Prisma schema, the orchestrator lifecycle, and each other's hook execution order.

For a detailed breakdown of what each plugin's test suite covers, see [../integration-tests.md](../integration-tests.md).

### Timeouts and parallelism

- Test timeout: **90 seconds** per test
- Hook timeout: **90 seconds**
- File parallelism: **disabled** — test files run sequentially. All files share one PostgreSQL container; parallel execution would cause table conflicts during `resetDatabase`.

Individual tests within a file run in Vitest's default parallel mode.

### Port requirements

The web plugin integration tests use hardcoded ports **14500–14502**. These ports must be free when the tests run.

---

## Coverage Gate

The pre-commit hook runs a coverage gate before allowing any commit. It enforces two rules:

### 1. No barrel files

A barrel file is a file that only re-exports from other files (`export * from './foo'`). These are rejected unconditionally because they inflate apparent coverage and create implicit coupling between modules.

### 2. 80% line and branch coverage

On all staged `.ts` and `.tsx` files (and their direct dependencies). Coverage is measured per-file, not as a project aggregate.

**Excluded from coverage:** `*.config.ts`, `*.setup.ts`, `*.d.ts`, `*.test.ts`, `*.spec.ts`, generated files (`prisma/generated/**`, `.next/**`, `dist/**`).

### Running the coverage gate manually

```bash
# Full gate: barrel check + coverage
pnpm test:coverage-gate

# Barrel check only (fast, no test run)
pnpm test:coverage-gate --skip-coverage
```

The gate only checks files that are staged for the current commit. It does not re-check files that have not changed.

---

## Pre-Commit Hooks

Husky + lint-staged run the following checks on every `git commit`:

| Check | What it validates |
|-------|------------------|
| `biome check --write` | Formats and lints staged `.js/.jsx/.ts/.tsx/.json/.css` files |
| `sherif` | Validates that workspace `package.json` dependencies are sorted alphabetically and version specs are consistent across packages |
| `pnpm test:coverage-gate` | Barrel check + 80% coverage on staged files |

### Pre-push hooks

On every `git push`:

| Check | Command |
|-------|---------|
| TypeScript typecheck | `pnpm typecheck` (full monorepo) |
| Lint | `pnpm lint` (full monorepo) |

### Bypassing hooks

The `--no-verify` flag is blocked by a Claude Code hook. Fix the underlying issue rather than bypassing validation.

---

## Writing Tests

### File placement

Tests live in `__tests__/` subdirectories beside the code they test — never alongside source files directly.

```
src/
  _helpers/
    my-helper.ts
    __tests__/
      my-helper.test.ts   ← tests for my-helper.ts
  __tests__/
    index.test.ts         ← tests for index.ts
```

### What to test in unit vs integration

Write a **unit test** when:
- The function's correctness depends only on its own logic and injected dependencies
- You can mock all external state (DB, HTTP, filesystem) without loss of fidelity

Write an **integration test** when:
- Correctness depends on a real Prisma schema (e.g. a plugin that writes DB rows)
- You need to verify hook execution order across multiple plugins
- You are testing a fire-and-forget flow where timing matters

### Mocking the database in unit tests

Most unit tests pass a mocked `PrismaClient` using Vitest's `vi.fn()` or a hand-rolled object. See existing orchestrator tests for patterns.

### Mocking the invoker

The `invoker.invoke` mock returns a minimal `InvokeResult` by default:

```typescript
const invoker = {
  invoke: vi.fn().mockResolvedValue({
    output: 'mock response',
    sessionId: 'test-session',
    model: 'claude-sonnet-4-5',
    inputTokens: 100,
    outputTokens: 50,
    durationMs: 500,
    streamEvents: [],
  }),
};
```

Override the return value per-test to simulate different Claude responses.
