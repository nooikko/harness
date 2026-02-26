# Research: Claude Code Memory and Context File Mechanisms
Date: 2026-02-26

## Summary

Claude Code provides seven distinct file-based mechanisms for loading context and
instructions. They form a strict precedence hierarchy from organization-managed policy
down to auto-generated notes. This document covers every mechanism, its exact file
paths, load timing, update authority, and persistence behavior.

## Prior Research
- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md`

## Sources
All findings sourced from:
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/slash-commands (skills)
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/features-overview
- https://code.claude.com/docs/en/server-managed-settings
- https://code.claude.com/docs/en/permissions
- Confidence: HIGH (official Anthropic docs, /websites/code_claude, Source Reputation: High)

---

## 1. Complete Memory Type Hierarchy (Precedence Order)

| Priority | Type | File/Path | Scope | Who Updates |
|----------|------|-----------|-------|-------------|
| 1 (highest) | Managed policy | `/Library/Application Support/ClaudeCode/` (macOS), `/etc/claude-code/` (Linux/WSL), `C:\Program Files\ClaudeCode\` (Windows) | Organization-wide | IT admin via MDM |
| 2 | Project memory | `CLAUDE.md` (repo root), `.claude/CLAUDE.md` | Team-shared | Humans (committed) |
| 3 | Project rules | `.claude/rules/*.md` (and subdirectories) | Team-shared, path-scoped | Humans (committed) |
| 4 | User memory | `~/.claude/CLAUDE.md` | All projects, personal | Human |
| 5 | Project memory (local) | `CLAUDE.local.md`, `.claude/CLAUDE.local.md` | Project-specific, private | Human (gitignored) |
| 6 | Auto memory | `~/.claude/projects/<project>/memory/MEMORY.md` | Project-specific | Claude writes automatically |

> "More specific instructions take precedence over broader ones."
> — https://code.claude.com/docs/en/memory

---

## 2. CLAUDE.md Files

### Paths
- `CLAUDE.md` — project root (committed, team-shared)
- `.claude/CLAUDE.md` — project-level alternative (committed)
- `CLAUDE.local.md` — project root, gitignored, private overrides
- `.claude/CLAUDE.local.md` — alternative local form
- `~/.claude/CLAUDE.md` — user-level, applies to all projects

### Load Timing
- Files in the **directory hierarchy above** the working directory: loaded in full at
  session start (launch time).
- Files in **child directories** (subdirectories of cwd): loaded on demand, when Claude
  reads a file from that subtree.
- Traversal: starts at cwd, walks up toward filesystem root (excluding root itself),
  reads every `CLAUDE.md` and `CLAUDE.local.md` found along the way.

> "Claude Code searches for memories recursively. It starts from the current working
> directory (cwd) and traverses up towards the root directory, excluding the root
> itself."
> — https://code.claude.com/docs/en/memory

### Size Limits
- Official recommendation: keep under ~500 lines.
- No hard byte limit documented, but content is loaded into context at session start;
  excessive length wastes context window tokens.

> "Keep CLAUDE.md under ~500 lines. Move reference material to skills, which load
> on-demand."
> — https://code.claude.com/docs/en/features-overview

### Who Can Update
- `CLAUDE.md` / `.claude/CLAUDE.md`: humans only; checked into source control.
- `CLAUDE.local.md`: humans only; auto-added to `.gitignore` by Claude Code when created.
- Auto memory (MEMORY.md): Claude writes; see Section 7.

### Persistence
- Yes — files are on disk and loaded every session start.
- CLAUDE.local.md is gitignored so it persists on the local machine only.

---

## 3. @import Syntax

CLAUDE.md files support importing other files using `@path/to/import` syntax.

```markdown
See @README.md for project overview and @package.json for available npm commands.

# Additional Instructions
- Git workflow: @docs/git-instructions.md
- Personal overrides: @~/.claude/my-project-instructions.md
```

### Rules
- Both **relative and absolute paths** are supported. Relative paths resolve from the
  location of the file containing the import, NOT the current working directory.
- Imported files can **recursively import** other files, up to a **maximum depth of 5 hops**.
- Imports are NOT processed within markdown code spans or code blocks.
- `@~/.claude/...` syntax supports home-directory imports (useful for sharing
  instructions across git worktrees without committing them).
- `@${CLAUDE_PLUGIN_ROOT}/config.json` — plugin-portable path variable.

### First-Use Approval
> "When Claude Code encounters external imports for the first time within a project, it
> presents an approval dialog listing the specific files to be loaded. Users must approve
> these imports to enable them; declining will skip them. This decision is
> project-specific and one-time; once declined, the dialog will not reappear."
> — https://code.claude.com/docs/en/memory

### Viewing All Loaded Files
The `/memory` command lists all currently loaded memory files and opens a file selector.

---

## 4. .claude/rules/ Directory (Path-Scoped Rules)

### Path
`.claude/rules/` (project-level, committed to source control)

### What It Does
Organizes instructions into multiple focused markdown files instead of one monolithic
CLAUDE.md. All `.md` files in `.claude/rules/` are automatically loaded as project memory
with the **same priority as `.claude/CLAUDE.md`**.

> "For larger projects, organizing instructions into multiple files within the
> `.claude/rules/` directory is recommended."
> — https://code.claude.com/docs/en/memory

### Subdirectories
Files are discovered and loaded recursively. Example structure:
```
.claude/rules/
  frontend/
    react-patterns.md
    styling.md
  backend/
    api-conventions.md
  general.md
```

### Path-Scoped Rules (Conditional Loading)
Rules can be scoped to specific files using YAML frontmatter:

```yaml
---
paths:
  - "**/*.ts"
  - "src/components/*.tsx"
