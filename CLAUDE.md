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
pnpm test:integration       # Run integration tests (requires Docker for testcontainers)
pnpm test:coverage-gate     # Pre-commit coverage check + barrel detection

# CI pipeline (what GitHub Actions runs)
pnpm ci                     # sherif → typecheck → lint → build

# Code generation
pnpm plugin:generate        # Regenerate plugin settings registry

# Single-package commands
pnpm --filter web dev       # Dev only the web app
pnpm --filter web build     # Build only the web app
pnpm --filter database lint # Lint only the database package
```

## Architecture

```
apps/web/                    → Next.js 16 app (App Router, Server Components)
apps/orchestrator/           → Core Node.js orchestrator service
packages/database/           → Prisma client + schema (PostgreSQL)
packages/ui/                 → Shared UI library (shadcn/ui components, cn utility)
packages/plugin-contract/    → Shared plugin types (@harness/plugin-contract)
packages/plugins/identity/   → Agent identity + episodic memory (@harness/plugin-identity)
packages/plugins/activity/   → Rich activity persistence (@harness/plugin-activity)
packages/plugins/context/    → Context + history injection (@harness/plugin-context)
packages/plugins/discord/    → Discord gateway adapter (@harness/plugin-discord)
packages/plugins/web/        → HTTP server + WebSocket (@harness/plugin-web)
packages/plugins/cron/       → Cron job scheduler (@harness/plugin-cron)
packages/plugins/delegation/ → Sub-agent delegation (@harness/plugin-delegation)
packages/plugins/validator/  → Delegation quality gate (@harness/plugin-validator)
packages/plugins/metrics/    → Token/cost tracking (@harness/plugin-metrics)
packages/plugins/summarization/ → Thread summarization (@harness/plugin-summarization)
packages/plugins/auto-namer/ → Thread auto-naming (@harness/plugin-auto-namer)
packages/plugins/audit/      → Audit-delete flow (@harness/plugin-audit)
packages/plugins/time/       → Time injection + tool (@harness/plugin-time)
packages/plugins/project/    → Project memory tools (@harness/plugin-project)
packages/plugins/search/     → Qdrant vector indexing for semantic search (@harness/plugin-search)
packages/plugins/tasks/      → Task CRUD tools (@harness/plugin-tasks)
packages/plugins/outlook/    → Outlook email via Microsoft Graph (@harness/plugin-outlook)
packages/plugins/calendar/   → Calendar context injection + Outlook/Google sync (@harness/plugin-calendar)
packages/plugins/music/      → Music playback control via Cast devices (@harness/plugin-music)
packages/plugins/playwright/ → Browser automation + visual capture (@harness/plugin-playwright)
packages/plugins/logs/       → Structured log querying via Loki or file (@harness/plugin-logs)
packages/plugins/ssh/        → SSH remote execution (@harness/plugin-ssh)
packages/vector-search/      → Qdrant client + HuggingFace embeddings (@harness/vector-search)
packages/logger/             → Shared structured logger (@harness/logger)
```

### Dependency Flow

`apps/web` imports from both `database` and `ui`. The packages are referenced by name in `next.config.ts` via `transpilePackages: ["@harness/ui", "database"]`. Plugin packages import from `@harness/plugin-contract` and `database` — never from the orchestrator. The orchestrator imports plugins via a static registry.

### Database Package

- Prisma schema at `packages/database/prisma/schema.prisma`
- Exports a singleton `prisma` client and all `@prisma/client` types from `packages/database/src/index.ts`
- Requires `DATABASE_URL` env var (PostgreSQL connection string)
- Copy `packages/database/.env.example` to `packages/database/.env` for local dev

### UI Package

- Exports `cn()` utility (clsx + tailwind-merge) from `packages/ui/src/index.ts`
- ShadCN components live in `packages/ui/src/components/` (shared across apps)
- Available components: AlertDialog, Alert, Avatar, AvatarGroup, Badge, Button, Card, Collapsible, Command, Dialog, DropdownMenu, Form, Input, Kbd, Label, Popover, Progress, ResponsiveModal, ScrollArea, Select, Separator, Sidebar, Skeleton, Switch, Table, Tabs, Textarea, Toggle, Tooltip
- Uses Radix UI primitives (`@radix-ui/react-*`), Class Variance Authority for variants, Lucide for icons
- Import components from `"@harness/ui"` (e.g., `import { Button, Card, Dialog } from "@harness/ui"`)
- **UI package is the source of truth** for all shadcn/Radix primitives. Never create local copies in apps — if a primitive is missing, add it to `packages/ui/`. App-specific compositions that use these primitives as building blocks belong in the app's own `_components/` directories.

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

**One export per helper file.** Each file in `_helpers/` exports exactly one function, named to match the kebab-case filename. `_helpers/run-hook.ts` exports `runHook`, `_helpers/format-context-section.ts` exports `formatContextSection`. If you need a second export, create a second file. Each helper gets a corresponding test: `_helpers/__tests__/run-hook.test.ts`.

**Test placement:** Tests live in `__tests__/` folders within the directory they test. `src/__tests__/index.test.ts` tests `src/index.ts`. `src/_helpers/__tests__/foo.test.ts` tests `src/_helpers/foo.ts`. Never place test files directly alongside source files.

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
- **pre-commit-validate** (PreToolUse → Bash): Blocks `git commit` until typecheck, lint, build, and coverage-gate all pass (2min timeout)
- **block-any-types** (PreToolUse → Bash): Blocks commits with explicit `any` types (`: any`, `as any`, `<any>`, `any[]`) in staged .ts/.tsx files
- **enforce-commit-message** (PreToolUse → Bash): Enforces conventional commit format (`type(scope): description`)
- **enforce-kebab-case** (PreToolUse → Write|Edit): Blocks non-kebab-case filenames
- **biome-check** (PostToolUse → Write|Edit): Auto-runs `npx biome check --write` after file changes
- **enforce-arrow-functions** (PostToolUse → Write|Edit): Warns when `function` keyword declarations are used in TS/JS files
- **post-merge-validate** (PostToolUse → Bash): Runs typecheck, lint, build after `git merge` (non-blocking warning)
- **notify-on-complete** (Notification): Desktop notifications via `notify-send`
- **worktree-setup** (WorktreeCreate): Creates git worktrees at `.claude/worktrees/` with `pnpm install`

## Architectural Rules

Three `.claude/rules/` files document execution paths and constraints for the orchestrator/plugin system. **Read these before recommending changes to the orchestrator or plugin architecture.**

- `.claude/rules/architectural-invariants.md` — innate vs extension principle; decision tree for "where does new behavior go?"; common wrong conclusions
- `.claude/rules/data-flow.md` — exact execution path from web action → HTTP → sendToThread → handleMessage (5 steps) → WebSocket; all file:line references
- `.claude/rules/plugin-system.md` — PluginDefinition shape, all hooks, PluginContext API, per-plugin summaries; live plugin contract @imported

## Skills (formerly Commands)

- `/do` — Smart orchestrator: routes tasks to specialist agents with parallel execution
- `/review` — Adversarial code review (read-only, checklist-based)
- `/handoff` — Session end: documents progress, saves context to memory
- `/catchup` — Session resume: loads context from memory and recent git activity
- `/pre-flight` — Pre-implementation checklist (9 items) to catch architectural anti-patterns
- `/engine` — Taskmaster-driven execution engine for task queue processing
- `/web-design-guidelines` — Reviews UI code for Web Interface Guidelines compliance
- `/vercel-react-best-practices` — React/Next.js performance optimization guidelines (57 rules)
- `/vercel-composition-patterns` — React composition patterns (compound components, React 19 APIs)

## MCP Servers

Configured in `.mcp.json`: serena (codebase tools), context7 (live docs), playwright (E2E testing), github (requires `GITHUB_TOKEN`), semgrep (static analysis).

## Environment Setup

```bash
# Quick setup (starts Docker services, installs deps, pushes schema + FTS indexes, seeds DB)
cp .env.example .env
cp packages/database/.env.example packages/database/.env
pnpm setup

