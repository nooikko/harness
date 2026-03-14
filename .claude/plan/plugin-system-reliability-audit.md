# Plugin System Reliability Audit

## Objective

Comprehensive review of all 15 plugins to ensure they function correctly at runtime, with tests that validate true functionality — not just mocked behavior — so we are very confident no plugin will crash, fail, or poorly function during production execution.

## Current State Assessment

### What Passes Today
- **All 15 plugin unit test suites pass** (137 identity, 49 delegation, etc.)
- **40/41 Turbo tasks pass** — only failure is 7 web UI tests (admin layout, charts, model options — unrelated to plugins)
- **14 integration test files exist** (one per plugin, despite CLAUDE.md saying 6 are missing — stale docs)
- Integration test infrastructure is solid: Dockerized PostgreSQL via testcontainers, real orchestrator, mocked invoker only

### What's Concerning

#### A. Integration Tests — Quality Gaps
The integration tests exist for all 14 plugins, but many test only the **happy path** or **bare minimum registration**. Several plugins have critical runtime paths with zero integration coverage:

| Plugin | Integration Test Coverage | Missing Critical Paths |
|--------|-------------------------|----------------------|
| **discord** | Only tests "starts without token" (graceful degradation) | No test for message routing, reply delivery, P2002 retry, mention handling |
| **web** | Tests health endpoint + POST /api/chat + pipeline trigger | No WebSocket broadcast test, no /api/plugins/:name/reload test |
| **validator** | Tests exist but unclear if they exercise the full rubric→verdict→throw cycle | Need to verify last-iteration safety valve |
| **cron** | Tests one-shot past-due, lazy thread, disabled jobs | No recurring job test, no hot-reload test, no schedule_task MCP tool test |
| **metrics** | Tests exist | No test for unknown model fallback pricing, no test for missing fields silent skip |
| **context** | Tests exist | No test for sessionId short-circuit (history skip), no file reference injection test |
| **delegation** | Tests tool handler directly | No test for cost cap enforcement, no test for circuit breaker behavior |
| **time** | Tests exist | No test for regex lastIndex state bug (if it still exists) |
| **identity** | Tests soul injection + memory write + memoryEnabled=false | No bootstrap prompt test, no update_self tool test, no scoped memory retrieval test |

#### B. Single-Plugin Isolation Problem
`createTestHarness` registers **one plugin at a time**. This means we never test:
1. **Plugin interaction** — identity→context prompt chain ordering
2. **Full pipeline** — all 15 plugins registered simultaneously
3. **Hook ordering** — does identity actually run before context in the chain?

#### C. Fire-and-Forget Testing
Many plugins use `void (async () => { ... })()` for background work. Integration tests use `vi.waitFor` with timeouts to poll for results. This is correct but:
- Some tests use `setTimeout(resolve, 500)` or `setTimeout(resolve, 2000)` as "negative proof" — fragile on slow CI
- No timeout standardization — some use 5s, some 10s, some 20s

#### D. No Multi-Plugin Integration Test
There is no test that boots the full orchestrator with all plugins and sends a message through the complete pipeline. This is the single biggest gap — we can't prove the system works end-to-end.

#### E. Tool Server Coverage
MCP tools (delegate, checkin, schedule_task, update_self, get/set_project_memory, current_time) are tested via direct handler calls, not through the tool server's JSON Schema→Zod conversion path.

---

## Implementation Plan

### Task Type
- [x] Backend
- [ ] Frontend
- [ ] Fullstack

### Phase 1: Fix Existing Failures (quick wins)

**Step 1.1** — Fix the 7 failing web UI tests
These are unrelated to plugins but block `pnpm test` from going green. Fixes are likely trivial (model options array length, admin sidebar heading text, chart rendering).

- Expected deliverable: All 41 Turbo test tasks pass

**Step 1.2** — Update stale integration test CLAUDE.md
The file `tests/integration/CLAUDE.md` claims 6 plugins have missing integration tests, but all 14 exist. Update the coverage table.

- Expected deliverable: Accurate documentation

### Phase 2: Harden Existing Integration Tests

**Step 2.1** — Discord plugin: add message routing + reply delivery tests
- Test that incoming Discord message (simulated) routes to sendToThread
- Test that onBroadcast('pipeline:complete') triggers Discord reply
- Test P2002 race condition handling on thread upsert
- Test mention stripping from prompt

**Step 2.2** — Web plugin: add WebSocket broadcast + reload tests
- Test that ctx.broadcast() reaches WebSocket clients
- Test POST /api/plugins/:name/reload triggers onSettingsChange
- Test graceful shutdown (stop closes WS then HTTP)

**Step 2.3** — Cron plugin: add recurring job + hot-reload + MCP tool tests
- Test recurring job fires on schedule (use short cron expression like `* * * * * *` for seconds)
- Test onSettingsChange('cron') stops and restarts all jobs
- Test cron__schedule_task MCP tool creates job and triggers reload

**Step 2.4** — Context plugin: add sessionId short-circuit + file reference tests
- Test that when thread.sessionId exists, history is NOT injected
- Test that file references are ALWAYS injected regardless of session
- Test project instructions/memory injection

**Step 2.5** — Identity plugin: add bootstrap + update_self + scoped retrieval tests
- Test bootstrap prompt injection when AgentConfig.bootstrapped=false
- Test update_self MCP tool writes agent fields and sets bootstrapped=true
- Test scoped memory retrieval (AGENT vs PROJECT vs THREAD)