---
TypeScript-specific instructions here.
```

- Rules without a `paths` field load unconditionally.
- Rules with `paths` only apply when Claude is working with matching files.
- Supports glob patterns: `**/*.ts`, `src/**/*`, `*.md`, brace expansion.

### Symlinks
The `.claude/rules/` directory supports symlinks for sharing rule sets across projects.
Circular symlinks are detected and handled gracefully.

### Who Can Update
Humans only; committed to source control and shared with the team.

---

## 5. Skills (.claude/skills/ and ~/.claude/skills/)

### Paths and Scope

| Location | Scope | Priority |
|----------|-------|----------|
| Enterprise (managed settings) | All org users | 1 (highest) |
| `~/.claude/skills/<skill-name>/SKILL.md` | All your projects | 2 |
| `.claude/skills/<skill-name>/SKILL.md` | Current project | 3 |
| Plugin's `skills/` directory | Where plugin is active | 4 (lowest) |

When skills share the same name, higher-priority location wins.
Plugin skills use `plugin-name:skill-name` namespace to avoid conflicts.
If a skill and a command share the same name, the skill takes precedence.

### SKILL.md Structure
Each skill is a directory with a `SKILL.md` file using YAML frontmatter:

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
user-invocable: false
---

Deploy $ARGUMENTS to production:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

### Frontmatter Fields
- `name` — skill name (used for `/skill-name` invocation)
- `description` — helps Claude understand when to auto-invoke the skill
- `context` — execution context (e.g., `fork`)
- `disable-model-invocation: true` — prevents Claude from triggering it automatically;
  only user `/skill-name` invocation works
- `user-invocable: false` — prevents user from invoking directly; Claude-only trigger
- `allowed-tools` — restricts which tools the skill can use

### Load Timing
Skills load **on-demand** only when invoked (not at session start). This is the key
advantage over CLAUDE.md: specialized instruction sets that don't consume context tokens
on every session.

### Types of Content
- **Reference content**: knowledge/conventions Claude applies inline alongside conversation.
- **Task content**: step-by-step instructions for specific actions, invoked with `/skill-name`.

### Who Can Update
Humans only.

---

## 6. Agents (.claude/agents/ and ~/.claude/agents/)

### Paths and Scope

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All your projects | 3 |
| Plugin's `agents/` directory | Where plugin is active | 4 (lowest) |

When multiple subagents share the same name, the higher-priority location wins.

### Agent File Structure
Markdown files with YAML frontmatter:

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
memory: user
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

### Frontmatter Fields
- `name` — agent identifier
- `description` — when Claude should delegate to this agent
- `tools` — allowed tool list (comma-separated)
- `model` — `sonnet`, `opus`, `haiku`, etc.
- `memory` — persistence scope: `user`, `project`, or `local`

### Agent Memory Persistence
The `memory` field in agent frontmatter determines where the agent stores its learnings
across conversations. This is separate from the user's CLAUDE.md / auto memory system.

### Who Can Update
Humans only. Agents run in their own isolated context.

---

## 7. Auto Memory (Claude-Written Notes)

### Path
`~/.claude/projects/<project>/memory/`

- `<project>` is derived from the **git repository root** path.
- All subdirectories of a repo share one auto memory directory.
- Git worktrees get **separate** memory directories.
- Non-git projects use the working directory path instead.
- The directory contains `MEMORY.md` as entrypoint and can contain additional
  topic-specific `.md` files.

### Load Timing and Limits
- Loads at session start.
- Only the **first 200 lines** of `MEMORY.md` are loaded.
- Additional topic files in the directory can be loaded via import or on-demand.

### Who Writes It
Claude writes auto memory automatically during sessions. Users can also:
- Give explicit commands: "remember that we use pnpm, not npm"
- Give explicit commands: "save to memory that the API tests require a local Redis instance"
- Edit files directly via `/memory` command (opens file selector)

### Environment Variable Controls
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` — force auto memory OFF
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0` — force auto memory ON

### Persistence
Yes — persists across sessions. Plain markdown files; editable at any time.

---

## 8. Settings Files (settings.json / settings.local.json)

Settings files configure **behavior and permissions**, not instructions/context. They are
distinct from memory files but part of the overall configuration system.

### Paths and Scope

| Path | Scope | Committed? |
|------|-------|-----------|
| `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS) | Organization-wide | Via MDM |
| `/etc/claude-code/managed-settings.json` (Linux/WSL) | Organization-wide | Via MDM |
| `~/.claude/settings.json` | All projects, personal | No (local only) |
| `.claude/settings.json` | Current project | Yes (team-shared) |
| `.claude/settings.local.json` | Current project | No (auto-gitignored) |

