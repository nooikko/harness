# Research: Claude Code Scheduled Tasks
Date: 2026-03-20

## Summary

Claude Code v2.1.71 (released ~early March 2026) introduced native scheduling via the `/loop` command and three underlying tools (`CronCreate`, `CronList`, `CronDelete`). There are two distinct scheduling tiers: **session-scoped tasks** (CLI, lives only while the terminal is open) and **durable Desktop tasks** (Claude Desktop app, survives restarts). They are complementary, not competing — the official docs explicitly describe both and recommend each for different use cases.

## Prior Research
None on this specific topic. Related prior research:
- `2026-03-12-everything-claude-code-deep-analysis.md` — broad Claude Code capabilities overview

## Current Findings

### 1. What Are Claude Code Scheduled Tasks?

There are two distinct implementations under the same umbrella name:

**A. Session-Scoped Tasks (CLI, v2.1.71+)**
Cron jobs that live inside a running Claude Code session. Created via the `/loop` command or the `CronCreate` tool. They fire between turns while Claude is idle. They are wiped when the session exits. Hard limit of 50 tasks per session. Auto-expire after 3 days.

**B. Desktop Scheduled Tasks (Claude Desktop App)**
Durable recurring tasks with a graphical UI. Each task starts a fresh, independent session when it fires. Stored on disk at `~/.claude/scheduled-tasks/<task-name>/SKILL.md`. Survive app restarts. Support catch-up runs (one catch-up per missed window, up to 7 days back). Require the desktop app to be open and the computer to be awake.

---

### 2. Cron-Like Recurring vs One-Shot?

**Both are supported.**

Session-scoped (CLI):
- **Recurring**: `/loop 5m check if the deployment finished` — fires every 5 minutes until cancelled or session ends.
- **One-shot**: Plain language — "remind me at 3pm to push the release branch" or "in 45 minutes, check whether the integration tests passed". Claude sets a single-fire cron that self-deletes after running.

Desktop:
- **Recurring**: Frequency options are Manual (on-demand only), Hourly, Daily, Weekdays, Weekly. For custom intervals (every 15 minutes, monthly, etc.), describe it in plain language to Claude in any session.
- **No explicit one-shot option** in the Desktop UI, but you can set Manual frequency and use Run Now.

---

### 3. How Are Tasks Created?

**CLI / Session-Scoped:**
- `/loop <interval> <prompt>` — natural language shorthand (e.g., `/loop 30m check the build`)
- Direct tool call: `CronCreate` accepts a 5-field cron expression, the prompt, and a `recurring` boolean
- Natural language to Claude: "in 45 minutes, check the tests"
- `/loop <interval> /<skill>` — loop over another command (e.g., `/loop 20m /review-pr 1234`)

**Desktop:**
- GUI: click **Schedule** in the sidebar → **+ New task**, fill in Name, Description, Prompt, Frequency, folder, model, permission mode
- Natural language in any Desktop session: "set up a daily code review that runs every morning at 9am"
- On disk: edit `~/.claude/scheduled-tasks/<task-name>/SKILL.md` directly (YAML frontmatter for name/description, prompt as body)

---

### 4. What Triggers Them?

**Session-scoped tasks:**
- The scheduler checks every second for due tasks. Fires between turns, never mid-response.
- If Claude is busy when a task is due, the prompt waits until the current turn ends (no catch-up for the missed interval — fires once, then resumes normal cadence).
- Jitter: up to 10% of the period late (capped at 15 min) for recurring tasks; ±90s for one-shots at top/bottom of hour.
- All times are **local timezone** (not UTC).

**Desktop tasks:**
- Desktop checks the schedule every minute while the app is open.
- Each task gets a fixed stagger delay of up to 10 minutes after the scheduled time (deterministic per task ID).
- Missed runs: on app start or wake, Desktop runs exactly one catch-up for the most recently missed time within the last 7 days. Older misses are discarded.
- Tasks fire **locally on your machine** — app must be open and computer must be awake. "Keep computer awake" setting available in Desktop → Settings → General.

---

### 5. Custom Prompts, Thread Targeting, Agent Context?

**Custom prompts:** Yes, fully arbitrary. You write the prompt exactly as you'd type it in the chat box. The Desktop SKILL.md file stores the prompt as free-form text in the file body.

**Thread targeting (session-scoped):** There is no explicit "thread ID" concept in session-scoped tasks. Tasks fire into the *current session* context. The session itself is the thread.

**Thread targeting (Desktop):** Each Desktop scheduled task fires into its own fresh, independent session. It does not target an existing conversation thread. Sessions appear under a "Scheduled" section in the sidebar.

**Agent context:** Desktop tasks have configurable settings per-task: model (Sonnet/Opus/Haiku), permission mode (Ask/Auto accept edits/Plan mode/Bypass), and working folder. Session-scoped tasks inherit the current session's model and permission mode.

**Worktree isolation (Desktop):** Optional — a per-task toggle isolates each run in its own Git worktree, the same way parallel sessions work.

**MCP servers / Connectors:** Session-scoped tasks have access to whatever MCP tools are loaded in the running session. Desktop tasks get access to all configured MCP servers (same as any local or SSH session).

**Skills/commands:** Session-scoped tasks can loop over skill invocations (e.g., `/loop 20m /review-pr 1234`). Desktop tasks can call any skill in their SKILL.md prompt.

