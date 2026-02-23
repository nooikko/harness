name: pre-flight
description: Use when about to write code in the Harness orchestrator or any sub-agent worktree — run before creating files, modules, or helpers to catch architectural anti-patterns early

# Pre-Flight Checks

Run these checks before writing any code. Every item here was learned from a real mistake in this codebase.

## The Checklist

Before creating any new file, module, or helper, answer ALL of these:

1. **Does this wrap Prisma?** If your function is `getById = (id) => prisma.model.findUnique({ where: { id } })`, delete it. Use Prisma directly. Only extract a helper when it combines multiple operations with genuine business logic (e.g., create Task + create Thread + set defaults in one transaction).

2. **Does this mechanism already exist?** Search the codebase. A hook runner, command parser, or prompt builder may already exist under a different name. Check `_helpers/` directories in the module you're working in.

3. **Is my task description current?** Task descriptions can be stale. Before implementing, read the actual code in the modules you'll touch. If the task describes something that already exists or contradicts current code, flag it — don't blindly implement.

4. **Does this file have a purpose?** No empty barrel files. No placeholder `index.ts` that just re-exports. Every `index.ts` must contain orchestration logic. If a `_helpers/` directory has no helpers yet, don't create it.

5. **Am I creating a centralized types file?** Types are co-located with the code that produces them. The one exception is `packages/plugin-contract/` (`@harness/plugin-contract`) which defines the plugin API surface — that's a shared workspace package, not a type dump.

6. **Am I creating a barrel export?** Never `export * from` in `_helpers/`. Each helper is imported directly by name from its file: `import { parseCommands } from "./_helpers/parse-commands"`. The `index.ts` of a module is orchestration, not re-exports.

7. **Are my tests in `__tests__/` folders?** Tests live in `__tests__/` directories within the folder they test. `src/__tests__/index.test.ts`, not `src/index.test.ts`. `src/_helpers/__tests__/foo.test.ts`, not `src/_helpers/foo.test.ts`. Never place test files directly alongside source files.

8. **Am I importing from the orchestrator inside a plugin?** Plugins are independent workspace packages at `packages/plugins/{name}/`. They import types from `@harness/plugin-contract` and data access from `database` — never from the orchestrator's internal modules.

9. **Does my helper file export more than one function?** Each file in `_helpers/` exports exactly one function, named to match the kebab-case filename. `run-hook.ts` → `export const runHook`. If you need a second export, create a second file. Each helper gets a 1:1 test file in `__tests__/` (e.g., `_helpers/__tests__/run-hook.test.ts`). The only exception is `index.ts` which orchestrates by importing and re-exporting from multiple helpers.

## Red Flags

If you catch yourself thinking any of these, stop:

| Thought | What to do instead |
|---------|-------------------|
| "I'll wrap these Prisma calls for convenience" | Use Prisma directly. It's already typed and ergonomic. |
| "I need a helper for this one-liner" | Inline it. Extract only when reused with real logic. |
| "The task says to create this file" | Check if the mechanism exists. Tasks can be stale. |
| "I'll create the directory structure now and fill it in later" | Create files only when you have content for them. |
| "This getter/setter needs its own module" | `prisma.model.findUnique()` IS the getter. |
| "I'll re-export these helpers from index.ts" | Import each helper directly by name. No barrel exports. |
| "I'll put the test next to the source file" | Tests go in `__tests__/` folders. Always. |
| "I'll import from the orchestrator inside my plugin" | Plugins use `@harness/plugin-contract` and `database`. Never orchestrator internals. |
| "I'll put both helpers in one file" | One export per file. Split it. Each gets its own test file. |

## Two-Layer Command Model

This project has two distinct command systems — don't confuse them:

- **User-facing slash commands** (`/delegate`, `/cron create`) — parsed by input plugins (Discord, web) before the pipeline. May skip Claude invocation entirely.
- **Agent-emitted `[COMMAND]` blocks** — structured blocks Claude outputs in responses, parsed by `response-parser.ts` after invocation, dispatched via `onCommand(type, handler)` registry.

Different parsers, different pipeline stages. Both route to the same plugin handlers.
