# Integration Tests

## What they are

The integration test suite at `tests/integration/` tests the entire orchestrator pipeline end-to-end — from plugin registration through the 8-step `handleMessage` pipeline to verified database side-effects — without a browser, without a running Claude process, and without network calls to Anthropic.

Each test file covers one plugin: it spins up a real orchestrator wired to a real PostgreSQL database, registers the plugin under test, fires messages through the pipeline, and asserts concrete outcomes (DB rows written, invoker called, HTTP responses, prompt content).

These tests sit at the boundary between unit tests (too isolated to catch integration bugs) and true end-to-end tests (too slow and fragile for CI). They are the appropriate layer for verifying that plugins interact correctly with the orchestrator lifecycle, the Prisma schema, and each other's data.

---

## Why they exist

The orchestrator's plugin system has several subtle correctness properties that unit tests cannot verify:

- **Hook execution order matters.** `onBeforeInvoke` runs as a chain — each plugin receives the previous plugin's output. A unit test can verify the chain function exists; only an integration test can verify that context history is injected before the time plugin rewrites timestamps.
- **DB schema must match runtime expectations.** Prisma types are generated at build time. An integration test catches mismatches between what a plugin writes and what the schema actually accepts.
- **sendToThread vs handleMessage semantics.** `onPipelineStart`/`onPipelineComplete` fire only from `sendToThread`. Unit tests for the activity plugin would pass vacuously if they called `handleMessage` instead.
- **Fire-and-forget race conditions.** The web plugin's HTTP handler returns immediately and runs the pipeline asynchronously. A test that checks DB state without waiting for the pipeline to settle will flake non-deterministically on CI.

---

## Architecture

### Package structure

```
tests/
  integration/
    helpers/
      create-harness.ts          # Factory: real orchestrator + real Prisma + mock invoker
    setup/
      reset-db.ts                # Truncates all tables between tests
    activity-plugin.test.ts
    context-plugin.test.ts
    delegation-plugin.test.ts
    discord-plugin.test.ts
    metrics-plugin.test.ts
    time-plugin.test.ts
    web-plugin.test.ts
```

The `tests/` directory is a separate package at the root of the monorepo. It intentionally sits at the **top of the dependency graph** — it can import from any package without creating circular dependencies.

### Real database (Testcontainers)

The Vitest global setup at `tests/integration/setup/global-setup.ts` uses `@testcontainers/postgresql` to start a real PostgreSQL container before any test file runs. The container's connection string is written to `process.env.TEST_DATABASE_URL`. Prisma schema is applied via `prisma db push --skip-generate` against this URL. The container is destroyed after all tests complete.

Because all test files share one container, `vitest.config.ts` sets `fileParallelism: false` — test files run sequentially to avoid table-level conflicts during `reset-db`.

### createTestHarness

`tests/integration/helpers/create-harness.ts` is the primary factory. It:

1. Creates a fresh `PrismaClient` connected to `TEST_DATABASE_URL`
2. Creates a `vi.fn()` mock for `invoker.invoke` (default: returns a minimal success result)
3. Builds a real `Orchestrator` instance via `createOrchestrator()`
4. Calls `orchestrator.registerPlugin(plugin)` and `orchestrator.start()`
5. Creates a test `Thread` row in the database
6. Returns `{ orchestrator, prisma, invoker, threadId, cleanup }`

`cleanup()` calls `orchestrator.stop()` then `prisma.$disconnect()`. The `afterEach` in every test file calls `harness?.cleanup()`.

The invoker mock is what separates integration tests from full end-to-end tests: Claude is never actually called. Plugin behavior (what DB rows are written, what the prompt looks like, whether commands fire) is fully exercisable without a real API key.

---

## Per-plugin coverage

### `metrics-plugin.test.ts`

Registers the metrics plugin, triggers `handleMessage`, and asserts that exactly four `Metric` rows are written for `token.input`, `token.output`, `token.total`, and `token.cost`. Also verifies that no rows are written when `model` or token counts are absent from the invoke result.

**What this catches:** The metrics plugin's `onAfterInvoke` hook reading from `InvokeResult` fields correctly; the `Metric` table schema matching the write path.

### `time-plugin.test.ts`

Calls `handleMessage` with a prompt containing `/current-time` and asserts the invoker receives a prompt with the token replaced by an ISO-formatted timestamp (`[Current time: YYYY-MM-DD...]`). Also verifies pass-through when no token is present, and the standalone `/current-time` rewrite path.