---

### 6. How Do They Compare to `claude -p` on a Shell Cron?

| Dimension | `claude -p` on shell cron | Session-scoped `/loop` | Desktop scheduled tasks |
|---|---|---|---|
| **Persistence** | Fully durable — runs when machine is awake, no app needed | Dies when session exits | Durable as long as Desktop app is open |
| **Context continuity** | No session continuity (new subprocess each time) unless you manage `--session-id` | Shares session state and conversation history | Fresh session per run (no persistent history across runs) |
| **Scheduling mechanism** | External cron daemon (`crontab`) | Internal session scheduler (CronCreate) | Desktop app scheduler (GUI/SKILL.md) |
| **Natural language scheduling** | No — must write raw cron expressions in crontab | Yes — `/loop 5m check the build` | Yes — GUI picker or plain language to Claude |
| **Tool access** | Whatever the CLI is configured with | Full session tool context (MCP, skills, connectors) | Full configured MCP/plugins for local/SSH sessions |
| **Permission mode** | Controlled by `--permission-mode` CLI flag or settings | Inherits current session mode | Per-task setting |
| **Agent context** | Set via `--model`, env vars | Inherits current session model | Per-task model setting |
| **Catch-up behavior** | Depends on cron daemon (usually fires on next tick) | No catch-up — misses are skipped | One catch-up run per task (most recently missed, up to 7 days) |
| **Auditability** | External — you see nothing in Claude Code UI | Listed via `CronList` or "what scheduled tasks do I have?" | Full history in Desktop sidebar with run status |
| **Auto-expiry** | Never (must manage manually) | 3-day hard expiry | No expiry (manual deletion) |
| **Worktree isolation** | Not built-in (DIY) | Not available | Optional per-task toggle |
| **Prerequisites** | Any environment where `claude` is installed | Must have active Claude Code session | Must have Claude Desktop app installed and open |
| **GitHub Actions integration** | `claude` can be called from a workflow step | N/A | N/A |

**Official guidance:** Anthropic's own docs position `claude -p` + GitHub Actions with a `schedule` trigger as the recommended path for automation that needs to run **unattended** (when the machine may be off or no terminal is open). Session-scoped `/loop` is positioned as a lightweight "babysitter" for things happening *during* a work session. Desktop tasks are positioned for recurring personal workflows that need a GUI setup flow.

---

## Key Takeaways

1. **Two tiers, different durability.** Session-scoped = ephemeral, Desktop = durable-while-app-open. Neither is truly headless/serverless — both require either an open terminal or an open desktop app.

2. **`CronCreate`/`CronList`/`CronDelete` are the underlying tools.** `/loop` is syntactic sugar over `CronCreate`. All three are available as direct tool calls during a session.

3. **No concept of "agent identity" or "thread targeting"** in native scheduling. Session-scoped tasks fire in the current session's context. Desktop tasks fire as fresh, independent sessions. Neither has a concept equivalent to Harness's `agentId`/`threadId` on a CronJob record.

4. **3-day auto-expiry on session-scoped tasks** is a meaningful difference from a permanent cron. Designed to bound forgotten loops.

5. **Local timezone** for all cron expressions (not UTC). Standard 5-field cron syntax. No `L`, `W`, `?`, or name aliases.

6. **No custom session ID threading.** Each Desktop task run is a completely fresh session — no carry-forward of prior run history into the next run by default.

7. **Harness's cron plugin is architecturally richer** for multi-agent/multi-thread orchestration: `agentId` FK, `projectId` FK, lazy thread creation, memory scoping across runs (same persistent thread), hot-reload without restart. Claude Code's native scheduler is designed for single-user personal automation, not orchestration.

## Gaps Identified

- No official date stamp on the v2.1.71 changelog entry — release timing inferred as ~March 2026 from third-party coverage (Winbuzzer reported March 9, 2026).
- Desktop scheduled tasks behavior on Windows (vs macOS) not fully documented — the feature appears to be macOS-primary.
- No official comparison document from Anthropic contrasting the two tiers.
- The `SKILL.md` disk format for Desktop tasks is mentioned but not fully spec'd in official docs (only that it uses YAML frontmatter for name/description, prompt as body).

## Sources

- [Run prompts on a schedule — Official Claude Code Docs](https://code.claude.com/docs/en/scheduled-tasks) — PRIMARY SOURCE, full feature spec
- [Use Claude Code Desktop — Official Claude Code Docs](https://code.claude.com/docs/en/desktop#schedule-recurring-tasks) — PRIMARY SOURCE, Desktop tasks spec
- [Claude Code CHANGELOG.md — GitHub](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) — v2.1.71 entry confirming /loop + CronCreate/CronDelete/CronList + CLAUDE_CODE_DISABLE_CRON
- [Claude Code Gets Cron Scheduling — Winbuzzer, March 9, 2026](https://winbuzzer.com/2026/03/09/anthropic-claude-code-cron-scheduling-background-worker-loop-xcxwbn/) — third-party coverage with date
- [Shipyard.build — /loop command background loops](https://shipyard.build/blog/claude-code-background-loops/) — comparison commentary on persistence limits
- [Release notes — Claude Help Center](https://support.claude.com/en/articles/12138966-release-notes) — supplementary release history