**Step 2.6** — Delegation plugin: add cost cap + circuit breaker tests
- Test that cost cap stops delegation loop when exceeded
- Test that logic error failures fast-fail (no retry)
- Test that transient errors get backoff+retry

**Step 2.7** — Validator plugin: add safety valve test
- Test that last iteration is always accepted (no rejection)
- Test that verdict parse failure auto-accepts

**Step 2.8** — Metrics plugin: add edge case tests
- Test unknown model falls back to Sonnet pricing
- Test missing model/tokens in InvokeResult = silent skip

**Step 2.9** — Time plugin: add regex state test
- Test that consecutive invocations correctly detect /current-time (no lastIndex flakiness)

### Phase 3: Multi-Plugin Integration Test (the big one)

**Step 3.1** — Create full-pipeline integration test
New file: `tests/integration/full-pipeline.test.ts`

This test boots the orchestrator with ALL plugins (minus discord and music — external deps) and sends a message through the complete pipeline. Validates:

1. Plugin registration order is maintained
2. onBeforeInvoke chain produces correct prompt (identity header → context history → time replacement)
3. onAfterInvoke fires for all plugins
4. onPipelineStart/Complete fire and activity records are written
5. Assistant text message is persisted
6. WebSocket broadcast fires pipeline:complete

**Step 3.2** — Create prompt chain ordering test
New test in `full-pipeline.test.ts` that asserts:
- Identity header appears before context history in final prompt
- Time plugin's /current-time replacement happens after identity+context
- Custom instructions appear in correct position

**Step 3.3** — Create concurrent message test
Test that two messages sent to different threads don't interfere with each other's pipeline execution.

### Phase 4: Plugin Startup/Shutdown Resilience

**Step 4.1** — Test graceful shutdown ordering
- Verify plugins stop in reverse registration order
- Verify cron jobs are cancelled before HTTP server closes
- Verify WebSocket connections close before server

**Step 4.2** — Test plugin failure isolation during startup
- Register a faulty plugin (throws in register)
- Verify other plugins still start successfully
- Verify orchestrator is functional with remaining plugins

**Step 4.3** — Test hook error isolation
- Register a plugin whose onBeforeInvoke throws
- Verify the chain continues with the previous prompt value
- Verify other hooks still fire

### Phase 5: Tool Server Path Tests

**Step 5.1** — Test JSON Schema → Zod conversion for each plugin tool
- Verify all tool schemas convert correctly
- Test that invalid tool inputs are rejected by Zod validation
- Test tool handler receives correctly typed input

### Phase 6: Documentation Cleanup

**Step 6.1** — Update tests/integration/CLAUDE.md coverage table
**Step 6.2** — Update root CLAUDE.md integration test count
**Step 6.3** — Document test running instructions for new contributors

---

### Key Files

| File | Operation | Description |
|------|-----------|-------------|
| tests/integration/discord-plugin.test.ts | Modify | Add message routing + reply delivery tests |
| tests/integration/web-plugin.test.ts | Modify | Add WebSocket broadcast + reload tests |
| tests/integration/cron-plugin.test.ts | Modify | Add recurring job + hot-reload tests |
| tests/integration/context-plugin.test.ts | Modify | Add sessionId short-circuit + file ref tests |
| tests/integration/identity-plugin.test.ts | Modify | Add bootstrap + update_self + scoped tests |
| tests/integration/delegation-plugin.test.ts | Modify | Add cost cap + circuit breaker tests |
| tests/integration/validator-plugin.test.ts | Modify | Add safety valve + parse failure tests |
| tests/integration/metrics-plugin.test.ts | Modify | Add edge case tests |
| tests/integration/time-plugin.test.ts | Modify | Add regex state test |
| tests/integration/full-pipeline.test.ts | Create | Multi-plugin integration test |
| tests/integration/helpers/create-harness.ts | Modify | Add multi-plugin variant |
| tests/integration/CLAUDE.md | Modify | Update coverage table |

### Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| WebSocket tests are flaky due to timing | Use `vi.waitFor` with generous timeouts; avoid raw setTimeout assertions |
| Discord tests require mocking Discord.js Client | Mock at module level (vi.mock('discord.js')); test message handler logic, not gateway |
| Cron recurring tests need fast schedules | Use croner's second-level expressions or mock time |
| Full-pipeline test is slow (many plugins) | Keep to 3-5 core scenarios; use larger timeout (30s) |
| Port conflicts in web plugin tests | Always use port: 0 (OS-assigned) for new tests |
| Integration tests need Docker | Already handled by testcontainers; CI has Docker; document in README |

### Priority Order

1. **Phase 3 (full-pipeline test)** — highest value, proves system works end-to-end
2. **Phase 2 (harden existing)** — fills coverage gaps in each plugin's critical paths
3. **Phase 4 (startup/shutdown)** — validates resilience under failure conditions
4. **Phase 1 (fix existing)** — quick wins, makes CI green
5. **Phase 5 (tool server)** — lower priority, tools work through direct handler calls already
6. **Phase 6 (docs)** — lowest priority, correctness matters more than docs

### Estimated Test Count

| Phase | New Tests | Modified Tests |
|-------|-----------|---------------|
| Phase 1 | 0 | 7 fixes |
| Phase 2 | ~25-30 | 0 |
| Phase 3 | ~8-12 | 0 |
| Phase 4 | ~5-8 | 0 |
| Phase 5 | ~5-8 | 0 |
| **Total** | **~43-58** | **7 fixes** |