# Or step-by-step:
docker compose up -d               # PostgreSQL + Qdrant + Loki + Grafana + PO Token Server
pnpm install
pnpm db:generate
pnpm db:push                       # Schema + FTS indexes (chained automatically)
pnpm --filter database db:seed
pnpm dev
```

Required: Node >= 22, pnpm 10.x, Docker (for PostgreSQL, Qdrant, Loki, Grafana, PO Token Server), yt-dlp (`brew install yt-dlp` — required for music playback).

## What Already Exists

Do not rebuild any of the following — these subsystems are fully implemented.

### Admin UI (`/admin` route)

- **`/admin/cron-jobs`** — full CRUD for CronJob records (create, edit, delete, enable/disable) with support for recurring and one-shot scheduled tasks
- **`/admin/plugins`** — enable/disable plugins at runtime via PluginConfig (no code change needed)
- **`/admin/threads`** — thread management UI
- **`/admin/agent-runs`** — view AgentRun records and token/cost metrics
- **`/admin/tasks`** — task management UI

### Agent Management (`/agents` route)

- **Full CRUD** for Agent records: create, edit, delete
- **AgentConfig toggles** — `memoryEnabled` and `reflectionEnabled` checkboxes on the agent edit form, persisted via `update-agent-config.ts` server action
- **Scheduled tasks display** — read-only list of CronJob records on agent detail page, with link to create new tasks
- **Memory browser** — list and delete AgentMemory records per agent
- **Server actions** (all in `apps/web/src/app/(chat)/chat/_actions/`): `create-agent.ts`, `update-agent.ts`, `delete-agent.ts`, `list-agents.ts`, `list-agent-memories.ts`, `delete-agent-memory.ts`, `update-agent-config.ts`

### Usage Dashboard (`/usage` route)

- **Token and cost metrics** visualization from AgentRun records

### Agent Identity Plugin (`packages/plugins/identity/`)

- **Phase 1 complete: soul injection** — agent soul/identity/role loaded from Agent record and injected into every prompt via `onBeforeInvoke`
- **Phase 2 complete: episodic memory** — AgentMemory records scored by importance, retrieved via recency+importance ranking, injected into prompts. **Memory scoping** (AGENT/PROJECT/THREAD) prevents cross-project contamination.
- **Phase 3: paused** (vector search), **Phase 4: complete** (reflection with scoped reflections), **Phase 5: complete** (scheduled tasks via CronJob CRUD)
- **Plugin ordering:** identity runs BEFORE context in the `onBeforeInvoke` chain (registered first in `ALL_PLUGINS`)

### Summarization Plugin (`packages/plugins/summarization/`)

- Fires at **50-message threshold**, creates a summary Message record, prunes old history

### Audit-Delete Flow

- `request-audit-delete.ts` server action → POST `/api/audit-delete` on orchestrator
- `packages/plugins/audit/` plugin handles the request

### Delegation System (`packages/plugins/delegation/`)

- Full delegation loop with `delegate` and `checkin` MCP tools
- **Validator plugin** (`packages/plugins/validator/`) for structured output validation
- **Circuit breaker:** 4-category failure classification, fast-fail on logic errors, quadratic backoff

### Cron Scheduler (`packages/plugins/cron/`)

- **`@harness/plugin-cron`** — reads enabled CronJob records, schedules with croner (UTC)
- Supports both **recurring** (cron expression) and **one-shot** (`fireAt` datetime) scheduled tasks
- Fires `ctx.sendToThread` on trigger, atomically updates `lastRunAt`/`nextRunAt`
- One-shot jobs auto-disable after firing (`enabled: false`, `nextRunAt: null`)
- Lazy thread creation: if `threadId` is null, auto-creates a `kind:'cron'` thread on first fire
- **MCP tool:** `cron__schedule_task` — agents can create scheduled tasks during conversation
- **Hot-reload:** `onSettingsChange('cron')` stops all jobs and rebuilds from DB. Admin UI actions and MCP tool both trigger reload automatically — no orchestrator restart needed.
- Admin UI at `/admin/cron-jobs` with full CRUD (create, edit, delete, toggle)
- Thread `kind='cron'` recognized by prompt assembler with specialized instructions
- 4 seeded CronJobs: Morning Digest, Memory Consolidation, Calendar Refresh, Weekly Review

### Custom Thread Instructions

- **`Thread.customInstructions`** field in Prisma schema
- UI in `manage-thread-modal.tsx`, saved via `update-thread-instructions.ts` server action
- Injected into prompts by `prompt-assembler.ts` as a `# Custom Instructions` section

