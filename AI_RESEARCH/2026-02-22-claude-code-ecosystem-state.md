# Research: Claude Code Ecosystem State (February 2026)
Date: 2026-02-22

## Summary
Comprehensive research into the current state of the Claude Code ecosystem as of February 2026, covering Task Master AI, hooks, MCP servers, configuration best practices, new features, and complementary tools. Targeted at a Next.js + Prisma + pnpm monorepo developer.

## Prior Research
- /mnt/ramdisk/harness/AI_RESEARCH/2026-01-12-ai-agent-prompt-design-best-practices.md (consulted for context)

---

## 1. Task Master AI (task-master-ai)

### Current Version
- **v0.43.0** (released February 4, 2025 per npm/GitHub)
- npm package: `task-master-ai`
- GitHub: https://github.com/eyaltoledano/claude-task-master
- Website: https://www.task-master.dev/

### Status
Still actively maintained and recommended. Claude Code is explicitly supported as a first-class integration (no separate API key required beyond the Claude Code CLI itself).

### Installation for Claude Code
```bash
# Add as MCP server (recommended)
claude mcp add taskmaster-ai -- npx -y task-master-ai

# Or with scope for user-wide access
claude mcp add task-master-ai --scope user \
  --env TASK_MASTER_TOOLS="core" \
  -- npx -y task-master-ai@latest
```

### .taskmaster Folder Structure
```
.taskmaster/
├── config.json          # AI model selections, parameters, project defaults
├── state.json           # Runtime state, current tag context, migration status
├── docs/
│   └── prd.txt          # Your project requirements document (PRD)
└── templates/
    └── example_prd.txt  # Reference template
```

Additionally, individual task files appear in a `tasks/` directory (e.g., `task_001.txt`).

### config.json Structure
```json
{
  "models": {
    "main": { "provider": "anthropic", "modelId": "...", "maxTokens": ..., "temperature": ... },
    "research": { ... },
    "fallback": { ... }
  },
  "global": {
    "logLevel": "info",
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "defaultTag": "master",
    "projectName": "my-project",
    "responseLanguage": "en"
  }
}
```

### Key CLI Commands
- `task-master init` - Initialize project structure
- `task-master list` - View all tasks
- `task-master next` - Get recommended next task
- `task-master show [IDs]` - Display specific tasks
- `task-master set-status --id=X --status=done` - Mark task complete
- `task-master update --from=N --prompt="..."` - Update future tasks
- `task-master models --setup` - Interactive model setup
- `task-master migrate` - Migrate from legacy structure

### Recent Features (v0.40-0.43)
- **v0.43**: MCP Bundle manifest.json for single-click Claude Desktop install, `--verbose` flag for real-time reasoning display
- **v0.42**: `--ready`/`--blocking` task filtering flags, atomic file operations for concurrency safety
- **v0.41**: Loop command for automated task execution with Docker sandbox support, MCP tool annotations
- **v0.40**: Gemini 3 Flash support, auto-detection of 13+ IDEs, watch mode with `-w/--watch`

### Tagged Task Lists
Tasks use a tagged structure where each tag (e.g., "master", "feature-branch") contains its own isolated task list. Useful for monorepos.

---

## 2. Claude Code Hooks

### Official Documentation
https://code.claude.com/docs/en/hooks

### Hook Types (3 categories)
1. **Command Hooks** - Execute shell scripts (deterministic, milliseconds overhead)
2. **Prompt Hooks** - Leverage LLM decision-making for complex conditions
3. **Agent Hooks** - Spawn multi-turn subagents that can read files and execute commands

### 12+ Lifecycle Events (as of Feb 2026)

**Session Events:**
- `SessionStart` - New session begins; load project context
- `PreCompact` - Before context compaction; preserve critical context
- `SessionEnd` - Session terminates

**Tool Events:**
- `PreToolUse` - Before a tool runs; validate or block
- `PostToolUse` - After successful tool completion; format, test, log
- `PostToolUseFailure` - After tool fails
- `PermissionRequest` - Permission evaluation runtime hook

