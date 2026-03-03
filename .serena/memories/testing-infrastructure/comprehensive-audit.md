# Testing Infrastructure Audit

## Summary
Harness has sophisticated unit and integration test coverage. The test suite uses Vitest with real database setup via testcontainers for integration tests. **No E2E tests exist yet** — there's a clear gap between integration tests (single plugin + real DB) and full system E2E (multiple plugins, HTTP, WebSocket, real user flows).

## Test Coverage Overview

### Line Counts (3 key test files)
- `apps/orchestrator/src/__tests__/index.test.ts`: 970 lines (boot sequence, lifecycle, error handling)
- `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts`: 283 lines (invoker, pool, timeout)
- `packages/plugins/web/src/__tests__/index.test.ts`: 129 lines (plugin registration + lifecycle)
- **Total for these 3**: 1,382 lines

### Test File Count
- **130+ test files** across entire monorepo
- 8 integration tests (located in `tests/integration/`): activity, context, delegation, discord, metrics, time, validator, web
- Hundreds of unit tests in `_helpers/__tests__/` directories

### Test Framework
- **Runner**: Vitest
- **Database for integration tests**: PostgreSQL via testcontainers (Docker required)
- **Mocking library**: Vitest's `vi` (Sinon-compatible)

---

## What's Well-Tested

### 1. Boot Sequence & Lifecycle (970 lines in `apps/orchestrator/src/__tests__/index.test.ts`)

