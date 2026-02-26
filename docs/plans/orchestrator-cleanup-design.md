# Orchestrator Cleanup & Integration Design

## Problem

After implementing the plugin tool registration system (MCP tools, hooks, plugin contract), several orchestrator modules are now dead code or disconnected. The codebase has accumulated superseded implementations that need to be removed, and useful-but-disconnected modules need to be wired into the live pipeline.

## Philosophy

The orchestrator handles core concerns: receiving messages, invoking Claude, persisting results. Hooks expose extension points so plugins can modify behavior at defined pipeline stages. Plugins don't replace core functionality — they extend it.

- **MCP tools** = how the AI invokes commands (structured, discoverable)
- **Slash commands** (`/delegate`) = how the human forces commands (fallback override)
- **[COMMAND] blocks** = superseded by MCP tools (were the AI-facing structured format, now replaced)

## Changes

### Phase 1: Delete Dead Code

Remove modules that are no longer imported by anything except their own tests.

| Module | Files to Delete | Reason |
|--------|----------------|--------|
| Old CLI invoker | `src/invoker/index.ts`, `_helpers/build-args.ts`, `_helpers/parse-json-output.ts` + 3 test files | Fully superseded by `invoker-sdk/` (warm SDK sessions) |
| Response parser | `src/orchestrator/_helpers/response-parser.ts` + test | `[COMMAND]` block parsing superseded by MCP tools |
| Command router | `src/orchestrator/_helpers/command-router.ts` + test | Registry-based block routing superseded by `onCommand` hooks + MCP tools |
| CLI token helpers | `src/token-usage/_helpers/parse-cli-usage.ts` + test, `_helpers/estimate-tokens.ts` + test | CLI-specific; SDK provides actual token counts |
| Token usage orchestrator | `src/token-usage/index.ts` + test | Bundles CLI parsing with useful helpers; the useful parts move to metrics plugin |

### Phase 2: Wire Prompt Assembler into Pipeline

The prompt assembler (`src/orchestrator/_helpers/prompt-assembler.ts`) builds a baseline prompt with thread context and kind-specific instructions. It should be the starting point before `onBeforeInvoke` hooks enrich the prompt.

**Current flow:**
```
raw content -> onBeforeInvoke hooks -> invoke
```

**New flow:**
```
raw content -> assemblePrompt(content, threadMeta) -> onBeforeInvoke hooks -> invoke
```

The assembler adds:
- Thread header: `[Thread: id | name (kind)]`
- Kind-specific instruction (primary, task, cron, general)
- User message section

Then hooks enrich it (context plugin adds conversation history, context files, etc).

**Changes:**
- `orchestrator/index.ts`: Add `kind` and `name` to the thread query `select` at step 0. Call `assemblePrompt()` to build the baseline prompt, then pass that to `runChainHooks` instead of raw content.
- Update tests accordingly.

### Phase 3: Create Metrics Plugin

Token usage tracking needs to be connected to the dashboard. The module has useful helpers (`calculateCost`, `recordUsageMetrics`) that should be wired into the pipeline.

**Approach:** Create a new `@harness/plugin-metrics` package with an `onAfterInvoke` hook.

**Data flow:**
```
invoke completes -> onAfterInvoke fires -> metrics plugin hook:
  1. Extract model, inputTokens, outputTokens from InvokeResult
  2. calculateCost(model, inputTokens, outputTokens) -> costEstimate
  3. recordUsageMetrics(db, { threadId, model, inputTokens, outputTokens, costEstimate })
```

**File moves:**
- `src/token-usage/_helpers/calculate-cost.ts` -> `packages/plugins/metrics/src/_helpers/calculate-cost.ts`
- `src/token-usage/_helpers/record-usage-metrics.ts` -> `packages/plugins/metrics/src/_helpers/record-usage-metrics.ts`
- Tests move with their source files

**New files:**
- `packages/plugins/metrics/src/index.ts` — plugin definition with `onAfterInvoke` hook
- `packages/plugins/metrics/src/__tests__/index.test.ts`
- `packages/plugins/metrics/package.json`, `tsconfig.json`, `vitest.config.ts`

**Registry:** Add `metricsPlugin` to `src/plugin-registry/index.ts`.

**Delete remaining:** Empty `src/token-usage/` directory after helpers are moved.

## What Stays the Same

- Slash command path (`parseCommands` -> `runCommandHooks`) — human override mechanism
- MCP tool system (just built) — AI-facing structured commands
- `sendToThread` message persistence — core infrastructure
- Environment sanitization in `create-session.ts` — dedup resolves when old invoker is deleted

## Verification

- `pnpm typecheck` — no dangling imports
- `pnpm test` — no regressions, new metrics plugin tests pass
- `pnpm lint` — clean
- `pnpm build` — all packages build
- No module imports the deleted files (grep verification)