**Agent Events:**
- `SubagentStart` - Subagent is spawned
- `SubagentStop` - Subagent finishes
- `TeammateIdle` - Agent team member goes idle (new in 2026)
- `TaskCompleted` - Agent team task marked complete (new in 2026)
- `Stop` - Main agent completes response

**Other Events:**
- `UserPromptSubmit` - Before AI processes a user prompt; inject context
- `Notification` - Claude sends a notification (idle, permission needed, etc.)
- `ConfigChange` - Settings file changed (for security auditing, added Feb 2026)
- `WorktreeCreate` - Worktree created by isolation (added Feb 2026)
- `WorktreeRemove` - Worktree removed (added Feb 2026)

### Configuration Format
`.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write 2>/dev/null; exit 0"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"decision\":\"block\"}'"
          }
        ]
      }
    ]
  }
}
```

### Exit Code Semantics
- **0** - Success; proceed with action
- **2** - Block/reject the action with feedback
- **Other** - Non-blocking error; continue with feedback logged

### Hook Configuration Levels
- `~/.claude/settings.json` - Global user (applies to all projects)
- `.claude/settings.json` - Project-level (checked into source control, team-shared)
- `.claude/settings.local.json` - Local project preferences (gitignored)

### Interactive Setup
Use `/hooks` command inside Claude Code for menu-driven configuration (easier than editing JSON directly).

### Best Practices
- Use `async: true` for long-running operations that shouldn't block execution
- Hooks do NOT hot-reload; Claude snapshots them at session start. Use `/hooks` to review changes.
- Always quote variables and use absolute paths in hook scripts
- Enterprise can enforce policy hooks org-wide via managed settings

### Practical Use Cases
- Auto-format with Prettier/ESLint after every file write
- Block dangerous `rm -rf` or `DROP TABLE` commands (PreToolUse, exit code 2)
- Auto-approve safe read-only operations (WebFetch, WebSearch)
- Desktop notifications on `Notification` event
- Run tests after code changes
- Security audit on `ConfigChange`

---

## 3. MCP Servers

### Official Documentation
https://code.claude.com/docs/en/mcp

### How to Add MCP Servers
```bash
# CLI method (simplest)
claude mcp add <server-name> -- npx -y <package-name>

# With environment variables
claude mcp add <name> --env KEY=value -- npx -y <pkg>

# User-scope (available across all projects)
claude mcp add <name> --scope user -- npx -y <pkg>
```

### Top Recommended MCP Servers (February 2026)

**Documentation / Context**
- **Context7** (`@upstash/context7-mcp`) - Fetches live, version-specific docs into context. Prevents Claude from using outdated training data. Trigger: add "use context7" in any prompt.
  - Setup: `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest`
  - Free and open-source from Upstash
- **Sequential Thinking** (`@modelcontextprotocol/server-sequential-thinking`) - Structured multi-step reasoning for complex architectural problems

**Version Control**
- **GitHub MCP** - Full GitHub API access: issues, PRs, CI/CD, commits
  - Setup via Composio: `npx @composio/mcp@latest setup github --client claude`

**Database**
- **PostgreSQL MCP** - Natural language database queries; configure DB credentials in settings
- **Prisma MCP** (if available) - Check Prisma docs for official MCP integration

**File System**
- **Official Filesystem MCP** (built into Claude Code) - Granular permissions, directory-limited access, complex refactoring support
  - Package: `@modelcontextprotocol/server-filesystem`

**Browser/Web Automation**
- **Playwright MCP** - Full browser automation and E2E testing
- **Puppeteer MCP** - Web automation, UI testing, data extraction
- **Brave Search MCP** - Web search without exposing user data

**Productivity / External Services**
- **Notion MCP** - Create/update tasks from terminal (OAuth via Composio)
- **Figma MCP** - Design-to-React component conversion (OAuth via Composio)
- **Zapier MCP** - Cross-app workflow automation