**Tested:**
- Logger creation with harness prefix
- Config loading before DB connection
- Database connection/disconnection
- SDK invoker creation with correct params (model, timeout)
- Plugin loading via registry
- Plugin validation via loader
- Tool collection from plugins + MCP server creation
- Late-binding of orchestrator context to tool context ref
- Orphaned task recovery
- Plugin registration and start order
- Delegation hook resolver wiring (before plugins start)
- Signal handlers (SIGTERM, SIGINT)
- Graceful shutdown (orchestrator.stop(), DB disconnect, health check stop, invoker.stop())
- Shutdown idempotency (double signal doesn't call stop twice)
- Main function error handling

**Coverage style**: Heavy use of mocks for external dependencies (logger, Prisma, invoker, plugin registry). Tests verify call order, arguments, and state transitions.

### 2. Invoker/SDK Session Management (283 lines in `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts`)

**Tested:**
- Session pool creation with correct config (5 max, 480s TTL)
- Session config (MCP server factory) passed to pool
- Default model from config
- Model override via options
- SessionId/threadId as pool key (threadId takes precedence)
- Successful invocation with extracted result
- Send failure → session eviction
- Timeout errors → session eviction
- Timeout override via options
- Fake timer scenario (stuck session)
- onMessage callback forwarding
- Prewarm (creates session without invoking)
- Prewarm + invoke pool key consistency
- Stop → closeAll call

**Coverage style**: Mocked session pool and extract-result. Tests verify pool behavior under success/failure/timeout conditions.

### 3. Activity Plugin Integration (118 lines in `tests/integration/activity-plugin.test.ts`)

**Tested (via real orchestrator + real DB):**
- pipeline_start status message written
- pipeline_step messages written (onMessage, onBeforeInvoke, invoking, onAfterInvoke)
- pipeline_complete status message written
- Thinking stream event written to DB when emitted by invoker

**Key observation**: Tests call `sendToThread` (not `handleMessage`) explicitly because onPipelineStart/onPipelineComplete only fire from sendToThread.

### 4. Delegation Plugin Integration (122 lines in `tests/integration/delegation-plugin.test.ts`)

**Tested (via real orchestrator + real DB):**
- OrchestratorTask creation when delegate tool called
- Task thread creation as child of parent
- Task thread linked to OrchestratorTask
- Empty prompt validation → returns error, no task created
- Text output doesn't create tasks (no auto-parsing of /commands)

### 5. Context Plugin (100+ lines in unit tests)

**Tested:**
- File discovery + priority ordering (memory.md, world-state.md, thread-summaries.md, inbox.md, then alphabetical)
- File caching with 5-second TTL and mtime-based invalidation
- 50KB file truncation
- Empty file skipping
- Session resumption short-circuit (if thread.sessionId exists, skip history)
- History depth (last 50 messages)
- DB failure handling (log warning, continue)
- Prompt assembly order (context → history → original prompt)

### 6. Web Plugin Routes (200+ lines in `packages/plugins/web/src/_helpers/__tests__/routes.test.ts`)

**Tested:**
- GET /api/health returns ok status + timestamp
- POST /api/chat sends message + returns success
- Content whitespace trimming
- Missing/invalid threadId → 400
- Missing/invalid content → 400
- onChatMessage throws → 500
- Various other GET/POST endpoints

**Coverage style**: Real HTTP server (port 0 for OS assignment) + real fetch calls. Mocks are only the PluginContext dependencies (db, invoker, logger).

### 7. WebSocket Broadcaster (100+ lines in `packages/plugins/web/src/_helpers/__tests__/ws-broadcaster.test.ts`)

**Tested:**
- Connection acceptance
- Multiple connected clients
- Broadcast to all clients
- Client error isolation (one bad client doesn't break others)
- Per-client send failure
- Connection close handling

**Coverage style**: Real HTTP server + real WebSocket with `ws` npm package. Tests connect actual clients and verify message delivery.

---

## What's Untested

### 1. **No End-to-End (E2E) Tests**

**Gap**: No tests that:
- Send a message from web → HTTP → orchestrator → plugin pipeline → invoke Claude → response → persist → broadcast WebSocket back to web
- Test full delegation loop with real sub-agent + parent notification
- Test cron job trigger → pipeline → output + broadcast
- Test Discord message → orchestrator → response → Discord send
- Test context file injection + history + prompt assembly with real files
- Test multiple plugins working together (e.g., activity + context + delegation)

### 2. **Orchestrator.handleMessage not directly tested**

The `handleMessage` function itself (the 8-step pipeline) is not tested in isolation. Tests either:
- Mock all dependencies (boot tests)
- Call sendToThread instead (integration tests) — which adds onPipelineStart/Complete

No tests verify:
- onBeforeInvoke chain hook behavior (each plugin modifying prompt sequentially)
- onAfterInvoke hook firing with correct result data
- Stream events captured and returned
- Pipeline step recording in correct order

### 3. **Missing integration tests for 6 plugins**

No integration test files exist for: identity, cron, auto-namer, audit, summarization, project. Discord, validator, and all others now have integration tests.

### 6. **Cross-plugin interaction**

No tests verify:
- Context plugin's context files are injected before identity plugin's soul
- Activity plugin persists records in correct order with pipeline steps
- Metrics plugin records tokens from invoker result
- Delegation loop fires onTaskCreate → onTaskComplete → onTaskFailed hooks correctly

### 7. **Server shutdown edge cases**

Tested are basic cases, but not:
- Shutdown during active message processing
- Shutdown with pending delegation tasks
- Shutdown with WebSocket clients connected

### 8. **Error propagation and recovery**

Some error paths are tested, but not:
- Plugin register() throws → boot continues but plugin unavailable
- Plugin start() throws → boot fails
- onBeforeInvoke hook throws → pipeline continues with unmodified prompt?
- DB transaction failures during task setup in delegation

---

## Testing Patterns & Infrastructure

### Mock/Context Creation Factories

**Pattern: `make*` or `create*MockContext` functions**

Examples:
```typescript
// apps/orchestrator/__tests__/index.test.ts
const makeLogger = (): Logger => ({...})
const makeConfig = (): OrchestratorConfig => ({...})
const makeOrchestrator = (): MockOrchestrator => ({...})
const makeInvoker = (): MockInvoker => ({...})

// packages/plugins/activity/__tests__/index.test.ts
const makeCtx = (): PluginContext => ({...})
const makeInvokeResult = (overrides): InvokeResult => ({...})
```

**Why this works**: Consistent, reusable, configurable via parameters. Tests read top-to-bottom without understanding mock internals.

### Integration Test Harness (`tests/integration/helpers/create-harness.ts`)

**Factory function: `createTestHarness(plugin, opts?)`**

Returns:
- Real orchestrator instance
- Real PrismaClient pointed at testcontainer DB
- Mock invoker (Vitest fn, configurable output)
- Pre-created test thread ID
- Cleanup function (orchestrator.stop + prisma disconnect)

**Opts:**
- `invokerOutput`: mock Claude output
- `invokerModel`: model name (default: haiku)
- `invokerTokens`: input/output token counts
- `port`: for web plugin tests (default: 0)

**Key insight**: Factory abstracts away boilerplate (DB connect, thread creation, invoker mock setup). Tests focus on behavior verification, not setup.

### Database Reset (`tests/integration/setup/reset-db.ts`)

Runs in `beforeEach`:
```sql
TRUNCATE TABLE
  "Message", "OrchestratorTask", "AgentRun", "CronJob", "Metric",
  "PluginConfig", "AgentMemory", "AgentConfig", "ThreadAudit",
  "Agent", "Project", "Thread"
RESTART IDENTITY CASCADE
```

**Key constraint**: Tests run **sequentially, not in parallel** (`fileParallelism: false` in vitest config). This is because all tests share the same testcontainer DB.

### Global Setup (`tests/integration/setup/global-setup.ts`)

Runs once before suite:
1. Starts PostgreSqlContainer (Docker)
2. Sets `process.env.TEST_DATABASE_URL`
3. Pushes Prisma schema with `prisma db push`

All tests then use that `TEST_DATABASE_URL` env var.

### Real HTTP/WebSocket Testing

**Routes test** (`packages/plugins/web/src/_helpers/__tests__/routes.test.ts`):
- Creates real HTTP server (port 0)
- Uses real `fetch()` API (not mocked)
- Validates status codes + JSON response bodies

**WebSocket broadcaster test** (`packages/plugins/web/src/_helpers/__tests__/ws-broadcaster.test.ts`):
- Creates real HTTP server + WebSocket server
- Uses real `ws` npm package client
- Connects actual clients + tests message delivery
- Tests client error isolation

---

## How Mocking is Handled

### Database (Prisma)

**Unit tests**: Mock entire DB
```typescript
db: {
  message: { create: vi.fn().mockResolvedValue({}) },
  thread: { findUnique: vi.fn().mockResolvedValue({...}) },
} as unknown as PluginContext['db']
```

**Integration tests**: Real Prisma client against testcontainer

### Claude Invocation (Invoker)

**Unit tests**: Mock `invoker.invoke`
```typescript
invoker: {
  invoke: vi.fn().mockResolvedValue({
    output: 'result',
    durationMs: 100,
    exitCode: 0,
    model: 'haiku',
    inputTokens: 100,
    outputTokens: 50,
  })
}
```

**Integration tests**: Mock `invoker.invoke`, but real orchestrator uses it:
```typescript
harness.invoker.invoke.mockImplementation(async (_prompt, opts) => {
  // Optionally simulate stream events via onMessage callback
  opts?.onMessage?.({ type: 'thinking', content: '...', timestamp: Date.now() });
  return { output: 'done', ... };
});
```

### Plugins

**Unit tests of plugin logic**: Mock PluginContext
```typescript
const ctx: PluginContext = {
  db: {...mocked...},
  invoker: {...mocked...},
  logger: {...mocked...},
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
  getSettings: vi.fn(),
  notifySettingsChange: vi.fn(),
};
```

**Integration tests**: Real plugin loaded into real orchestrator, but invoker still mocked.

### Clock (Timers)

Used in invoker timeout tests:
```typescript
vi.useFakeTimers();
// ... set up stuck invoke
await vi.advanceTimersByTimeAsync(5000);
// ... verify timeout
vi.useRealTimers();
```

---

## Key Testing Insights

### 1. sendToThread vs handleMessage

**sendToThread** (integration tests use this):
- Fires `onPipelineStart` before pipeline
- Calls `handleMessage` (the 8-step pipeline)
- Fires `onPipelineComplete` after pipeline
- Persists assistant message
- Fires `pipeline:complete` broadcast

**handleMessage** (orchestrator internal):
- The 8-step pipeline itself
- No outer lifecycle hooks

Tests for plugin hooks (onBeforeInvoke, onAfterInvoke, etc.) should use `sendToThread`.

### 2. Fire-and-Forget Pattern

Plugins like summarization, auto-namer, and audit spawn async work without awaiting:
```typescript
void (async () => {
  try { 
    await expensiveWork(...);
  } catch (err) {
    ctx.logger.warn('...', err);
  }
})();
```

Tests verify this via:
- `vi.waitFor(() => expect(dbCall).toHaveBeenCalled())` — polls until async work completes
- Mocking the DB to track calls

### 3. Duplicate Guard Pattern

Background work that must not run twice uses recency checks:
```typescript
const recent = await ctx.db.someTable.findFirst({
  where: { threadId, createdAt: { gte: new Date(Date.now() - 60_000) } }
});
if (recent) return;
```

Tests verify this by calling the hook twice and asserting only one DB write.

### 4. Error Suppression

Plugin hooks are error-suppressed:
```typescript
try {
  await dbWrite(...);
} catch (err) {
  ctx.logger.error('...', { error: String(err) });
  // No throw — pipeline continues
}
```

Tests verify this via:
```typescript
vi.mocked(ctx.db.message.create).mockRejectedValueOnce(new Error('DB down'));
await expect(hook.onPipelineStart('thread-1')).resolves.toBeUndefined();
expect(ctx.logger.error).toHaveBeenCalled();
```

---

## Reusable Test Infrastructure for E2E

### What exists and can be reused:

1. **TestHarness factory** (`tests/integration/helpers/create-harness.ts`)
   - Can extend to load multiple plugins instead of one
   - Already handles orchestrator boot + plugin registration

2. **Database reset** (`tests/integration/setup/reset-db.ts`)
   - Can add more tables if schema changes
   - Already handles CASCADE

3. **Real HTTP/WebSocket testing**
   - Routes test already uses real HTTP server + fetch
   - WebSocket test already uses real `ws` client
   - Could be extended to HTTP + WebSocket in same test

4. **Mock invoker with stream events**
   - Activity plugin integration test already simulates thinking events via onMessage callback
   - Could be extended to tool_call events

### What needs to be built for E2E:

1. **Multi-plugin test harness**
   - Load multiple plugins (activity + context + delegation, etc.)
   - Verify inter-plugin ordering and data flow

2. **HTTP client + WebSocket listener**
   - Send HTTP POST /api/chat
   - Listen for pipeline:complete via WebSocket
   - Verify full round-trip

3. **Delegation E2E test**
   - Parent thread calls delegation__delegate
   - Delegation loop spawns sub-agent
   - Sub-agent returns output
   - Validation hook fires
   - Parent thread gets notification
   - Verify all DB records created in correct order

4. **Cron E2E test**
   - Trigger cron job (or manually call cron handler)
   - Verify sendToThread called with cron prompt
   - Verify cron thread kind message persisted
   - Verify next run time updated

5. **File-based context test**
   - Create context/ directory with real files
   - Send message through orchestrator
   - Verify context files injected in correct order
   - Verify history injected after context

---

## Test Statistics

- **Total test files**: 130+
- **Integration tests**: 8 (activity, context, delegation, discord, metrics, time, validator, web); 6 missing (identity, cron, auto-namer, audit, summarization, project)
- **Unit test coverage**: Helper functions heavily tested (80%+ coverage typical)
- **Lines of test code**: 1,382+ in boot + invoker + web plugin tests alone
- **Database used**: PostgreSQL 16 via testcontainers
- **Mocking library**: Vitest's `vi` (Sinon API compatible)
- **Parallelism**: Integration tests run sequentially (shared DB); unit tests run parallel within files

---

## Conclusion

**Strengths:**
1. Comprehensive unit test coverage with consistent mock factories
2. Real database integration tests with proper setup/teardown
3. Real HTTP/WebSocket testing for network-facing components
4. Clear separation of concerns (boot, invoker, plugins)
5. Plugin isolation via mock PluginContext

**Gaps:**
1. No E2E tests covering full message flow (HTTP → orchestrator → Claude → response → WebSocket)
2. No multi-plugin interaction tests
3. Missing integration tests for 6 plugins: identity, cron, auto-namer, audit, summarization, project
4. No orchestrator.handleMessage pipeline tests (8-step chain)
5. No cross-plugin hook ordering verification

**Opportunities for E2E:**
- Extend TestHarness to load multiple plugins
- Add HTTP client + WebSocket listener to integration tests
- Create delegation E2E test (full loop with validation)
- Create cron E2E test (job trigger → sendToThread → persistence)
- Create context file injection test (real files, real discovery, real history)
