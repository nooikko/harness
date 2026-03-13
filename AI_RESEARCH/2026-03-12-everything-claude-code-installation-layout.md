# Research: everything-claude-code — Installation & File Layout
Date: 2026-03-12

## Summary

Complete map of the affaan-m/everything-claude-code (ECC) repo: exact file structure,
where every artifact type lives, how installation works, what goes to ~/.claude/ vs
the project directory, the plugin manifest format, and the hooks.json schema used by
Claude Code v2.1+.

## Prior Research
- `2026-03-12-everything-claude-code-analysis.md` — content/pattern analysis, agent frontmatter format
- `2026-03-12-everything-claude-code-deep-analysis.md` — deep technical reverse-engineering

---

## 1. Repository Root Layout

```
everything-claude-code/
├── README.md
├── CLAUDE.md            # Root system prompt / AGENTS.md equivalent for the ECC repo itself
├── AGENTS.md            # Routing table (16 agents, when to use each)
├── CHANGELOG.md
├── CONTRIBUTING.md
├── TROUBLESHOOTING.md
├── install.sh           # Manual installer (targets: claude, cursor, antigravity)
│
├── agents/              # 17 agent .md files (YAML frontmatter + body)
│   ├── planner.md
│   ├── architect.md
│   ├── code-reviewer.md
│   ├── security-reviewer.md
│   ├── tdd-guide.md
│   ├── build-error-resolver.md
│   ├── e2e-runner.md
│   ├── refactor-cleaner.md
│   ├── doc-updater.md
│   ├── go-reviewer.md
│   ├── go-build-resolver.md
│   ├── database-reviewer.md
│   ├── python-reviewer.md
│   ├── kotlin-reviewer.md
│   ├── chief-of-staff.md
│   ├── loop-operator.md
│   └── harness-optimizer.md
│
├── commands/            # 40+ slash command .md files
│   ├── orchestrate.md
│   ├── tdd.md
│   ├── plan.md
│   ├── code-review.md
│   ├── build-fix.md
│   ├── e2e.md
│   ├── learn.md
│   ├── skill-create.md
│   ├── instinct-status.md
│   ├── instinct-import.md
│   ├── instinct-export.md
│   ├── multi-plan.md
│   ├── multi-execute.md
│   ├── multi-frontend.md
│   ├── multi-backend.md
│   ├── multi-workflow.md
│   ├── checkpoint.md
│   ├── resume-session.md
│   ├── save-session.md
│   ├── sessions.md
│   ├── loop-start.md
│   ├── loop-status.md
│   ├── model-route.md
│   ├── quality-gate.md
│   ├── harness-audit.md
│   ├── verify.md
│   └── ... (40 total)
│
├── skills/              # 65+ skill directories, each with SKILL.md
│   └── continuous-learning-v2/
│       └── hooks/
│           └── observe.sh   # Learning observation hook script
│
├── hooks/
│   └── hooks.json       # Claude Code v2.1+ hook configuration (auto-loaded by plugin system)
│
├── rules/               # "Always-follow" guidelines
│   ├── common/          # Language-agnostic rules
│   └── typescript/      # Language-specific subdirs (go/, python/, swift/, php/)
│
├── scripts/
│   └── hooks/           # Node.js hook implementation scripts
│       ├── run-with-flags.js          # Flag-gated hook runner
│       ├── run-with-flags-shell.sh
│       ├── auto-tmux-dev.js
│       ├── session-start.js
│       ├── session-end.js
│       ├── session-end-marker.js
│       ├── pre-bash-tmux-reminder.js
│       ├── pre-bash-git-push-reminder.js
│       ├── pre-compact.js
│       ├── doc-file-warning.js
│       ├── suggest-compact.js
│       ├── quality-gate.js
│       ├── post-edit-format.js        # Auto-detects Biome or Prettier
│       ├── post-edit-typecheck.js
│       ├── post-edit-console-warn.js
│       ├── post-bash-pr-created.js
│       ├── post-bash-build-complete.js
│       ├── check-console-log.js
│       ├── evaluate-session.js
│       ├── cost-tracker.js
│       └── insaits-security-wrapper.js
│
├── mcp-configs/         # 14 MCP server config files
├── contexts/            # dev.md, research.md, review.md
├── tests/               # 997 internal tests (run-all.js)
├── docs/                # Architecture docs, continuous-learning-v2-spec.md
│
├── .claude-plugin/      # Plugin manifest directory
│   ├── plugin.json      # Minimal plugin metadata (name, version, description)
│   ├── marketplace.json # Marketplace listing with $schema reference
│   └── PLUGIN_SCHEMA_NOTES.md
│
├── .claude/             # Claude Code local config (part of the plugin, loaded by CC)
│   ├── package-manager.json
│   ├── skills/
│   │   └── everything-claude-code/
│   │       └── SKILL.md   # Self-referential skill for developing ECC itself
│   └── homunculus/
│       └── instincts/
│           └── inherited/
│               └── everything-claude-code-instincts.yaml
│
├── .cursor/             # Cursor IDE equivalents (hooks, rules, skills — flattened naming)
├── .codex/              # OpenAI Codex equivalents
└── .opencode/           # OpenCode equivalents (full port: commands, plugins, tools)
```

