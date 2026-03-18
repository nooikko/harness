# Research: Trail of Bits Skills — Claude Code Installation

Date: 2026-03-18

## Summary

The Trail of Bits skills marketplace is real, actively maintained, and uses Claude Code's native plugin/marketplace system introduced in Claude Code v1.0.33+. The prior agent's claim of `/plugin marketplace add trailofbits/skills` is CORRECT — it was not hallucinated. However, the broader concept of a "plugin marketplace" was itself a new feature in Claude Code that the prior agent may not have had full context on.

## Repos — All Verified Real

All repos confirmed via GitHub API (public, under `trailofbits` org):

| Repo | Created | Description |
|------|---------|-------------|
| `trailofbits/skills` | 2026-01-14 | Main skills marketplace — 30+ security plugins |
| `trailofbits/claude-code-config` | 2026-02-04 | Opinionated Claude Code setup guide for ToB |
| `trailofbits/skills-curated` | 2026-02-06 | Community-vetted third-party marketplaces |
| `trailofbits/mcp-context-protector` | (exists) | MCP security wrapper (separate tool) |

## The Claude Code Plugin/Marketplace System

Claude Code introduced a native plugin/marketplace system (requires v1.0.33+). This is a first-party Anthropic feature with official documentation at `code.claude.com/docs/en/discover-plugins`.

### How it works

A marketplace is a git repo containing `.claude-plugin/marketplace.json` at the root. Individual plugins live in subdirectories and each contain:
- `.claude-plugin/plugin.json` — plugin metadata (name, version, description, author)
- `skills/` — markdown SKILL.md files that define behavioral guidance for Claude
- `commands/` — markdown .md files that define slash commands (e.g., `audit-context.md` -> `/trailofbits:audit-context`)
- `agents/` — agent definitions
- `README.md` — documentation

Skills are NOT npm packages. They are markdown documents with YAML frontmatter that give Claude behavioral instructions. Commands are similarly markdown files with YAML frontmatter specifying allowed tools and argument hints.

### The SKILL.md format (confirmed from source)

```yaml
---
name: audit-context-building
description: Enables ultra-granular, line-by-line code analysis to build deep architectural context
---

# [Skill content in markdown...]
```

### The command .md format (confirmed from source)

```yaml
---
name: trailofbits:audit-context
description: Builds deep architectural context before vulnerability hunting
argument-hint: "<codebase-path> [--focus <module>]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
---
```

## Actual Installation Methods (All Verified)

### Method 1: Claude Code Plugin Marketplace (PRIMARY — for Claude Code users)

Run inside a Claude Code session:

```
/plugin marketplace add trailofbits/skills
```

Then browse and install individual plugins:

```
/plugin menu
```

Or install a specific plugin directly:

```
/plugin install audit-context-building@trailofbits
```

After installing, apply without restarting:

```
/reload-plugins
```

**Requirement:** Claude Code v1.0.33 or later. Check with `claude --version`.

### Method 2: Guided setup via claude-code-config (RECOMMENDED for first-time setup)

```bash
git clone https://github.com/trailofbits/claude-code-config.git
cd claude-code-config
claude
```

Then inside the Claude session run:
```
/trailofbits:config
```

This walks through installing each component interactively.

### Method 3: Codex (OpenAI Codex users, not Claude Code)

```bash
git clone https://github.com/trailofbits/skills.git ~/.codex/trailofbits-skills
~/.codex/trailofbits-skills/.codex/scripts/install-for-codex.sh
```

Codex-native skill discovery uses `.codex/skills/` subdirectory tree. This path is for Codex users only.

### Method 4: Local development / testing

```bash
# Navigate to PARENT directory of the cloned repo
cd /path/to/parent
/plugins marketplace add ./skills
```

## Available Plugin Categories

Confirmed 30+ plugins across:
- Smart Contract Security (building-secure-contracts, entry-point-analyzer, etc.)
- Code Auditing (audit-context-building, differential-review, sharp-edges, static-analysis, etc.)
- Malware Analysis (yara-authoring)
- Verification (constant-time-analysis, property-based-testing, zeroize-audit)
- Reverse Engineering (dwarf-expert)
- Mobile Security (firebase-apk-scanner)
- Development utilities

## The Skills-Curated Repo

`trailofbits/skills-curated` is a separate "meta-marketplace" containing community-vetted third-party skills that Trail of Bits has reviewed. Install it the same way:

```
/plugin marketplace add trailofbits/skills-curated
```

## What Was NOT Hallucinated

The prior agent's command `/plugin marketplace add trailofbits/skills` is the correct primary installation method. It is documented directly in the repo's README.md and works via Claude Code's official plugin system.

## What May Have Been Confusing

The `/plugin marketplace add` command is a Claude Code slash command (typed inside a Claude Code session), NOT a shell command. It is easy to confuse with a bash command. The marketplace concept itself only exists in Claude Code v1.0.33+, so users on older versions would see "unknown command".

## Key Takeaways

1. `trailofbits/skills` is real, created January 2026, updated as recently as March 2026
2. Installation is via Claude Code's `/plugin` slash command system, not npm or manual file copying
3. Skills are markdown files (.md / SKILL.md) with YAML frontmatter — behavioral prompts, not code
4. Commands are also markdown files that map to namespaced slash commands (e.g., `/trailofbits:audit-context`)
5. Requires Claude Code v1.0.33+ — check version before troubleshooting
6. There IS an official Anthropic plugin/marketplace system — it was not fabricated
7. There is also an Anthropic-managed official marketplace (`claude-plugins-official`) available by default

## Sources

- `https://github.com/trailofbits/skills` — verified via GitHub API, created 2026-01-14
- `https://github.com/trailofbits/claude-code-config` — verified via GitHub API, created 2026-02-04
- `https://github.com/trailofbits/skills-curated` — verified via GitHub API, created 2026-02-06
- `https://code.claude.com/docs/en/discover-plugins` — official Anthropic docs (fetched directly)
- Direct inspection of `trailofbits/skills` repo tree, marketplace.json, plugin.json, SKILL.md, and command .md files via GitHub API