### What settings.json Contains
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "sonnet",
  "availableModels": ["sonnet", "haiku"],
  "permissions": {
    "allow": ["Bash(npm run lint)", "Bash(npm run test *)", "Read(~/.zshrc)"],
    "deny": ["Bash(curl *)", "Read(./.env)", "Read(./secrets/**)", "Read(./build)"]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  },
  "companyAnnouncements": ["..."],
  "disableBypassPermissionsMode": "disable",
  "enabledPlugins": { "plugin-name@marketplace": true },
  "hooks": { ... }
}
```

### Precedence
Managed settings (system directories) override all. User/project settings are merged;
more specific settings add to or override broader ones.

### Who Can Update
- `managed-settings.json`: IT admin via MDM/Ansible/Group Policy.
- `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`: humans.
- Settings are NOT auto-updated by Claude.

---

## 9. Hooks (.claude/settings.json hooks section)

Hooks are shell commands triggered by Claude Code lifecycle events. Configured inside
settings files (not standalone files, except for plugins which use `hooks/hooks.json`).

### Hook Locations and Scope

| Location | Scope |
|----------|-------|
| `~/.claude/settings.json` | All projects (personal) |
| `.claude/settings.json` | Current project (committed) |
| `.claude/settings.local.json` | Current project (local only) |
| Plugin `hooks/hooks.json` | Where plugin is active |
| Skill/agent frontmatter | When that component is active |
| Managed policy | Organization-wide |

### Hook Event Types
- `SessionStart` — fires when a session begins
- `PreToolUse` — fires before a tool call (with `matcher` for tool name filtering)
- `PostToolUse` — fires after a tool call
- Others exist (see hooks documentation)

### Example
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/filter-test-output.sh" }]
      }
    ]
  }
}
```