### Activity Plugin (`packages/plugins/activity/`)

- Owns **all rich activity persistence** via `onPipelineStart` and `onPipelineComplete` hooks
- Writes: `pipeline_start`/`pipeline_complete` status records, `pipeline_step` records, `thinking`/`tool_call`/`tool_result` stream events
- Orchestrator writes only `kind:'text'` (the assistant response text) — everything else is owned by this plugin

### Metrics Plugin (`packages/plugins/metrics/`)

- Records token usage and cost as 4 `Metric` rows (input, output, total, cost) per invocation via `onAfterInvoke`
- Hardcoded pricing map for model cost calculation
- Used by delegation plugin for cost-cap enforcement

### Auto-Namer Plugin (`packages/plugins/auto-namer/`)

- Generates thread titles after the first user message via `onMessage` hook
- Uses Haiku for title generation (fire-and-forget, runs in parallel with main pipeline)
- Broadcasts `thread:name-updated` for real-time sidebar refresh

### Project Plugin (`packages/plugins/project/`)

- Exposes `get_project_memory` and `set_project_memory` MCP tools for Claude
- Reads/writes `Project.memory` field associated with current thread's project
- Tool-only plugin (no hooks)

### Search System (Cmd+K + FTS + Qdrant)

- **Cmd+K palette** (`apps/web/src/app/_components/search-palette.tsx`) — global search with 9 filter types (`agent:`, `project:`, `in:`, `from:`, `has:file`, `file:`, `task:`, `before:`, `after:`)
- **PostgreSQL FTS** — GIN indexes on Message, Thread, File, Agent, Project tables. Applied automatically by `pnpm db:push` (chained `db:search-indexes`).
- **Qdrant semantic search** — `@harness/vector-search` package (HuggingFace `all-MiniLM-L6-v2`, 384-dim). Optional — search degrades to FTS-only if `QDRANT_URL` is not set.
- **Search indexing plugin** (`packages/plugins/search/`) — indexes messages and threads into Qdrant via `onMessage`, `onPipelineComplete`, `onBroadcast` hooks. Backfills existing content on startup.
- **API route** (`apps/web/src/app/api/search/route.ts`) — parallel FTS + Qdrant fan-out, score merging, result deduplication
- **Polish features** — match highlighting, recent searches (localStorage), filter chips with removal
- **Scroll-to-message** — search results for messages navigate to thread with `?highlight=messageId`, auto-scrolling and highlighting the matched message

