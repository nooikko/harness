# Harness Roadmap

Master backlog. Ordered by rough priority within tiers. Each item gets its own plan file when work begins.

---

## Vision: Self-Managing System

The endgame is not a list of features — it's an architecture where Harness builds, tests, validates, and deploys its own features. Everything on this roadmap should be designed with this in mind: **Harness should eventually be able to implement items on this roadmap itself.**

### The Loop

```
Roadmap item / user request
    → Agent picks up task (delegation plugin)
    → Agent implements in isolated worktree
    → Agent deploys to staging environment (homelab server via SSH)
    → Agent runs Playwright against staging (full UI validation)
    → Agent captures screenshots/video of the result
    → Agent presents visual proof to user: "here's what it looks like, anything off?"
    → User approves (or gives feedback → agent iterates)
    → Agent promotes to production (redeploys main service)
```

This is not one feature — it's the convergence of multiple systems working together:

| Capability | Status | What's Needed |
|-----------|--------|---------------|
| Delegation loop (multi-iteration) | **Exists** | Already supports retry + validation |
| Playwright plugin | **Complete** | 8 MCP tools (navigate, click, fill, screenshot, etc.), per-thread sessions, auto-cleanup |
| Playwright MCP server | **Complete** | Configured in `.mcp.json` for Claude Code direct use |
| E2E test framework | **Complete** | Playwright Test configured, POM with 9 page objects, ~20 tests |
| File uploads (browser) | **Complete** | Full pipeline: upload API, preview modal, chat integration, context injection |
| Git worktrees | **Exists** | Worktree hooks in Claude Code settings |
| SSH to homelab | **Complete** | `@harness/plugin-ssh` — 5 MCP tools, connection pool, admin UI, key install |
| Programmatic file creation | **Complete** | `ctx.uploadFile` on PluginContext — any plugin can persist attachments |
| Video capture | **Complete** | `start_recording`/`stop_recording` tools, WebM at 1280x720 |
| Staged deployment | **Missing** | No multi-server deploy, no staging concept |
| Roadmap/task → delegation bridge | **Missing** | Turn roadmap items into delegatable task prompts |
| Coding workspace UI | **Missing** | No agent activity dashboard |

### What This Means for Feature Design

Every feature should ask: "Could an agent have built this?" If the answer is "no because X is missing," then X goes on the roadmap too. Specifically:

- **Playwright plugin** needs to persist screenshots as File records instead of temp files
- **Playwright plugin** needs video recording (Playwright supports it natively, just not wired)
- **PluginContext** may need an `uploadFile` method so any plugin can create attachments
- **SSH plugin** needs deployment commands, not just arbitrary exec — `deploy_build`, `restart_service`, `check_health`
- **Delegation plugin** needs to support very long loops (build → test → fix → retest cycles)
- **The coding workspace** is the control hub where you watch all of this happening across agents

### Bootstrapping Order

You can't build the whole thing at once. The bootstrapping sequence:

1. **SSH plugin + host registry** — agent can reach the homelab (plan: `tier1-ssh-plugin.md`)
2. **Playwright visual capture** — screenshots/video persist as File attachments (plan: `tier1-playwright-visual-capture.md`)
3. **Staged deployment flow** — build on staging, validate, promote (plan: `tier1-staged-deployment.md`)
4. **Agent isolation hardening** — guardrails before agents manage infrastructure
5. **Roadmap → task delegation** — roadmap items become structured tasks agents can pick up
6. **Coding workspace** — the UI where you watch it all happen

After step 4, Harness can start building itself. Steps 5-6 make it comfortable to watch.

---

## Architectural Principles

These apply across the entire roadmap and should inform every feature's design.

### Plugin UI Coupling
Disabling a plugin should hide its associated UI. If all calendar plugins are off, the `/calendar` route shouldn't render. This requires a plugin metadata system that declares which UI routes/components a plugin owns, and a runtime check in the web app's layout/routing.

**Open question:** How do Outlook Calendar, Calendar plugin, and the Calendar UI page interact? Outlook Calendar syncs its own data; the Calendar plugin injects context. Need to research their dependency graph before designing the toggle behavior.

### Plugin Classification: System vs Feature
Some plugins are **system** (turning them off breaks the platform) and some are **feature** (optional capabilities). System plugins should not have a disable toggle in the admin UI, or should require confirmation with a warning.