---

## 2. Agent File Format

Every agent is a `.md` file with YAML frontmatter:

```yaml
---
name: planner
description: Expert planning specialist for complex features and refactoring. Use PROACTIVELY when users request feature implementation, architectural changes, or complex refactoring. Automatically activated for planning tasks.
tools: ["Read", "Grep", "Glob"]
model: opus
---

[Markdown body: methodology, output templates, worked examples]
```

Key fields:
- `name` — identifier used in `/orchestrate custom "planner,architect"` calls
- `description` — the routing hint Claude Code uses to decide when to delegate
- `tools` — allowlist; sandboxes the agent to only those tools
- `model` — explicit model routing (planner/architect/security → opus; reviewer → sonnet; etc.)

Confidence: HIGH (verified by fetching raw agent files)

---

## 3. Installation Methods

### Method A: Plugin Marketplace (Recommended, automatic)

```bash
/plugin marketplace add affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code
```

What this does:
- Installs the plugin to `~/.claude/plugins/everything-claude-code@everything-claude-code/`
- Claude Code v2.1+ automatically loads `hooks/hooks.json` from the plugin directory
- The `CLAUDE_PLUGIN_ROOT` env var is set to the plugin install path at runtime
- **Agents, commands, and skills become available globally to Claude Code**
- Rules are NOT distributed via plugins (upstream limitation — must be manually installed)

### Method B: Manual Installation via install.sh

```bash
git clone https://github.com/affaan-m/everything-claude-code
cd everything-claude-code
./install.sh typescript              # Claude Code (default target)
./install.sh --target cursor typescript    # Cursor IDE
./install.sh --target antigravity python  # Antigravity
```

Destination mapping for the default Claude Code target:

| Source | Destination |
|--------|-------------|
| `agents/` | `~/.claude/agents/` |
| `commands/` | `~/.claude/commands/` |
| `skills/` | `~/.claude/skills/` |
| `rules/common/` | `~/.claude/rules/common/` |
| `rules/typescript/` | `~/.claude/rules/typescript/` |
| `hooks/hooks.json` | Referenced from plugin root (auto-loaded by CC v2.1+) |

Rules preserve their subdirectory structure on Claude/Antigravity targets. On Cursor, rules are flattened with prefixes (`common-coding-style.md`, `typescript-hooks.md`).

### Method C: Selective Copy

Cherry-pick individual files into your project's `.claude/` directory:
- `.claude/agents/` — project-local agents (override global)
- `.claude/commands/` — project-local slash commands
- `.claude/rules/` — project-local always-follow rules

---

## 4. Plugin Manifest Format

### .claude-plugin/plugin.json (minimal — intentionally sparse)

```json
{
  "name": "everything-claude-code",
  "version": "1.8.0",
  "description": "...",
  "author": { "name": "...", "url": "..." },
  "homepage": "https://github.com/affaan-m/everything-claude-code",
  "repository": "https://github.com/affaan-m/everything-claude-code",
  "license": "MIT",
  "keywords": [...]
}
```

CRITICAL: No "hooks" field in plugin.json. Claude Code v2.1+ auto-discovers
`hooks/hooks.json` from the plugin directory. Adding a "hooks" field causes
duplicate detection errors.