### Reload Behavior
Changes made by directly editing settings files while Claude Code is running require a
session restart or a visit to `/hooks` to take effect. Hooks added via the `/hooks` menu
apply immediately.

---

## 10. Managed Policy (Enterprise / Organization Level)

### System Paths
- macOS: `/Library/Application Support/ClaudeCode/`
- Linux/WSL: `/etc/claude-code/`
- Windows: `C:\Program Files\ClaudeCode\`

Files deployed here: `managed-settings.json`, `managed-mcp.json`

### Two Deployment Approaches
1. **Endpoint-managed** (MDM/Group Policy/Ansible): deploy JSON files to system
   directories. Stronger security — OS-level protection from user modification.
2. **Server-managed** (cloud-based): configuration delivered from Anthropic's servers
   at authentication time. Better for unmanaged devices.

### Managed CLAUDE.md
Organizations can also deploy centrally managed CLAUDE.md files:
> "Organizations can deploy centrally managed CLAUDE.md files that apply to all users.
> To set this up, create the managed memory file at the designated Managed policy
> location and then deploy it via your configuration management system."
> — https://code.claude.com/docs/en/memory

### Plugin Marketplace Control
Managed deployments can restrict plugin marketplace additions using `strictKnownMarketplaces`.

---

## 11. --add-dir Flag (Additional Directories)

The `--add-dir` CLI flag lets Claude access directories beyond the main working directory.

By default, CLAUDE.md files from additional directories are NOT loaded.

To enable loading memory files (`CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`)
from these extra directories:
```bash
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir /path/to/other
```

---

## Key Takeaways

### Load Timing Summary
| Mechanism | When It Loads |
|-----------|---------------|
| Managed policy CLAUDE.md | Session start (always) |
| `~/.claude/CLAUDE.md` | Session start (always) |
| `CLAUDE.md` / `.claude/CLAUDE.md` in ancestor dirs | Session start (always) |
| `.claude/rules/*.md` | Session start (always) |
| `CLAUDE.local.md` in ancestor dirs | Session start (always) |
| Auto memory `MEMORY.md` (first 200 lines) | Session start (always) |
| CLAUDE.md in subdirectories | On demand (when files in that subtree are read) |
| Skills (`SKILL.md`) | On demand (when invoked) |
| Agents (`agents/*.md`) | On demand (when delegated to) |

### Update Authority
| Mechanism | Human | Claude |
|-----------|-------|--------|
| CLAUDE.md variants | Yes | No |
| .claude/rules/ | Yes | No |
| Skills | Yes | No |
| Agents | Yes | No |
| settings.json | Yes | No |
| Auto memory (MEMORY.md) | Yes (via /memory) | Yes (automatically) |

### Monorepo / Plugin Codebase Guidance
- Use **`.claude/rules/`** with subdirectory organization for large teams instead of
  one giant CLAUDE.md. Topic-specific files are easier to maintain.
- Use **path-scoped rules** (`paths` frontmatter) in `.claude/rules/` to apply
  TypeScript rules only to `.ts` files, React rules only to `*.tsx`, etc.
- Use **`@import`** to reference `README.md`, `package.json`, or existing docs rather
  than duplicating content into CLAUDE.md.
- Use **skills** for specialized workflows (e.g., a `/review` skill) so instructions
  load only when invoked, not on every session start.
- Use **`CLAUDE.local.md`** for personal developer overrides that should not be
  committed (e.g., local API keys, personal preferences).
- Keep root CLAUDE.md under ~500 lines; move deep reference material to skills.
- Auto memory is keyed to the **git repository root**, so all packages in a monorepo
  share one auto memory directory.

## Sources
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/features-overview
- https://code.claude.com/docs/en/server-managed-settings
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/costs
- Context7 library: /websites/code_claude (Source Reputation: High, 1674 snippets)