Candidates for system classification:
- **web** — HTTP server + WebSocket. Without this, nothing works.
- **activity** — pipeline persistence. Without this, no observability.
- **context** — history injection. Without this, Claude has no conversation context.

Everything else is a feature plugin.

### Self-Management: Each Plugin Owns Its Own Tools
Plugins should expose their own MCP tools for management. No centralized "admin plugin" that reaches into other plugins. Examples already working:
- `cron__schedule_task` — cron plugin manages its own jobs
- `identity__update_self` — identity plugin manages agent identity

Pattern to follow: each plugin that has configurable state exposes tools for the agent to read/modify that state. A lightweight "system status" tool could live in the orchestrator or a thin admin plugin, but CRUD operations belong to the owning plugin.

### SSH Host Management UI
SSH hosts should not be hardcoded. The plugin needs:
- Admin UI for registering hosts (hostname, port, username, SSH key)
- Connection testing (try to connect, report success/failure)
- Key provisioning flow (generate key pair, show public key for user to add to `authorized_keys`, or prompt for password to install it)
- Secure credential storage (encrypted at rest, or reference system keychain)
- Per-host audit logging of commands executed

### Agent Isolation & Environment Variables
The orchestrator uses `claude -p` (Claude Code CLI) with `bypassPermissions`. Full isolation would mean restricting the subprocess environment — but the subprocess needs `ANTHROPIC_API_KEY` and potentially other env vars to function. This is a key research question: **can we isolate execution (restrict tools, filesystem, network) while still passing through the env vars Claude needs?**