### .claude-plugin/marketplace.json

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "everything-claude-code",
  "plugins": [{
    "name": "everything-claude-code",
    "source": "./",
    "version": "1.8.0",
    "category": "workflow",
    "strict": false
  }]
}
```

---

## 5. Hooks Configuration — Complete hooks.json Schema

File: `hooks/hooks.json` (auto-loaded by Claude Code v2.1+ when installed as plugin)

### Hook Event Types

| Event | Fires | Matchers Used |
|-------|-------|---------------|
| `PreToolUse` | Before tool execution | `Bash`, `Write`, `Edit|Write`, `*` |
| `PreCompact` | Before context compression | `*` |
| `SessionStart` | When session begins | `*` |
| `PostToolUse` | After tool execution | `Bash`, `Edit\|Write\|MultiEdit`, `Edit`, `*` |
| `Stop` | After each AI response | `*` |
| `SessionEnd` | When session closes | `*` |

### Hook Entry Structure

```json
{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js\" \"<flag-key>\" \"<script-path>\" \"<modes>\"",
    "async": true,
    "timeout": 30
  }],
  "description": "Human-readable description"
}
```

- `CLAUDE_PLUGIN_ROOT` — runtime env var pointing to plugin install location
- `async: true` — runs in background, does not block the pipeline
- `timeout` — seconds before the hook is killed (10-30s range used)
- modes string — comma-separated: `minimal`, `standard`, `strict` (feature flags for hook behavior)

### All 20 Configured Hooks

**PreToolUse (6):**
1. `Bash` — auto-start dev servers in tmux
2. `Bash` — tmux reminder for long-running commands
3. `Bash` — git push review reminder
4. `Write` — doc file warning (non-standard documentation files)
5. `Edit|Write` — suggest manual compaction at intervals
6. `*` — capture tool observations (continuous learning, async, 10s timeout)
7. `Bash|Write|Edit|MultiEdit` — InsAIts AI security monitor (opt-in via ECC_ENABLE_INSAITS=1)

**PreCompact (1):**
8. `*` — save session state before context compression

**SessionStart (1):**
9. `*` — load previous context + detect package manager; uses a long bash fallback chain
   to find the plugin root across multiple possible install locations

**PostToolUse (7):**
10. `Bash` — log PR URL after gh pr create
11. `Bash` — async build analysis (30s timeout)
12. `Edit|Write|MultiEdit` — quality gate checks (async, 30s)
13. `Edit` — auto-format JS/TS (detects Biome vs Prettier)
14. `Edit` — TypeScript type check on .ts/.tsx edits
15. `Edit` — warn on console.log statements
16. `*` — capture tool results (continuous learning, async, 10s)

**Stop (4):**
17. `*` — check for console.log in modified files
18. `*` — persist session state (async, 10s)
19. `*` — evaluate session for extractable patterns (async, 10s)
20. `*` — track token + cost metrics per session (async, 10s)

**SessionEnd (1):**
21. `*` — session end lifecycle marker (non-blocking)

---

## 6. /orchestrate Command

File: `commands/orchestrate.md`

Enables sequential agent workflows via structured handoff documents.

Usage: `/orchestrate [workflow-type] [task-description]`

Built-in workflow types:
- `feature` — planner → tdd-guide → code-reviewer → security-reviewer
- `bugfix` — planner → tdd-guide → code-reviewer
- `refactor` — architect → code-reviewer → tdd-guide
- `security` — security-reviewer → code-reviewer

Custom: `/orchestrate custom "architect,tdd-guide,code-reviewer" "task"`

Each stage produces a handoff document containing:
- Context and findings
- Modified files
- Open questions
- Recommendations for the next agent

Final output: comprehensive report with all agent outputs, changed files, test results,
security status, and a SHIP/NEEDS WORK/BLOCKED verdict.

Advanced: supports tmux-based worktree orchestration for long-running multi-session workflows
and control-plane snapshots.

---

## 7. Continuous Learning v2

The "instinct" system extracts patterns from sessions into reusable knowledge.

### Architecture

```
PreToolUse  → observe.sh (async)   captures tool invocations
PostToolUse → observe.sh (async)   captures tool results
Stop        → evaluate-session.js  evaluates session for extractable patterns
Stop        → session-end.js       persists session state
```

### Instinct File Format

`~/.claude/homunculus/instincts/inherited/everything-claude-code-instincts.yaml`

```yaml
# instincts with confidence scores 0.84–0.90
- description: "Apply conventional commit prefixes (feat:, fix:, docs:, etc.)"
  confidence: 0.90
  ...
