# Research: OpenClaw Default Agent and Onboarding Flow
Date: 2026-03-04

## Summary

OpenClaw is an open-source, self-hosted personal AI assistant. It ships with a "bootstrap" ritual
that fires on first run: the agent asks the user a series of natural-language questions (name, vibe,
emoji, connection preferences), writes the answers to a set of Markdown files (IDENTITY.md, USER.md,
SOUL.md), then deletes the BOOTSTRAP.md script so the ritual only ever runs once.

## Prior Research
None — first time researching this topic.

## Current Findings

### What OpenClaw Is

- Self-hosted personal AI assistant; runs as a single long-lived Node.js Gateway process
- Supports many channels: WhatsApp, Telegram, Discord, iMessage, Signal, Google Chat, Slack, etc.
- MIT-licensed, open-source: https://github.com/openclaw/openclaw
- Agent workspace lives at `~/.openclaw/workspace` as plain Markdown + YAML files
- Official docs: https://openclaw.ai / https://docs.openclaw.ai

### The Default Agent + First-Run Bootstrap Flow

OpenClaw ships with a `BOOTSTRAP.md` template file that acts as a one-time onboarding script.

**How it triggers:**
- The `BOOTSTRAP.md` file is seeded into the workspace by `openclaw onboard` / `openclaw configure` / `openclaw setup`
- On the very first conversation, the agent reads BOOTSTRAP.md and runs the ritual
- IMPORTANT gotcha (from official docs): if your first message is a real question, the agent
  prioritizes answering that instead of running bootstrap. The recommended first message is:
  > "Hey, let's get you set up. Read BOOTSTRAP.md and walk me through it"

**What BOOTSTRAP.md instructs the agent to do (verbatim summary from official template):**
- "Don't interrogate. Don't be robotic. Just... talk."
- Introduce itself naturally and start a conversation
- Explore four key areas, one question at a time:
  1. **Name** — What should the user call the agent?
  2. **Nature** — What type of entity is it?
  3. **Vibe** — Communication style (formal, casual, snarky, warm)?
  4. **Emoji** — A signature identifier
- Also covers connection preferences and interaction style
- After the conversation, write to three files:
  - `IDENTITY.md` — agent name, nature, style, emoji
  - `USER.md` — user name, preferred address, timezone, notes
  - `SOUL.md` — values, behavioral expectations, boundaries, preferences
- Final instruction: "Delete this file. You don't need a bootstrap script anymore — you're you now."

**Result:** BOOTSTRAP.md is deleted after completion so it never runs again. The agent's identity
is now fully baked into the workspace files.

### Agent Workspace Files (Injected Every Session)

| File | Purpose |
|------|---------|
| `AGENTS.md` | Operating instructions, memory rules, behavioral guidelines |
| `SOUL.md` | Persona, tone, boundaries — refreshed each session |
| `USER.md` | Who the user is, how to address them — loaded every session |
| `IDENTITY.md` | Agent name, personality style, emoji — created during bootstrap |
| `TOOLS.md` | Local tool conventions and guidance |
| `BOOTSTRAP.md` | One-time ritual script; deleted after first run |
| `HEARTBEAT.md` | Optional periodic automation checklist |
| `BOOT.md` | Optional startup checklist on gateway restart |
| `memory/` | Daily logs (`YYYY-MM-DD.md`) + optional `MEMORY.md` for long-term retention |

### CLI Onboarding Wizard (`openclaw onboard`)

Separate from the in-chat bootstrap, OpenClaw also has a CLI wizard that runs before the gateway
starts. It handles infrastructure config, not personality:

1. Model + authentication (OpenAI, Anthropic, custom)
2. Workspace location
3. Gateway port and bind address
4. Channels (WhatsApp, Telegram, Discord, etc.)
5. Daemon installation (LaunchAgent on macOS, systemd on Linux)
6. Health verification
7. Skills installation

Two modes: QuickStart (safe defaults) and Advanced (full control).

### What Is NOT in the CLI Wizard

The wizard does NOT handle: naming the agent, setting personality, or filling USER.md.
Those happen in-chat via BOOTSTRAP.md.

## Key Takeaways

1. **Two-phase setup:** CLI wizard handles infrastructure; BOOTSTRAP.md handles identity/personality
2. **Conversational onboarding:** The agent asks questions naturally in chat, one at a time — not a form
3. **Files-as-state:** Identity is stored as Markdown files, not a database. Editable by hand.
4. **Self-destructing script:** BOOTSTRAP.md deletes itself after completion — clean "rite of passage"
5. **Gotcha:** First message must explicitly invoke bootstrap or the agent ignores it
6. **Multi-agent:** `openclaw agents add <name>` creates additional agents; each gets its own workspace

## Sources

- OpenClaw official site: https://openclaw.ai/
- GitHub repository: https://github.com/openclaw/openclaw
- Onboarding wizard docs: https://docs.openclaw.ai/start/wizard
- Bootstrapping docs: https://docs.openclaw.ai/start/bootstrapping
- BOOTSTRAP.md template: https://docs.openclaw.ai/reference/templates/BOOTSTRAP
- Agent workspace docs: https://openclawlab.com/en/docs/concepts/agent-workspace/
- Mirror bootstrapping docs: https://openclawcn.com/en/docs/start/bootstrapping/
- BOOTSTRAP.md mirror template: https://openclawcn.com/en/docs/reference/templates/bootstrap/
- GitHub issue (bootstrap injection bug): https://github.com/openclaw/openclaw/issues/3775
- DEV.to tutorial: https://dev.to/mfs_corp/openclaw-101-building-your-first-ai-agent-no-cloud-required-2ge9
- Every.to article: https://every.to/source-code/openclaw-setting-up-your-first-personal-ai-agent