Possible approaches:
- Explicit env var allowlist passed to subprocess (only forward what's needed)
- `disallowedTools` in SDK options (restrict specific tools without full sandbox)
- Per-agent permission profiles stored in DB, applied at session creation time

---

## Tier 1: Bootstrap the Self-Managing Loop

These are ordered by dependency. Each one unlocks the next. After this tier, Harness can start building itself.

### ~~1. SSH / Remote Execution Plugin~~ — COMPLETE
- `@harness/plugin-ssh` with 5 MCP tools: `exec`, `list_hosts`, `add_host`, `remove_host`, `test_connection`
- Connection pool (per-host, inUse tracking, LRU eviction, 15s timeout, 5-min TTL)
- Admin UI at `/admin/ssh-hosts` with CRUD, "Install Key Automatically" flow (ssh-copy-id equivalent), key verification
- AES-256-GCM encrypted key storage, TOFU host fingerprint verification, SshCommandLog audit trail
- Settings hot-reload via `onSettingsChange`, structured error classification
- 155+ tests. Plan: `tier1-ssh-plugin.md`

### ~~2. Playwright Visual Capture~~ — COMPLETE
- `ctx.uploadFile` on PluginContext — any plugin can persist file attachments
- Screenshot tool persists as File records (no more temp files)
- Video recording via `start_recording` / `stop_recording` tools (WebM, 1280x720)
- `validate_pages` composite tool for batch URL screenshots
- Inline media rendering: images as thumbnail grid, videos with `<video controls>`
- Range request support (HTTP 206) for video seeking
- Video preview in file preview modal
- 11 Playwright tools (was 8), 75 tests. Plan: `tier1-playwright-visual-capture.md`

### ~~3. File Upload / Attachment Pipeline~~ — COMPLETE
File uploads are fully implemented: Prisma File model, upload/delete/list server actions, multipart API route, file serving with proper headers, chat input with paperclip button, preview modal (images/PDFs/text), thread attachments panel, project files panel, context plugin injection. Only gap is programmatic uploads from plugins (addressed in #2 above).

### 3. Staged Deployment Flow — DEFERRED
- **What:** Agent builds Harness on staging server, validates with Playwright, promotes to production
- **Current state:** `deploy/deploy.sh` exists for single-server PM2 deployment. No multi-server, no staging concept.
- **New models:** Environment (links to SshHost, stores deploy path + env config) + Deployment (tracks each deploy with status + logs)
- **Flow:** SSH deploy to staging → Playwright screenshots → user approves → SSH deploy to production
- **Plan file:** `tier1-staged-deployment.md`

### 4. Agent Isolation Hardening — DEFERRED
- **What:** Per-agent permission scoping so self-managing agents can't brick the system
- **Approach:** Incremental — env var allowlist → disallowedTools per agent → execution sandboxing
- **Plan file:** `agent-isolation-research.md` (exists)

---

## Tier 2: Daily Life Features

Once the self-managing loop works, these can be built by Harness itself (with human approval). They're the features that make it worth opening every day.

### ~~6. Govee Lights Plugin~~ — COMPLETE
- Originally planned as Philips Hue — switched to Govee (what we actually have)
- `packages/plugins/govee/` — MCP tools for controlling Govee LED lights via LAN API
- On worktree branch, pending merge

### ~~6b. Philips Hue Plugin~~ — WON'T DO
- Replaced by Govee plugin (we don't use Hue)

### ~~7. Rich Content Blocks~~ — COMPLETE
- Content block framework: `ContentBlock` type in plugin-contract, `pendingBlocks` queue in tool server, activity plugin persistence, frontend registry with lazy-loaded renderers
- 12 block types: email-list, email-folders, map, timer, recipe, calendar-events, calendar-day-summary, calendar-week-overview, now-playing, task-list, music-search, cron-jobs
- Code block syntax highlighting with copy button (`code-block.tsx`)
- Plan files: `rich-response-formatting.md`, `content-block-system.md`

### 8. Morning News Digest
- **What:** Automated daily briefing with web search results, delivered via Discord + web UI
- **Scope:** Web search plugin (`packages/plugins/web-search/`) + digest formatting + cron trigger
- **Plan file:** `morning-news-digest.md`

### 9. Cron-Calendar Followups
- **What:** Calendar-aware scheduling — detect conflicts when creating one-shots, smart rescheduling
- **Scope:** Integration layer between cron and calendar plugins
- **Plan file:** `cron-calendar-followups.md`

### 10. Claude Status Monitor Plugin
- **What:** Poll `status.anthropic.com` for incidents, notify via Discord + web UI
- **Scope:** `packages/plugins/claude-status/` — polling cron or webhook, incident parsing, broadcast
- **Source:** Atlassian Statuspage (RSS/Atom feed at `status.anthropic.com/history.atom`, or JSON API)
- **Feasibility:** High — simple HTTP polling + parse + broadcast pattern
- **Plan file:** TBD

### 11. Plugin UI Coupling System
- **What:** Disabled plugins hide their UI routes/components automatically
- **Scope:** Plugin metadata declares owned routes; web app layout checks plugin status at render time
- **Includes:** System vs feature plugin classification, disable-protection for system plugins
- **Research needed:** Calendar plugin dependency graph (Outlook Calendar ↔ Calendar plugin ↔ Calendar UI)
- **Plan file:** TBD

### 12. GitHub CI/Actions Integration
- **What:** Surface GitHub Actions status in UI, let agent trigger/monitor workflow runs
- **Scope:** New MCP tools in a `packages/plugins/github-actions/` or extend existing GitHub MCP usage
- **Self-management:** `github__list_runs`, `github__trigger_workflow`, `github__get_run_status`
- **Already have:** GitHub MCP server in `.mcp.json` — but it's for Claude Code, not the orchestrator
- **Feasibility:** Medium — GitHub REST API is well-documented, need to bring it into plugin system
- **Plan file:** TBD

---

## Tier 3: Control Hub

The UI where you watch everything happening, manage agents, and review their work.

### 13. Coding Workspace / Agent Activity Dashboard
- **What:** Dedicated UI for watching agent work — live file diffs, tool call timeline, clickable file browser
- **Scope:** New route `/workspace` or `/activity` in `apps/web/`
- **Data source:** Activity plugin already captures `tool_call`, `tool_result`, `thinking` stream events
- **Key views:**
  - Real-time activity stream (tool calls as they happen via WebSocket)
  - File diff viewer (parse tool_call events for file edits, show before/after)
  - File tree of touched files per session/thread
  - Screenshot/video gallery from Playwright captures
  - GitHub Actions status panel
  - Multi-agent view (watch delegation chains, see which agents are active)
- **Feasibility:** Medium — data exists, this is primarily a frontend build
- **Plan file:** TBD

### 14. Roadmap → Task Delegation Bridge
- **What:** Roadmap items become structured tasks that agents can pick up and execute
- **Scope:** Could be part of the existing task system (plan at `task-list-system.md`) or a roadmap plugin
- **Flow:** User reviews roadmap in Harness → marks item as "ready" → agent picks it up → delegation loop handles implementation → staged deploy → user reviews visual proof → approve/iterate
- **Feasibility:** Medium — delegation loop exists, needs the "pick up from roadmap" trigger
- **Plan file:** TBD

---

## Tier 4: Native App (iOS + macOS)

Rich notifications with Dynamic Island, actionable alerts, media control widgets. PWA can't do this.

### 15. Native iOS App
- **What:** Swift/SwiftUI app consuming Harness API. Push notifications via APNs.
- **Features:**
  - Chat interface (mirrors web UI)
  - Rich push notifications (Dynamic Island, actionable, persistent)
  - Live Activities for long-running agent tasks
  - Media control widget (for music plugin integration)
  - Quick actions from notification (approve delegation, respond to agent)
- **Depends on:** Stable API layer (web plugin's HTTP endpoints), APNs server-side integration
- **Scope:** Separate repo or `apps/ios/` in monorepo
- **Feasibility:** Medium-High — standard Swift app, but it's a whole new platform
- **Plan file:** TBD

### 16. macOS Companion App
- **What:** Menu bar app with notification center integration, possibly shares codebase with iOS via SwiftUI
- **Features:** System tray presence, native macOS notifications, quick-reply, status indicator
- **Feasibility:** Medium — SwiftUI multiplatform, shares most code with iOS app
- **Plan file:** TBD

---

## Tier 5: Research / Uncertain Feasibility

### 17. iMessage Integration
- **What:** Two-way iMessage from Harness
- **Reality:** Apple provides no public API. Known workarounds:
  - AppleScript `Messages.app` automation (macOS only, brittle, requires GUI session)
  - `imessage-exporter` (read-only export)
  - Jailbreak-based solutions (not viable for daily use)
  - Beeper/Matrix bridge (third-party, may break)
- **Verdict:** Probably not feasible as a reliable persistent service. Could do one-way (read incoming) via AppleScript polling on the Mac Mini, but two-way is fragile.
- **Revisit when:** Apple opens iMessage API (unlikely) or a stable bridge emerges

---

## Completed (remove from active backlog)

- ~~Vector search~~ — Qdrant semantic search via `@harness/plugin-search`
- ~~Cmd+K command palette~~ — Search palette with 9 filter types, FTS + Qdrant fan-out
- ~~Cron hot-reload~~ — `onSettingsChange` hook, immediate reload on CRUD
- ~~Memory scoping~~ — 3-level AGENT/PROJECT/THREAD on AgentMemory
- ~~Reflection cycle~~ — Phase 4 complete with scoped reflections
- ~~File uploads~~ — Full pipeline: File model, upload/serve API, chat integration, preview modal, context plugin injection
- ~~Playwright plugin~~ — 11 MCP tools, per-thread sessions, auto-cleanup
- ~~Playwright Visual Capture~~ — `ctx.uploadFile`, screenshot/video persistence, inline media, `validate_pages`
- ~~E2E test framework~~ — Playwright Test configured, POM with 9 page objects, 6 suites
- ~~SSH plugin~~ — `@harness/plugin-ssh` with 5 MCP tools, connection pool, admin UI, key install, 155+ tests
- ~~Search plugin hardening~~ — `qdrantReady` guard for graceful Qdrant downtime handling
- ~~Task list system~~ — UserTask model, 6 MCP tools, `/admin/tasks` + `/tasks` UI, dependencies
- ~~Microsoft Graph / Outlook~~ — 8 MCP tools, OAuth token storage
- ~~Calendar system~~ — Unified Outlook/Google/local, 14 MCP tools, `/calendar` UI
- ~~Logging infrastructure~~ — `@harness/logger` + `@harness/plugin-logs`, Loki + file fallback
- ~~Live delegation card~~ — Real-time status, progress bar, cancel, WebSocket updates
- ~~Project area UI~~ — Project hub at `/chat/projects`, detail pages, settings, files, memory, threads
- ~~Govee lights plugin~~ — On worktree branch, pending merge
- ~~Storytelling plugin~~ — 20+ MCP tools, story workspace, character embedding, arcs, transcript import
- ~~Rich content blocks~~ — 12 block types in registry, content block framework, code syntax highlighting + copy