**What this catches:** The time plugin's `onBeforeInvoke` chain hook executing and returning the modified prompt to the orchestrator; the ISO date format being present (not just any four digits).

### `context-plugin.test.ts`

Five tests covering:
1. **History injection** — seeds DB messages, asserts they appear in the prompt
2. **Session short-circuit** — sets `thread.sessionId`, asserts history is NOT injected
3. **User prompt preserved** — asserts the original message appears in the final prompt
4. **Empty history** — asserts no `Conversation History` header when there are no prior messages
5. **Context file injection** — creates a real `.md` file on disk, asserts its content appears in the prompt (exercises the `readContextFiles → formatContextSection` code path)

**What this catches:** The history injection short-circuit logic; the `onBeforeInvoke` chain returning the assembled prompt; the file-based context injection reading from disk at invoke time.

### `delegation-plugin.test.ts`

Three tests:
1. Fires a message whose invoke mock returns `/delegate Research ancient Rome`. Asserts that an `OrchestratorTask` row and a child `Thread` of kind `task` are written to the DB.
2. `/delegate` with empty prompt — asserts no task row created.
3. Unknown command `/unknown-command` — asserts no task row created.

**What this catches:** The delegation plugin's `onCommand` hook receiving the parsed command; the delegation loop creating the task thread; empty prompt and unknown command guard clauses.

### `activity-plugin.test.ts`

Four tests asserting DB rows written by the activity plugin's pipeline lifecycle hooks:
1. `pipeline_start` status message exists after pipeline runs
2. Pipeline step messages (`onMessage`, `onBeforeInvoke`, `invoking`, `onAfterInvoke`) exist
3. `pipeline_complete` status message exists
4. `thinking` stream event persisted when the invoker emits a thinking event

> **Important:** These tests call `harness.orchestrator.getContext().sendToThread()`, not `handleMessage()` directly. `onPipelineStart` and `onPipelineComplete` fire only from `sendToThread` — the outer envelope around the 8-step pipeline. Switching to `handleMessage` would cause all four tests to pass vacuously (no DB rows written, but no assertion fails).

**What this catches:** The activity plugin's pipeline hooks executing; the `Message.kind` and `Message.source` fields being written correctly; stream event passthrough from `invoker.invoke` to the persistence layer.

### `web-plugin.test.ts`

Three tests against a live Express server:
1. `GET /api/health` returns `{ status: 'ok' }`
2. `POST /api/chat` returns `{ success: true }` and (after `vi.waitFor`) the invoker has been called once
3. `POST /api/chat` triggers the full pipeline asynchronously

Each test uses a distinct hardcoded port (14500–14502) to avoid conflicts. The `vi.waitFor` in test 2 is necessary because the web plugin returns HTTP 200 immediately and runs the pipeline as a fire-and-forget; without waiting, `cleanup()` can race with an in-flight `prisma` call and produce `Client already disconnected` errors on slow CI.

**What this catches:** The HTTP server starting correctly; the `onChatMessage` → `sendToThread` bridge wiring; the async pipeline triggering from an HTTP request.

### `discord-plugin.test.ts`

One test: the discord plugin registers and starts without throwing when `DISCORD_TOKEN` is absent. The plugin is expected to log a warning and skip the gateway connection — the test verifies this graceful degradation path through the full `registerPlugin → start` lifecycle.

**What this catches:** The plugin startup path not throwing when optional config is missing; regressions in graceful degradation that would break the entire orchestrator boot sequence (all plugins register at startup regardless of individual plugin config).

---

## Running the tests

```bash
# Run only integration tests
pnpm --filter integration-tests test

# Run all tests (unit + integration)
pnpm test

# Watch mode (integration tests)
pnpm --filter integration-tests test:watch
```

The first run will pull the PostgreSQL Docker image (~200 MB). Subsequent runs reuse the image layer and start in a few seconds.

**Requirements:** Docker must be running. The `TEST_DATABASE_URL` env var is set automatically by the Testcontainers global setup — you do not need to configure it manually.

---

## Known limitations

- **No real Claude invocations.** The invoker is always mocked. Tests verify that the pipeline calls the invoker with the right prompt and handles the response correctly, but they do not verify actual Claude behavior.
- **No Discord gateway.** The discord plugin's gateway connection is never exercised — only the no-token startup path is tested.
- **Sequential file execution.** `fileParallelism: false` means the full integration suite is inherently serial. Individual tests within a file run in parallel by default (controlled by `describe` and `it` concurrency settings).
- **Port reservation.** Web plugin tests use hardcoded ports 14500–14502. These ports must be free when the tests run.