### AgentConfig Model

- Per-agent feature flags in Prisma schema: `memoryEnabled`, `reflectionEnabled`
- Schema exists at `packages/database/prisma/schema.prisma`
- Server action: `update-agent-config.ts` — wired to the agent edit form
- Both flags are checked by the identity plugin: `memoryEnabled` gates memory writing, `reflectionEnabled` gates reflection triggering

### Tasks Plugin (`packages/plugins/tasks/`)

- Exposes 6 MCP tools for `UserTask` records: `add_task`, `list_tasks`, `update_task`, `complete_task`, `add_dependency`, `remove_dependency`
- Supports task dependencies with cycle rejection
- Auto-resolves `projectId` and `sourceThreadId` from the current thread
- Tool-only plugin (no hooks)
- Admin UI at `/admin/tasks`

### Outlook Plugin (`packages/plugins/outlook/`)

- Email read/send/search via Microsoft Graph OAuth
- 8 MCP tools: `search_emails`, `read_email`, `list_recent`, `send_email`, `reply_email`, `move_email`, `list_folders`, `find_unsubscribe_links`
- Tool-only plugin (no hooks)
- Requires Microsoft Graph OAuth setup (see `docs/microsoft-graph-setup.md`)

### Calendar Plugin (`packages/plugins/calendar/`)

- Unified calendar system merging Outlook, Google, and local events
- 14 MCP tools: local CRUD (`create_event`, `update_event`, `delete_event`, `list_events`, `get_event`), Outlook Graph tools (`outlook_create_event`, `outlook_update_event`, `outlook_delete_event`, `outlook_list_events`, `outlook_get_event`, `outlook_find_free_time`, `outlook_list_calendars`), response handling (`respond_to_event`), and `sync_now`
- **Lifecycle:** `start` (initial sync + sync timer), `stop` (stop timer)
- **Hook:** `onSettingsChange` — re-syncs calendars on settings change
- Projects virtual events from memories, tasks, and cron jobs
- Calendar UI at `/calendar` route
- `system: true` — receives unsandboxed PluginContext

