# Research: Claude Code Channels & Scheduled Tasks — March 2026

Date: 2026-03-20

## Summary

Anthropic shipped two major new automation features in Claude Code during March 2026: **Channels** (research preview, launched March 19–20 in v2.1.80–81) and **Scheduled Tasks / `/loop`** (launched March 7 in v2.1.71, with full documentation at v2.1.72). Both features are directly relevant to the Harness orchestrator architecture.

- **Channels** is Anthropic's native equivalent of the Harness discord/web plugin — it pipes events from external messaging platforms (Telegram, Discord) and webhooks into a running Claude Code session via MCP.
- **Scheduled Tasks** (`/loop` + `CronCreate`/`CronList`/`CronDelete` tools) is Anthropic's native equivalent of the Harness cron plugin — session-scoped recurring and one-shot prompts with a 3-day expiry.

Both are CLI-only features tied to claude.ai subscription auth. Neither is available via the Anthropic API (no API key support during research preview).

---

## Prior Research

- `/AI_RESEARCH/2026-03-12-everything-claude-code-analysis.md` — broad Claude Code ecosystem analysis (pre-channels)
- `/AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — state of Claude Code ecosystem as of February 2026

---

## Current Findings

### Feature 1: Claude Code Channels

**Source (authoritative):** https://code.claude.com/docs/en/channels

**Launched:** March 19, 2026 in v2.1.80 (research preview); stability improvements in v2.1.81 (March 20, 2026)

#### What it is

A channel is an MCP server that **pushes events into a running Claude Code session** so Claude can react to things happening outside the terminal. Unlike standard MCP where Claude polls on demand, channels are push-based — the external system pushes to Claude.

Channels can be:
- **One-way**: alerts, webhooks, CI failures arrive and Claude acts (no reply)
- **Two-way** (chat bridge): Claude reads the event and replies back through a `reply` MCP tool

#### How it works technically

1. The channel is an MCP server process that Claude Code spawns as a subprocess (stdio transport)
2. The server declares `capabilities.experimental['claude/channel']` in its MCP constructor — this is what registers the notification listener
3. When an event occurs, the server calls `mcp.notification({ method: 'notifications/claude/channel', params: { content, meta } })`
4. Claude receives the event wrapped in a `<channel source="...">` XML tag in its context
5. For two-way channels, the server exposes a `reply` MCP tool that Claude calls to send messages back

The event arrives in the **same session** that already has the user's files open and context loaded — not a fresh session spawn. This is the key architectural distinction from "Claude in Slack" (which spawns fresh sessions).

#### Supported platforms (research preview)

- **Telegram** — polling-based (bot token + BotFather setup)
- **Discord** — Discord gateway (bot token + Developer Portal setup)
- **fakechat** — localhost demo UI (no auth required, for testing)
- **Custom channels** — buildable via `@modelcontextprotocol/sdk`, requires `--dangerously-load-development-channels` flag during research preview

Plugin source: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins

#### Requirements and constraints

| Requirement | Detail |
|---|---|
| Minimum version | Claude Code v2.1.80+ |
| Auth | **claude.ai login only** (Pro, Max, Team, Enterprise) |
| API key auth | **NOT supported** during research preview |
| Runtime | Bun required for official plugins (Node/Deno work for custom builds) |
| Flag | `--channels plugin:telegram@claude-plugins-official` |
| Team/Enterprise | Must explicitly enable via `channelsEnabled` admin setting |
| Custom channels | Use `--dangerously-load-development-channels server:webhook` |

#### Security model

Every channel maintains a **sender allowlist**. Only IDs that have completed the pairing flow can push messages. Pairing: user DMs the bot → bot replies with code → user runs `/telegram:access pair <code>` in Claude Code → user's sender ID added to allowlist.

The allowlist gates on **sender identity** (not chat/room identity) to prevent group chat injection.

#### Enterprise controls

- Team/Enterprise: channels disabled by default; admin must enable at `claude.ai → Admin settings → Claude Code → Channels` or set `channelsEnabled: true` in managed settings
- Pro/Max (no org): opt-in per session with `--channels` flag

#### Comparison to adjacent features (from official docs)

| Feature | What it does | Good for |
|---|---|---|
| Channels | Pushes external events into existing local session | Chat bridges, webhooks, CI alerts |
| Claude Code on the web | Spawns fresh cloud sandbox from GitHub | Delegated async work |
| Claude in Slack | Spawns web session from @Claude mention | Team conversation context |
| Remote Control | Drive local session from claude.ai/mobile | Steering in-progress session |
| Standard MCP | Claude polls on demand | On-demand read/query |

#### Research preview limitations

- Only Anthropic-curated plugins are on the approved allowlist
- `--channels` syntax and protocol contract may change
- Gradual rollout

**Reference docs:**
- Main guide: https://code.claude.com/docs/en/channels
- Build your own: https://code.claude.com/docs/en/channels-reference
- Official plugins: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins

---

### Feature 2: Scheduled Tasks (`/loop` + Cron Tools)

**Source (authoritative):** https://code.claude.com/docs/en/scheduled-tasks

**Launched:** March 7, 2026 in v2.1.71 (`/loop` command and cron tools introduced); v2.1.72 (March 10) added `CLAUDE_CODE_DISABLE_CRON` env var and `ExitWorktree` tool

#### What it is

Session-scoped task scheduling. Three primitives:

1. **`/loop`** — slash command that sets up a recurring cron job within the current session
2. **One-shot natural language reminders** — "remind me at 3pm to push the release branch"
3. **Underlying tools**: `CronCreate`, `CronList`, `CronDelete` — available to Claude as MCP-style tools

#### `/loop` syntax

```
/loop 5m check if the deployment finished and tell me what happened
/loop check the build every 2 hours
/loop 20m /review-pr 1234       ← can invoke another slash command
/loop check the build            ← defaults to every 10 minutes
```

Interval units: `s` (seconds, rounded to minute), `m`, `h`, `d`

#### Underlying tools

| Tool | Purpose |
|---|---|
| `CronCreate` | Schedule task: 5-field cron expression, prompt, recurs or one-shot |
| `CronList` | List all tasks with IDs, schedules, prompts |
| `CronDelete` | Cancel by task ID |

Session limit: **50 scheduled tasks maximum**

#### Timing behavior

- Scheduler checks every second, fires between user turns (never mid-response)
- All times in **local timezone** (not UTC) — `0 9 * * *` = 9am local
- **Jitter**: recurring tasks fire up to 10% of period late (capped 15min); one-shots at :00/:30 may fire up to 90s early
- **3-day expiry**: recurring tasks auto-delete after 3 days

#### One-shot reminders

Natural language parsing (no `/loop` prefix needed):
```
remind me at 3pm to push the release branch
in 45 minutes, check whether the integration tests passed
```
Auto-deletes after firing.

#### Session-scoped limitations (important)

- Tasks only fire while Claude Code is **running and idle** — closing terminal cancels all tasks
- **No catch-up** for missed fires (fires once when Claude becomes idle, not per missed interval)
- **No persistence across restarts**

#### Escape hatch for durable scheduling

For cron-driven automation that must survive restarts:
- **GitHub Actions**: `schedule` trigger in workflow YAML
- **Desktop scheduled tasks**: `claude.ai desktop` → GUI setup flow (reference: https://code.claude.com/docs/en/desktop#schedule-recurring-tasks)

#### Disable flag

`CLAUDE_CODE_DISABLE_CRON=1` disables the scheduler entirely (all cron tools and `/loop` become unavailable).

---

### March 2026 Claude Code Version Timeline

From official changelog (https://code.claude.com/docs/en/changelog) and GitHub releases (https://github.com/anthropics/claude-code/releases):

| Version | Date | Key features |
|---|---|---|
| v2.1.81 | Mar 20 | `--channels` permission relay to phone, `--bare` flag |
| v2.1.80 | Mar 19 | `--channels` research preview LAUNCHED |
| v2.1.79 | Mar 18 | `--console` auth, `/remote-control` |
| v2.1.78 | Mar 17 | `StopFailure` hook, `${CLAUDE_PLUGIN_DATA}`, line-by-line streaming |
| v2.1.77 | Mar 17 | Opus 4.6 default output 64k (128k upper bound), sandbox `allowRead` |
| v2.1.76 | Mar 14 | MCP elicitation, `/effort`, `worktree.sparsePaths` |
| v2.1.75 | Mar 13 | Opus 4.6 1M context (Max/Team/Enterprise), `/color` command |
| v2.1.74 | Mar 12 | `/context` actionable suggestions, `autoMemoryDirectory` |
| v2.1.73 | Mar 11 | `modelOverrides`, Bedrock/Vertex Opus 4.6 |
| v2.1.72 | Mar 10 | `ExitWorktree` tool, `CLAUDE_CODE_DISABLE_CRON`, `w` key in `/copy`, simplified effort levels |
| v2.1.71 | Mar 7 | `/loop` command + cron scheduling tools LAUNCHED |

---

### API vs CLI Availability

Both Channels and Scheduled Tasks are **CLI-only** features during the research preview:

| Feature | CLI (`claude`) | API (Messages API) | Claude Agent SDK |
|---|---|---|---|
| Channels | Yes (v2.1.80+, claude.ai auth) | No | No (not exposed) |
| `/loop` / Cron tools | Yes (v2.1.71+) | No | Potentially — `CronCreate`/`CronList`/`CronDelete` are bundled tools; availability depends on SDK version |
| Voice mode | Yes | No | No |

The requirement for claude.ai login (rejecting API keys) is an explicit constraint from Anthropic during the research preview. Source: official docs note: "They require claude.ai login. Console and API key authentication is not supported."

---

### Pricing and Plan Availability

**Channels:**
- Pro ($20/mo): available, opt-in per session
- Max ($100–200/mo): available, opt-in per session
- Team ($25–30/user/mo): available after admin enables `channelsEnabled`
- Enterprise: available after admin enables `channelsEnabled`
- Free tier: not available during research preview
- API-only access: not available

**Scheduled Tasks:**
- Available on all plans that support Claude Code
- No additional pricing per scheduled task
- Session-scoped (free within normal usage limits)

**General Claude Code pricing (2026):**
- Included with Pro ($20/mo) and Max ($100–200/mo) subscriptions
- API: Sonnet 4.6 at $3/M input, $15/M output; Opus 4.6 at $5/M input, $25/M output
- 1M token context: generally available for Opus 4.6 and Sonnet 4.6 at standard pricing (from search results)

---

### Other Noteworthy March 2026 Features

- **Voice mode** — push-to-talk (`/voice` command, spacebar to speak), rebindable key via `voice:pushToTalk` in keybindings.json
- **MCP Elicitation** (v2.1.76) — MCP servers can request structured user input mid-task via interactive dialogs; new `Elicitation` and `ElicitationResult` hooks
- **Remote Control** — drive a local Claude Code session from claude.ai or the Claude mobile app (separate from Channels)
- **Opus 4.6 1M context** — generally available for Max/Team/Enterprise (v2.1.75)
- **`ExitWorktree` tool** — leaves an `EnterWorktree` session (mirrors the Harness `ExitWorktree` deferred tool)
- **`StopFailure` hook** (v2.1.78) — fires when a turn ends due to API error; useful for error recovery in automation

---

## Key Takeaways

### Relevance to Harness Architecture

1. **Channels vs. Harness Discord/Web plugins**: The Harness architecture (discord plugin + web plugin) is conceptually identical to Claude Code Channels — both use persistent sessions with external event injection. The key difference: Harness uses its own HTTP server and WebSocket layer; Channels uses the MCP protocol. Harness's approach is more flexible (not locked to claude.ai auth).

2. **Scheduled Tasks vs. Harness cron plugin**: Near-identical functionality. Both support recurring (cron expression) and one-shot (fireAt) tasks. Key differences: Harness cron is **durable** (survives restarts, stored in DB), session-scoped (`claude --loop`) is ephemeral. Harness's implementation is strictly more capable for production use.

3. **`CronCreate`/`CronList`/`CronDelete` tool names**: These are the exact same tool names already exposed as deferred tools in this Harness project (visible in `<available-deferred-tools>`). This confirms Harness is aligned with Anthropic's canonical tool naming for scheduling.

4. **`ExitWorktree`**: Also present as a deferred tool in Harness — Anthropic shipped this in v2.1.72 on March 10, 2026.

5. **Auth constraint is CLI-specific**: The "claude.ai login required, no API key" constraint applies only to Claude Code CLI channels. Harness's orchestrator uses the Claude Agent SDK directly and is not affected by this limitation.

6. **The 3-day expiry on Claude Code session tasks** is a fundamental difference from Harness cron, which has no expiry. For production/durable scheduling, Harness's DB-backed approach is the right architecture.

---

## Gaps Identified

- No official Anthropic blog post specifically for Channels or Scheduled Tasks was found — these shipped as changelog items, not major announcements. The anthropic.com/news page for March 2026 focuses on org/policy content, not product launches.
- Pricing for Channels specifically is not broken out — it appears to be included in existing subscription tiers with no additional cost.
- The Claude Agent SDK changelog (https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md) was not directly fetched — it's unclear if `CronCreate`/`CronList`/`CronDelete` are exposed in the SDK outside of CLI sessions.
- Desktop scheduled tasks (durable, GUI-based) were mentioned but not deeply researched — see https://code.claude.com/docs/en/desktop#schedule-recurring-tasks for details.

---

## Sources

- **Channels official docs**: https://code.claude.com/docs/en/channels
- **Channels reference (build your own)**: https://code.claude.com/docs/en/channels-reference
- **Scheduled tasks official docs**: https://code.claude.com/docs/en/scheduled-tasks
- **Claude Code changelog**: https://code.claude.com/docs/en/changelog
- **GitHub releases**: https://github.com/anthropics/claude-code/releases
- **Official channel plugins source**: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins
- **VentureBeat coverage**: https://venturebeat.com/orchestration/anthropic-just-shipped-an-openclaw-killer-called-claude-code-channels
- **The Decoder coverage (channels)**: https://the-decoder.com/anthropic-turns-claude-code-into-an-always-on-ai-agent-with-new-channels-feature/
- **The Decoder coverage (scheduled tasks)**: https://the-decoder.com/anthropic-turns-claude-code-into-a-background-worker-with-local-scheduled-tasks/
- **Releasebot March 2026 notes**: https://releasebot.io/updates/anthropic/claude-code
- **AI Base coverage**: https://www.aibase.com/news/26401
- **Anthropic news page**: https://www.anthropic.com/news
- **Claude API pricing**: https://platform.claude.com/docs/en/about-claude/pricing
