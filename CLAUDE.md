# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Harness is a full-stack monorepo using Next.js 16, React 19, Prisma 6, and Tailwind CSS 4 on pnpm workspaces with Turborepo. It hosts the Claude Orchestrator — a thin orchestration layer that keeps Claude Code CLI as the agent runtime, with persistent conversation threads, sub-agent delegation, cron-scheduled invocations, and interface adapters (Discord, web dashboard).

## Commands

```bash
# Development
pnpm dev                    # Start all packages in dev mode (Turbo)
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages (Biome)
pnpm typecheck              # TypeScript type check all packages
pnpm format                 # Auto-format with Biome
pnpm check                  # Biome check + fix

# Database (Prisma)
pnpm db:generate            # Generate Prisma Client from schema
pnpm db:push                # Push schema to database (no migration)
pnpm db:studio              # Open Prisma Studio GUI
pnpm --filter database db:migrate  # Create migration files

# Testing
pnpm test                   # Run all tests (Vitest via Turbo)
pnpm test:watch             # Run tests in watch mode
pnpm test:coverage-gate     # Pre-commit coverage check + barrel detection

# CI pipeline (what GitHub Actions runs)
pnpm ci                     # sherif → typecheck → lint → build

# Single-package commands
pnpm --filter web dev       # Dev only the web app
pnpm --filter web build     # Build only the web app
pnpm --filter database lint # Lint only the database package
```

## Architecture

```
apps/web/               → Next.js 16 app (App Router, Server Components)
packages/database/      → Prisma client + schema (PostgreSQL)
packages/ui/            → Shared UI library (shadcn/ui components, cn utility)
```

### Dependency Flow

`apps/web` imports from both `database` and `ui`. The packages are referenced by name in `next.config.ts` via `transpilePackages: ["ui", "database"]`.

### Database Package

- Prisma schema at `packages/database/prisma/schema.prisma`
- Exports a singleton `prisma` client and all `@prisma/client` types from `packages/database/src/index.ts`
- Requires `DATABASE_URL` env var (PostgreSQL connection string)
- Copy `packages/database/.env.example` to `packages/database/.env` for local dev

### UI Package

- Exports `cn()` utility (clsx + tailwind-merge) from `packages/ui/src/index.ts`
- shadcn/ui components live in `apps/web/src/components/ui/` (app-local, not in shared package yet)
- Uses Radix UI primitives, Class Variance Authority for variants, Lucide for icons

### Web App

- Next.js 16 with App Router at `apps/web/src/app/`
- Path alias: `@/*` maps to `apps/web/src/*`
- Font: Inter via `next/font/google`

## Code Style

**Formatter/Linter:** Biome (not ESLint/Prettier). Config in `biome.json`.

- 2-space indent, double quotes, semicolons always, trailing commas (ES5)
- `noUnknownAtRules: off` for Tailwind CSS `@apply`/`@theme` directives
- Organize imports automatically on save/check
- Run `pnpm check` to lint + format in one pass

**File naming:** kebab-case enforced by a PreToolUse hook. Exceptions: `__root`/`__index`, dotfiles, ALL_CAPS files (README, LICENSE), `AI_RESEARCH/` directory.

**TypeScript:** Strict mode with `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch`. Target ES2022, bundler module resolution.

**Arrow functions only.** No `function` keyword declarations. Define the function's type separately (PascalCase), then annotate the const (camelCase): `type ParseResponse = (raw: string) => Result; const parseResponse: ParseResponse = (raw) => { ... };`

**Types are co-located.** Types live in the file that generates/uses them. Never create centralized `types.ts` files. Use Prisma-generated types directly via `import type { Thread } from "database"`.

**Imports:** Always import from the module directory (`@/orchestrator`), never reach into `_helpers/`. No `.js` or `.ts` file extensions in import paths.

**File organization:** Co-location, isolation, orchestration. Every module is a directory with `index.ts` (orchestration), `_helpers/` (isolated logic), and `_components/` (sub-modules). The `_` prefix means private to the module.

## Git Hooks

Pre-commit (via Husky + lint-staged):
- Biome check on staged `.js/.jsx/.ts/.tsx/.json/.css` files
- Sherif dependency validation
- Coverage gate (`pnpm test:coverage-gate`)

Pre-push:
- Full typecheck (`pnpm typecheck`)
- Full lint (`pnpm lint`)

The `--no-verify` flag is blocked by a Claude Code hook. Fix issues instead of bypassing hooks.

### Coverage Gate

Pre-commit runs `pnpm test:coverage-gate` which enforces:
- **No barrel files** — files that only contain re-exports (`export * from`) are rejected
- **80% line + branch coverage** — on staged `.ts/.tsx` files and their dependencies

Excluded from coverage: `*.config.ts`, `*.setup.ts`, `*.d.ts`, `*.test.ts`, `*.spec.ts`, generated files.

To run manually: `pnpm test:coverage-gate`
To skip coverage and only check barrels: `pnpm test:coverage-gate --skip-coverage`

## Claude Code Hooks

- **block-no-verify** (PreToolUse → Bash): Prevents `git --no-verify`
- **pre-commit-validate** (PreToolUse → Bash): Blocks `git commit` until typecheck, lint, build, and coverage-gate all pass (5min timeout)
- **enforce-kebab-case** (PreToolUse → Write|Edit): Blocks non-kebab-case filenames
- **biome-check** (PostToolUse → Write|Edit): Auto-runs `npx biome check --write` after file changes
- **enforce-arrow-functions** (PostToolUse → Write|Edit): Warns when `function` keyword declarations are used in TS/JS files
- **notify-on-complete** (Notification): Desktop notifications via `notify-send`
- **worktree-setup** (WorktreeCreate): Creates git worktrees at `.claude/worktrees/` with `pnpm install`

## Skills (formerly Commands)

- `/review` — Adversarial code review (read-only, checklist-based)
- `/handoff` — Session end: documents progress, saves context to memory
- `/do` — Smart orchestrator: routes tasks to specialist agents with parallel execution
- `/catchup` — Session resume: loads context from memory and recent git activity

## MCP Servers

Configured in `.mcp.json`: context7 (live docs), playwright (E2E testing), github (requires `GITHUB_TOKEN`), taskmaster-ai (task management).

## Environment Setup

```bash
cp .env.example .env
cp packages/database/.env.example packages/database/.env
# Edit DATABASE_URL in packages/database/.env
pnpm install
pnpm db:generate
pnpm dev
```

Required: Node >= 22, pnpm 10.x, PostgreSQL.