```

### Commands

- `/learn` — trigger pattern extraction from current session
- `/instinct-status` — show current instincts with confidence scores
- `/instinct-import <file>` — import instincts from YAML
- `/instinct-export` — export current instincts to YAML
- `/skill-create` — generate SKILL.md from git history analysis

### SKILL.md Format

Skills live in directories: `skills/<name>/SKILL.md`

The skill directory can also contain:
- `agents/openai.yaml` — OpenAI-compatible agent definition for that skill
- `STYLE_PRESETS.md` — style configuration (e.g. frontend-slides skill)

---

## 8. Cross-Platform Architecture

The repo maintains parallel implementations for 4 targets:

| Target | Config Location | Notes |
|--------|----------------|-------|
| Claude Code | `agents/`, `commands/`, `hooks/`, `.claude/` | Primary source of truth |
| Cursor | `.cursor/hooks/`, `.cursor/rules/`, `.cursor/skills/` | Rules flattened with lang prefix |
| Codex | `.codex/agents/*.toml`, `.codex/config.toml` | TOML format |
| OpenCode | `.opencode/` | Full TypeScript port with plugins/tools |

Rule: Root repo is source of truth. Changes are intentionally mirrored to other targets.

---

## 9. What Goes Where — Adoption Decision Matrix

For adopting ECC patterns in a project like Harness:

### Global (~/.claude/) — user-level, applies to all Claude Code sessions
- All 17 agents (`~/.claude/agents/`)
- All 40+ commands (`~/.claude/commands/`)
- All 65+ skills (`~/.claude/skills/`)
- Hooks (auto-loaded from plugin dir, or copied to `~/.claude/settings.json`)
- Rules (`~/.claude/rules/`)

### Project-local (.claude/ in repo) — overrides global, version-controlled
- Project-specific agents (e.g., a harness-specific planner with knowledge of the codebase)
- Project-specific commands (like the existing /do, /review, /handoff skills in Harness)
- Project-specific rules (like Harness's existing .claude/rules/ files)
- Project-specific settings (hooks config in .claude/settings.json or separate hooks.json)

### Collision behavior
- Project-local .claude/agents/ takes precedence over ~/.claude/agents/
- Same for commands and skills
- Hooks: Claude Code merges hooks from plugin + local settings.json (does NOT override)

---

## 10. Key Gotchas

1. **No "hooks" in plugin.json** — Claude Code v2.1+ auto-loads hooks/hooks.json from
   plugin root. Adding a "hooks" key to plugin.json causes duplicate detection errors.

2. **Rules not distributed via plugins** — This is an upstream Claude Code limitation.
   Rules (always-follow guidelines) must be manually copied to ~/.claude/rules/ or
   placed in the project's .claude/rules/. They cannot be installed via the plugin
   marketplace mechanism.

3. **CLAUDE_PLUGIN_ROOT** — All hook scripts reference this env var. When installed as
   a plugin, Claude Code sets it automatically. For manual installation, you need to
   ensure hook commands use the correct absolute paths.

4. **SessionStart plugin root resolution** — The session-start hook uses an elaborate
   fallback bash chain to find the plugin root across multiple possible install locations:
   - `${CLAUDE_PLUGIN_ROOT}`
   - `~/.claude/plugins/everything-claude-code`
   - `~/.claude/plugins/everything-claude-code@everything-claude-code`
   - `~/.claude/plugins/marketplace/everything-claude-code`
   This is required because SessionStart fires before CLAUDE_PLUGIN_ROOT is reliably set.

5. **Minimum version: Claude Code CLI v2.1.0+** — The plugin marketplace, auto-hook-loading,
   and CLAUDE_PLUGIN_ROOT env var all require v2.1+.

6. **Skills directory structure** — `.agents/skills/` (note the dot-prefix) contains
   OpenAI-compatible skill definitions separate from `skills/` (Claude Code skills).
   These are different things. The `.agents/` directory is for cross-platform OpenAI-format
   agent definitions.

---

## Sources

- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/README.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/CLAUDE.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/AGENTS.md`
- `https://api.github.com/repos/affaan-m/everything-claude-code/git/trees/main?recursive=1`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/commands/orchestrate.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/.claude-plugin/plugin.json`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/.claude-plugin/marketplace.json`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/hooks/hooks.json`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/agents/planner.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/agents/code-reviewer.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/.claude/skills/everything-claude-code/SKILL.md`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/.claude/homunculus/instincts/inherited/everything-claude-code-instincts.yaml`
- `https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/docs/continuous-learning-v2-spec.md`
- Research date: 2026-03-12
- ECC version: 1.8.0