### Music Plugin (`packages/plugins/music/`)

- YouTube Music playback via Cast devices (Chromecast, Google Home, Nest speakers)
- 16 MCP tools: `search`, `play`, `pause`, `resume`, `stop`, `skip`, `queue_add`, `queue_view`, `set_volume`, `list_devices`, `my_playlists`, `liked_songs`, `like_song`, `unlike_song`, `get_playback_settings`, `update_playback_settings`
- **Dual auth architecture:** OAuth (TVHTML5 client context via `innertube-api.ts`) for authenticated operations (search, playlists, likes); `yt-dlp` subprocess for stream URL resolution (handles YouTube cipher rotation)
- **Lifecycle:** `start` (check yt-dlp availability, fetch PO token from sidecar, init YouTube Music client + Cast device discovery + playback controller), `stop` (cleanup all)
- **Hook:** `onSettingsChange` — resets PO token cache, reloads credentials and playback settings
- **External dependencies:** `yt-dlp` (system binary, `brew install yt-dlp`), `bgutil-ytdlp-pot-provider` Docker sidecar (port 4416, auto-generates PO tokens)
- Settings schema for YouTube auth, PO token server URL, default volume, radio/autoplay, audio quality

### Playwright Plugin (`packages/plugins/playwright/`)

- Browser automation for E2E testing and visual capture
- 11 MCP tools: `navigate`, `snapshot`, `click`, `fill`, `select_option`, `check`, `screenshot`, `press_key`, `start_recording`, `stop_recording`, `validate_pages`
- Per-thread browser pages with auto-cleanup via `onPipelineComplete`
- Visual capture pipeline: screenshots and video persist as File records via `ctx.uploadFile`
- Video recording at 1280x720 WebM
- **Lifecycle:** `start` (launch headless browser), `stop` (close browser + cleanup temp files)

### Logs Plugin (`packages/plugins/logs/`)

- Structured log querying via Loki or rotating log files
- 1 MCP tool: `query` — search by level, source, threadId, traceId, text, time window
- Dual backend: prefers Loki when `LOKI_URL` is set, falls back to file-based log querying via `LOG_FILE`
- Uses `@harness/logger` shared package for structured pino logging

### SSH Plugin (`packages/plugins/ssh/`)

- Remote server execution via SSH connections
- 5 MCP tools: `exec`, `list_hosts`, `add_host`, `remove_host`, `test_connection`
- Connection pool with key-based auth and host key verification (TOFU)
- Command logging to database with exit code, stdout/stderr, and duration
- **Hook:** `onSettingsChange` — reloads timeout and pool settings
- **Lifecycle:** `start` / `stop` (connection pool management)
- Settings schema for default timeout, max output length, command logging, pool limits
- Admin UI for host management at `/admin/ssh-hosts`

### File Upload System

- Upload API route at `/api/files` with configurable `UPLOAD_DIR` and `MAX_FILE_SIZE_MB`
- File serving at `/api/files/[id]`
- Preview modal in chat UI for images, video, and other file types
- `ctx.uploadFile` on PluginContext — any plugin can persist file attachments (used by playwright for screenshots/video)
- Inline media gallery for images and video in chat messages

---

## Planned But Incomplete

These features have partial implementation but are missing execution logic. Do not assume they are done, and do not implement them without reading this context first.

### Agent Identity Phase 3 — Vector Search

- **What:** Similarity search over AgentMemory records for semantic retrieval
- **Status:** PAUSED — Qdrant is operational for the search plugin (message and thread indexing) but has not yet been wired into identity memory retrieval. The blocker is integration work, not a backend decision.
- **Backend:** Qdrant (pgvector explicitly rejected). The `@harness/vector-search` package and Qdrant infrastructure are already in place.
- **When ready:** Implement as an enhancement to the identity plugin's `retrieveMemories` helper, not as a new plugin. Use the existing `@harness/vector-search` package for embeddings and ANN search.