**Memory / Persistence**
- **Memory Bank MCP** - Persistent context across sessions; recall recent file edits and decisions

**Developer Tools**
- **Desktop Commander** - Full terminal access with process management and advanced search
- **E2B MCP** - Secure cloud sandbox for Python/JS execution
- **Apidog MCP** - API spec integration; generate code from OpenAPI/Swagger contracts

### Performance Recommendation
Start with 2-3 MCPs that address your biggest pain points. Too many MCPs slow startup. For a Next.js + Prisma + pnpm monorepo, strong choices are: Context7, GitHub MCP, PostgreSQL/Prisma MCP, and Playwright.

---

## 4. Claude Code Configuration

### CLAUDE.md Files

**Official docs:** https://claude.com/blog/using-claude-md-files

**Location hierarchy:**
```
~/.claude/CLAUDE.md          # Personal, cross-project (highest personal priority)
<repo-root>/CLAUDE.md        # Project-level (team-shared via git)
<subdir>/.claude/CLAUDE.md   # Subdirectory/package level (monorepo support)
```

**Generate with `/init`** - Analyzes codebase, generates starter CLAUDE.md automatically.

**Recommended structure:**
```markdown
# Project Name

## Stack
- Next.js 15 (App Router), TypeScript
- Prisma 6 ORM with PostgreSQL
- pnpm workspaces monorepo
- shadcn/ui, Tailwind CSS v4

## Repo Structure
apps/
  web/          # Next.js frontend
  api/          # Express/Hono API (if separate)
packages/
  db/           # Shared Prisma schema + client
  ui/           # Shared UI components
  types/        # Shared TypeScript types

## Key Commands
- pnpm dev           # Start all apps
- pnpm build         # Build all
- pnpm db:migrate    # Run Prisma migrations
- pnpm db:generate   # Generate Prisma client
- pnpm test          # Run vitest
- pnpm lint          # ESLint + Prettier

## Standards
- TypeScript strict mode, no `any`
- All API routes use Zod for validation
- Prisma migrations for all schema changes
- Tests for all business logic (vitest)
- No direct DB queries outside packages/db

## Important Notes
- Prisma client singleton at packages/db/src/client.ts
- Environment variables validated with t3-env
- DO NOT commit .env files
```

**Key best practices:**
- Keep under 150 lines; ruthlessly prune instructions Claude already follows
- Use hierarchical CLAUDE.md files for monorepos (root + per-package)
- Add "When compacting, always preserve [X]" for critical context survival
- Do not include API keys, credentials, or security vulnerability details
- Commit to version control for team sharing

### settings.json

**File locations:**
```
~/.claude/settings.json           # User-global
.claude/settings.json             # Project (committed, team-shared)
.claude/settings.local.json       # Local project (gitignored)
/etc/claude-code/managed-settings.json  # Enterprise (Linux/WSL)
```

**Settings precedence (highest to lowest):**
1. Managed settings (enterprise)
2. Command-line flags
3. `.claude/settings.local.json`
4. `.claude/settings.json`
5. `~/.claude/settings.json`

