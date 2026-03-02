# Integration Tests

End-to-end integration tests for Harness plugins. Each test boots a real orchestrator against a real PostgreSQL database (Docker testcontainer) with only the Claude invoker mocked.

## Prerequisites

- Docker running locally
- `pnpm install` run from repo root

## Running

```bash
# From repo root
pnpm --filter integration-tests test:integration

# Watch mode
pnpm --filter integration-tests test:integration:watch
```

Tests run sequentially (no file parallelism) and take ~30–60s on first run while Docker pulls the Postgres image. Subsequent runs are faster.

## Structure

```
tests/integration/
├── helpers/
│   └── create-harness.ts       # createTestHarness() factory — start here
├── setup/
│   ├── global-setup.ts         # Starts Postgres testcontainer, runs prisma db push
│   └── reset-db.ts             # Truncates all tables between tests
├── activity-plugin.test.ts
├── context-plugin.test.ts
├── delegation-plugin.test.ts
├── discord-plugin.test.ts
├── metrics-plugin.test.ts
├── time-plugin.test.ts
├── web-plugin.test.ts
├── vitest.config.ts
└── package.json
```

## How It Works

1. **Global setup** spins up a `postgres:16-alpine` Docker container and pushes the Prisma schema
2. Each test file calls `resetDatabase()` in `beforeEach` to truncate all tables
3. Each test calls `createTestHarness(plugin)` to get a fully booted orchestrator + PrismaClient
4. Tests invoke the pipeline via `harness.orchestrator.getContext().sendToThread(...)` and assert against the DB

## Plugin Coverage

| Plugin | Test file | Notes |
|--------|-----------|-------|
| activity | `activity-plugin.test.ts` | pipeline_start/step/complete, stream events |
| context | `context-plugin.test.ts` | history injection, context files |
| delegation | `delegation-plugin.test.ts` | /delegate command, task loop |
| discord | `discord-plugin.test.ts` | gateway lifecycle |
| metrics | `metrics-plugin.test.ts` | AgentRun token recording |
| time | `time-plugin.test.ts` | current_time tool, prompt replacement |
| web | `web-plugin.test.ts` | HTTP server, WebSocket broadcast |
| **validator** | **missing** | needs `validator-plugin.test.ts` |

## Adding a Test for a New Plugin

1. Add the plugin package to `devDependencies` in `package.json`
2. Create `{plugin-name}-plugin.test.ts` following the pattern in any existing test file
3. Use `createTestHarness(plugin)` and assert against `harness.prisma` or `harness.invoker.invoke`

See [CLAUDE.md](./CLAUDE.md) for detailed conventions and examples.