**Key settings structure:**
```json
{
  "model": "claude-sonnet-4-6",
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Bash(pnpm *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git commit *)",
      "Bash(git log *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Read(src/**)",
      "Read(packages/**)",
      "Read(apps/**)"
    ],
    "deny": [
      "Bash(git push --force *)",
      "Bash(rm -rf *)",
      "Read(.env)",
      "Read(**/.env.local)"
    ]
  },
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Permission modes:**
- `default` - Prompts on first use of each tool
- `acceptEdits` - Auto-accepts file edits for session
- `plan` - Read-only analysis mode; no file modification or command execution
- `dontAsk` - Auto-denies unless pre-approved
- `bypassPermissions` - Skips all checks (containers/VMs only)

**Permission rule syntax:**
- `Bash(npm run *)` - Any npm run command
- `Bash(git * main)` - git commands operating on main
- `Read(./src/**)` - All files under src/
- `Edit(/docs/**)` - Edits in project docs/
- `WebFetch(domain:example.com)` - Fetch from specific domain
- `mcp__puppeteer` - All puppeteer MCP tools
- `Task(Explore)` - Allow Explore subagent

### Custom Slash Commands / Skills

**Official docs:** https://code.claude.com/docs/en/skills

**IMPORTANT CHANGE (v2.1.3):** Slash commands have been merged into the Skills system. Legacy `.claude/commands/` files still work, but skills are now the recommended approach.

**Skill file structure:**
```
.claude/skills/
  skill-name/
    SKILL.md          # Required: instructions + frontmatter
    template.md       # Optional: template for Claude to fill in
    examples/
      sample.md       # Optional: example output
    scripts/
      validate.sh     # Optional: executable scripts
```

**SKILL.md format:**
```yaml
---
name: review-pr
description: Review a pull request for code quality, security, and test coverage
disable-model-invocation: true   # Only user can invoke (not Claude automatically)
context: fork                    # Run in isolated subagent
agent: Explore                   # Use Explore agent type
allowed-tools: Read, Grep, Bash(gh *)
---

Review PR $ARGUMENTS:
1. Check for security vulnerabilities
2. Verify test coverage
3. Review code quality and patterns
4. Comment on potential performance issues
```

**Frontmatter fields:**
| Field | Purpose |
|-------|---------|
| `name` | Slash command name (lowercase, hyphens) |
| `description` | When Claude auto-loads the skill |
| `disable-model-invocation: true` | Only manual `/name` invocation |
| `user-invocable: false` | Hide from `/` menu (background knowledge) |
| `allowed-tools` | Tools available without permission prompts |
| `model` | Override model for this skill |
| `context: fork` | Run in isolated subagent |
| `agent` | Which subagent type (Explore, Plan, general-purpose, custom) |
| `hooks` | Skill-scoped lifecycle hooks |

**String substitutions in SKILL.md:**
- `$ARGUMENTS` - All arguments
- `$ARGUMENTS[0]`, `$0` - First argument by position
- `${CLAUDE_SESSION_ID}` - Current session ID

**Skill locations:**
| Location | Path | Scope |
|----------|------|-------|
| Enterprise | managed-settings | All org users |
| Personal | `~/.claude/skills/skill-name/` | All your projects |
| Project | `.claude/skills/skill-name/` | This project only |
| Plugin | `<plugin>/skills/skill-name/` | Where plugin enabled |

**Dynamic context injection:**
```yaml
---
name: pr-summary
context: fork
---
PR diff: !`gh pr diff`
PR comments: !`gh pr view --comments`
```
The `!`command`` syntax runs shell commands before sending to Claude.

---

## 5. New Claude Code Features (Late 2025 / Early 2026)

### Current Version
Claude Code is at **v2.1.50** (February 20, 2026). Releases are extremely frequent (multiple per week).

### Agent Teams (Experimental - NEW in 2026)
**Official docs:** https://code.claude.com/docs/en/agent-teams

A lead agent coordinates multiple independent Claude Code instances (teammates) working in parallel, each with their own context window and direct messaging capabilities.

**Enable:**
```json
// .claude/settings.json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

**Key capabilities:**
- One session acts as team lead; coordinates work and assigns tasks
- Teammates communicate DIRECTLY with each other (unlike subagents which only report back)
- Shared task list with file-locking for concurrency safety
- `TeammateIdle` and `TaskCompleted` hooks for workflow automation
- Display modes: in-process (any terminal) or split-pane (requires tmux/iTerm2)
- `teammates: true` flag / `teammateMode: "tmux"` setting

**Best use cases:** parallel code review (security/performance/tests simultaneously), competing hypothesis debugging, cross-layer features (frontend/backend/tests)

**Limitations (experimental):** No session resumption with in-process teammates, task status can lag, no nested teams, one team per session

**Token cost warning:** Significantly more tokens than single session

### Git Worktree Isolation (NEW - stable in 2026)
**Official docs:** https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees

```bash
# Start Claude in isolated worktree
claude --worktree feature-auth
claude -w bugfix-123
claude --worktree  # auto-generates name

# Worktrees created at: <repo>/.claude/worktrees/<name>/
```

Subagents also support worktree isolation:
```yaml
# .claude/agents/my-agent.md frontmatter
---
isolation: worktree
---
```

Add `.claude/worktrees/` to `.gitignore`.

### Skills System (Merged Slash Commands - v2.1.3)
Custom slash commands unified into Skills system. Full details in Configuration section above.

### Models Available (Feb 2026)
- **Claude Opus 4.6** - Released February 5, 2026. 1M context window (Opus 4.6 fast mode also gets full 1M context). Adaptive thinking (dynamically allocates thinking tokens based on effort level). Best for complex tasks.
- **Claude Sonnet 4.6** - Added in v2.1.45. Balance of speed and capability.
- **Disable 1M context:** `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` env var

### Extended Thinking (Adaptive Reasoning on Opus 4.6)
- Extended thinking is ON by default
- Opus 4.6 uses adaptive reasoning: dynamically allocates thinking tokens based on effort level (low/medium/high)
- Toggle: `Option+T` (macOS) / `Alt+T` (Windows/Linux) or `/config`
- View reasoning: `Ctrl+O` for verbose mode
- Effort level: `/model` or `CLAUDE_CODE_EFFORT_LEVEL` env var
- `MAX_THINKING_TOKENS=0` to disable entirely

### GitHub Actions v1.0 (GA - September 2025)
**Official docs:** https://code.claude.com/docs/en/github-actions

```bash
# Quick setup in terminal
/install-github-app
```

```yaml
# .github/workflows/claude.yml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Responds to @claude mentions automatically
```

Breaking changes from beta: `direct_prompt` -> `prompt`, `mode` removed (auto-detected), `custom_instructions` -> `claude_args: --append-system-prompt`, `allowed_tools` -> `claude_args: --allowedTools`

Supports AWS Bedrock and Google Vertex AI for enterprise.

### Plan Mode Improvements
- `Shift+Tab` cycles: Normal -> Auto-Accept Edits -> Plan Mode
- `Ctrl+G` opens plan in text editor for direct editing
- `claude --permission-mode plan` starts in plan mode
- `claude --permission-mode plan -p "..."` for headless plan queries
- Set as default: `"permissions": { "defaultMode": "plan" }`

### Session Management
- `claude --worktree` / `claude -w` - Isolated worktree sessions
- `claude --from-pr 123` - Resume session linked to a PR
- `/rename` - Name sessions for easy resume
- `/resume session-name` or `claude --resume session-name`
- `claude --continue` - Resume most recent session
- `/teleport` and `/remote-env` - Remote session management

### Hot Reload for Skills
New or updated skills become available immediately without restarting sessions (added in v2.1).

### New Hook Events (2026)
- `TeammateIdle` - Agent team coordination
- `TaskCompleted` - Agent team task completion gating
- `ConfigChange` - Security audit on settings changes
- `WorktreeCreate` / `WorktreeRemove` - Custom VCS integration hooks

### Windows ARM64 Support
Native win32-arm64 binary added; improved Git Bash terminal compatibility.

### Authentication CLI
New subcommands: `claude auth login`, `claude auth status`, `claude auth logout`

### VSCode Remote Sessions
OAuth users can browse sessions from claude.ai; VSCode support for remote session resumption.

---

## 6. Recommended Complementary Tools

### Task Management
- **task-master-ai** (v0.43) - See Section 1. Still the primary recommendation for AI-driven task management
- **Claude Code GitHub Actions** - Automate PR creation, reviews, and issue-to-code implementation via `@claude` mentions

### Testing
- **Playwright MCP** - E2E browser testing integrated directly in Claude Code sessions
- **Vitest** - Community consensus as standard test runner for Next.js/TS projects in 2026
- Claude Code hooks for auto-running tests on PostToolUse

### Parallel Development
- **Git Worktrees** (`claude --worktree`) - Built-in, stable, recommended for monorepo parallel work
- **ccswarm** (community) - Multi-agent orchestration with specialized pools (Frontend/Backend/DevOps/QA) in worktree-isolated environments

### Community Resources
- **awesome-claude-code** (https://github.com/hesreallyhim/awesome-claude-code) - Curated list; 55k stars as of Feb 2026. Categories: skills, hooks, slash-commands, orchestrators, IDE integrations, usage monitors
- **awesome-claude-skills** (https://github.com/travisvn/awesome-claude-skills) - Focused on skills specifically
- **everything-claude-code** (https://github.com/affaan-m/everything-claude-code) - Battle-tested configs from Anthropic hackathon winner

### Context Management
- **Context7 MCP** - Essential for keeping Claude current on library versions (Prisma, Next.js, etc.)
- `/compact` with CLAUDE.md instructions for what to preserve during compaction

### CI/CD
- `anthropics/claude-code-action@v1` - Official GitHub Action for PR automation
- Run `/install-github-app` inside Claude Code for quick setup
- Supports AWS Bedrock and Google Vertex AI for enterprise environments

---

## Key Takeaways for Next.js + Prisma + pnpm Monorepo

1. **CLAUDE.md**: Create at repo root AND per package. Document pnpm workspace commands, Prisma migration workflow, and package boundaries explicitly. Use `/init` to generate a starter.

2. **Task Master AI**: Add via MCP (`claude mcp add taskmaster-ai -- npx -y task-master-ai`). No separate API key needed. Use tagged task lists per feature branch.

3. **Context7 MCP**: Critical for keeping Claude current on Next.js 15, Prisma 6, and other rapidly-evolving packages. Add to every project: `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest`

4. **Hooks**: Set up PostToolUse hook for auto-formatting (Prettier) and linting (ESLint) on file writes. Add Notification hook for desktop alerts during long tasks.

5. **Skills**: Create project skills for common workflows: `/db-migrate`, `/pr-review`, `/test-suite`. Store in `.claude/skills/` and commit to git.

6. **Worktrees**: Use `claude --worktree feature-name` for isolated parallel feature development in the monorepo. Add `.claude/worktrees/` to `.gitignore`.

7. **Agent Teams**: Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for complex cross-package refactors. Good for simultaneous frontend/backend/test changes.

8. **GitHub Actions**: Run `/install-github-app` once to set up `@claude` mention automation for PR reviews and issue implementation.

9. **Permissions**: Use `acceptEdits` mode for development sessions to reduce friction. Deny `git push --force` and `.env` reads explicitly.

10. **Model Selection**: Use Opus 4.6 for complex architectural work (high effort mode). Use Sonnet 4.6 for routine tasks to manage token costs.

---

## Sources
- https://www.npmjs.com/package/task-master-ai
- https://github.com/eyaltoledano/claude-task-master
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/configuration.md
- https://github.com/eyaltoledano/claude-task-master/releases
- https://code.claude.com/docs/en/hooks (via aiorg.dev/blog/claude-code-hooks)
- https://code.claude.com/docs/en/skills (official docs fetched directly)
- https://code.claude.com/docs/en/agent-teams (official docs fetched directly)
- https://code.claude.com/docs/en/permissions (official docs fetched directly)
- https://code.claude.com/docs/en/github-actions (official docs fetched directly)
- https://code.claude.com/docs/en/common-workflows (official docs fetched directly)
- https://github.com/anthropics/claude-code/releases (v2.1.50 latest as of 2026-02-20)
- https://www.gradually.ai/en/changelogs/claude-code/ (January 2026 changelog)
- https://claude.com/blog/using-claude-md-files
- https://www.builder.io/blog/best-mcp-servers-2026
- https://apidog.com/blog/top-10-mcp-servers-for-claude-code/
- https://claudelog.com/faqs/claude-code-best-mcps/
- https://github.com/hesreallyhim/awesome-claude-code
- https://www.npmjs.com/package/@upstash/context7-mcp
