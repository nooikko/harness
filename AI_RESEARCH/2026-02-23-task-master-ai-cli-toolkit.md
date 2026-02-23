# Research: task-master-ai CLI Toolkit Capabilities

Date: 2026-02-23

## Summary

`task-master-ai` (GitHub: `eyaltoledano/claude-task-master`) is a dual-mode AI-powered task management system: it runs as either a standalone CLI tool (`task-master <command>`) or as an MCP server that exposes the same operations to IDE agents. The two modes share identical underlying functionality. API keys are only required for AI-powered operations (task generation, expansion, complexity analysis); read/write operations on existing task data work without any API keys. Importantly, the package supports `provider: "claude-code"` which uses Claude Code CLI as the LLM backend — enabling full AI features within Claude Code without any separate API key.

## Prior Research

`/mnt/ramdisk/harness/AI_RESEARCH/2026-02-23-task-master-ai-configuration.md` — covers `.taskmaster/config.json` schema, model roles, parse-prd and expand flags, TDD autopilot, and what does NOT exist in the config system.

## Current Findings

---

### 1. Package Identity and Current State

- **npm package:** `task-master-ai`
- **GitHub:** `https://github.com/eyaltoledano/claude-task-master` (25.6k stars, 2.4k forks)
- **Latest stable:** `0.43.x` (v1.0.0-rc.1 also available)
- **License:** MIT with Commons Clause
- **This project's `.mcp.json`:** uses `npx -y task-master-ai@latest` with no `env` block (keys expected from `packages/database/.env` or ambient environment)

---

### 2. CLI Mode — Direct Usage

**Yes, it is a fully functional standalone CLI**, not just an MCP server wrapper.

**Installation:**

```bash
npm install -g task-master-ai    # global — provides `task-master` command
# OR
npm install task-master-ai       # project-local — use via `npx task-master`
```

**Primary binary:** `task-master` (also aliased as `tm` in newer versions)

**The CLI and MCP server are the same package.** When invoked via `npx task-master-ai`, it starts in MCP server mode (stdio). When the `task-master` binary is called with a subcommand, it runs as a CLI tool. Same codebase, two entry points.

---

### 3. Complete CLI Command Reference

#### Project Initialization

```bash
task-master init                                    # Initialize project (.taskmaster/ dir, rules files)
task-master init --rules cursor,windsurf,vscode    # Initialize with specific IDE rule profiles
task-master rules add <profile1,profile2>           # Add rule profiles
task-master rules remove <profile1,profile2>        # Remove rule profiles
task-master rules setup                             # Interactive rules configuration
```

#### AI Model Configuration

```bash
task-master models                                  # Show current model config and API key status
task-master models --setup                          # Interactive setup wizard
task-master models --set-main=claude-3-opus-20240229
task-master models --set-research=sonar-pro
task-master models --set-fallback=claude-3-haiku-20240307
task-master models --set-main=my-local-llama --ollama
task-master models --set-research=google/gemini-pro --openrouter
task-master models --set-main=gpt-5-codex --codex-cli
```

#### Task Generation from PRD

```bash
task-master parse-prd <prd-file.txt>
task-master parse-prd <prd-file.txt> --num-tasks=5
task-master parse-prd <prd-file.txt> --num-tasks=0       # AI decides count based on complexity
task-master parse-prd <prd-file.txt> --research          # Use Perplexity for richer generation
task-master parse-prd <prd-file.txt> --append            # Add to existing tasks (multi-PRD)
task-master parse-prd <prd-file.txt> --tag=feature-x    # Parse into specific tag context
```

#### Task Listing and Viewing

```bash
task-master list                                    # All tasks
task-master list --status=pending                  # Filter by status
task-master list --with-subtasks                   # Expand subtasks in output
task-master list --status=pending --with-subtasks
task-master list --watch                           # Live-updating view (alias: -w)
task-master list --compact                         # Condensed output format
task-master show <id>                              # Single task details
task-master show --id=<id>                         # Same with explicit flag
task-master show 1,3,5                             # Multiple tasks
task-master show 1.2                               # Specific subtask (parent.subtask notation)
task-master show 44,44.1,55,55.2                   # Mixed tasks and subtasks
task-master next                                   # Next task to work on (respects dependencies)
```

#### Task Status Management

```bash
task-master set-status --id=3 --status=done
task-master set-status --id=1,2,3 --status=done   # Bulk status update
task-master set-status --id=1.1,1.2 --status=done # Subtask status update

# Valid statuses: pending, in-progress, done, review, deferred, cancelled
```

#### Task Manipulation (AI-powered)

```bash
task-master add-task --prompt="Description of the new task"
task-master add-task --prompt="Description" --research
task-master add-task --prompt="Description" --dependencies=1,2,3
task-master add-task --prompt="Description" --priority=high

task-master update --from=<id> --prompt="<context>"           # Rewrite tasks from ID onwards
task-master update --from=<id> --prompt="<context>" --research

task-master update-task --id=<id> --prompt="<context>"        # Update single task
task-master update-task --id=<id> --prompt="<context>" --research

task-master update-subtask --id=5.2 --prompt="Add rate limiting of 100 requests/min"
task-master update-subtask --id=5.2 --prompt="<context>" --research
```

#### Task Expansion and Decomposition (AI-powered)

```bash
task-master expand --id=<id> --num=5                     # Break into 5 subtasks
task-master expand --id=<id> --num=0                     # AI decides subtask count
task-master expand --id=<id> --prompt="Focus on security"  # With additional context
task-master expand --id=<id> --research                   # Perplexity-backed subtasks
task-master expand --all                                   # Expand all pending tasks
task-master expand --all --force                           # Regenerate even if subtasks exist
task-master expand --all --research                        # Research-backed for all
task-master expand --id=<id> --tag=feature-x              # Within specific tag
```

#### Complexity Analysis (AI-powered)

```bash
task-master analyze-complexity                              # Analyze all tasks (1-10 score)
task-master analyze-complexity --output=my-report.json     # Save to custom file
task-master analyze-complexity --model=claude-3-opus-20240229  # Override model
task-master analyze-complexity --threshold=6               # Flag tasks above this score
task-master analyze-complexity --file=custom-tasks.json    # Alternate tasks source
task-master analyze-complexity --research                   # Perplexity-backed analysis

task-master complexity-report                              # View saved complexity report
task-master complexity-report --file=my-report.json       # View specific report
```

#### Dependency Management (no API key required)

```bash
task-master add-dependency --id=2 --depends-on=1
task-master remove-dependency --id=2 --depends-on=1
task-master validate-dependencies                          # Check for cycles/invalid refs
task-master fix-dependencies                               # Auto-fix invalid dependencies
```

#### Task Organization

```bash
task-master move --from=5 --to=7                   # Move task (renumber)
task-master move --from=5.2 --to=7                 # Promote subtask to task
task-master move --from=5.2 --to=7.3               # Move subtask to different parent
task-master move --from=10,11,12 --to=16,17,18     # Bulk move

task-master clear-subtasks --id=5                  # Remove subtasks from task
task-master clear-subtasks --id=1,2,3              # Multiple tasks
task-master clear-subtasks --all                   # Remove all subtasks everywhere

task-master generate                                # Create individual .md task files from tasks.json
```

#### Tag Management (workspace isolation)

```bash
task-master tags                                    # List all tags
task-master tags --show-metadata

task-master add-tag <tag-name>
task-master add-tag <tag-name> --description="Feature development tasks"
task-master add-tag --from-branch                  # Create tag from current git branch name
task-master add-tag <new-tag> --copy-from-current  # Clone current tag
task-master add-tag <new-tag> --copy-from=<source-tag>

task-master use-tag <tag-name>                     # Switch active tag context
task-master rename-tag <old-name> <new-name>
task-master copy-tag <source-tag> <target-tag>
task-master delete-tag <tag-name>
task-master delete-tag <tag-name> --yes            # Skip confirmation
```

#### Research (AI-powered, requires research model)

```bash
task-master research "What are the latest JWT security best practices?"
task-master research "How to implement OAuth 2.0?" --id=15,16   # Include task context
task-master research "How to optimize this API?" --files=src/api.js,src/auth.js
task-master research "Best practices" --context="We're using Express.js" --tree
task-master research "React Query v5 migration" --detail=high
task-master research "Database strategies" --save-file    # Persist to .taskmaster/docs/research/
task-master research "How to implement OAuth?" --save-to=15  # Save findings to task 15
task-master research "API strategies" --save-to=15.2     # Save to subtask
```

#### Cluster Execution (orchestrates Claude Code agents)

```bash
task-master clusters                               # Show execution cluster visualization
task-master clusters --tag <name>                 # Tag-level cluster view
task-master clusters start --tag <tag>            # Launch Claude Code agent teams for parallel execution
task-master clusters start --tag <tag> --dry-run # Preview without launching
task-master clusters start --tag <tag> --resume  # Continue from checkpoint
task-master clusters start --tag <tag> --parallel 3  # Limit concurrent tasks
task-master clusters start --tag <tag> --continue-on-failure
```

#### TDD Autopilot (state machine for RED-GREEN-COMMIT cycles)

```bash
task-master autopilot start <taskId> --json       # Start TDD workflow for task, create git branch
task-master autopilot next --json                 # Get next action (generate_test/implement_code/commit_changes)
task-master autopilot complete --results '{"total":1,"passed":0,"failed":1}' --json
task-master autopilot commit --json
# --json flag produces machine-readable output for programmatic handling
```

---

### 4. tasks.json File Format

Located at `.taskmaster/tasks/tasks.json`. Uses a tag-namespaced structure since v0.17+:

```json
{
  "master": {
    "tasks": [
      {
        "id": 1,
        "title": "Set up authentication system",
        "description": "Implement JWT-based authentication with refresh tokens",
        "status": "pending",
        "priority": "high",
        "dependencies": [],
        "details": "Use bcrypt for password hashing. Implement access token (15min) and refresh token (7d) rotation. Store refresh tokens in HttpOnly cookies.",
        "testStrategy": "Unit test token generation/validation. Integration test login/logout/refresh flows. E2E test protected route access.",
        "subtasks": [
          {
            "id": 1,
            "title": "Create user schema and Prisma model",
            "description": "Define User model with id, email, passwordHash, createdAt fields",
            "details": "Add to schema.prisma. Run db:push. Export User type from database package.",
            "status": "pending",
            "dependencies": [],
            "testStrategy": "Verify Prisma Client generates correct types"
          }
        ]
      }
    ]
  }
}
```

**Field Reference:**

| Field | Type | Required | Valid Values |
|-------|------|----------|-------------|
| `id` | number | yes | Positive integer, unique within tag |
| `title` | string | yes | 1-200 characters |
| `description` | string | yes | Concise summary |
| `status` | string | yes | `pending`, `in-progress`, `done`, `review`, `deferred`, `cancelled` |
| `priority` | string | no | `low`, `medium` (default), `high`, `critical` |
| `dependencies` | number[] | no | Array of prerequisite task IDs |
| `details` | string | no | Implementation instructions |
| `testStrategy` | string | no | Verification approach |
| `subtasks` | object[] | no | Child tasks (same structure, no nested subtasks) |

**Legacy format** `{"tasks": [...]}` is auto-migrated to `{"master": {"tasks": [...]}}` on first use.

---

### 5. API Key Requirements — Definitive Classification

**Commands that work WITHOUT any API key:**

```bash
task-master init
task-master --version / --help
task-master list
task-master show <id>
task-master next
task-master set-status --id=<id> --status=<status>
task-master add-dependency / remove-dependency
task-master validate-dependencies / fix-dependencies
task-master move --from=<id> --to=<id>
task-master clear-subtasks
task-master complexity-report         # View existing report only
task-master tags / use-tag / rename-tag / copy-tag / delete-tag / add-tag
task-master generate                  # Creates .md files from tasks.json
task-master clusters                  # View cluster graph (not start)
```

**Commands that REQUIRE at least one LLM API key (or claude-code provider):**

```bash
task-master parse-prd           # Uses main model
task-master expand              # Uses main model
task-master add-task            # Uses main model
task-master update              # Uses main model
task-master update-task         # Uses main model
task-master update-subtask      # Uses main model
task-master analyze-complexity  # Uses main model
task-master research            # Uses research model
task-master clusters start      # Launches Claude Code agents
task-master autopilot *         # Orchestrates Claude Code
```

**`--research` flag** on any command routes to the research model (Perplexity or any web-capable model configured).

---

### 6. MCP Server Mode vs CLI Mode

Both modes expose identical functionality. The package is one codebase with two entry points:

| Aspect | CLI (`task-master <cmd>`) | MCP Server (`npx -y task-master-ai`) |
|--------|--------------------------|--------------------------------------|
| Invocation | Direct terminal / Bash | IDE integration via stdio protocol |
| API Keys | `.env` in project root | `env` block in `.mcp.json` or IDE config |
| Output | Human-readable text (or `--json` for machine output) | Typed MCP tool responses |
| Tool count | All CLI commands | 36 MCP tools (configurable via `TASK_MASTER_TOOLS`) |
| Config location | `.taskmaster/config.json` | `.taskmaster/config.json` (shared) |
| Project root | CWD | Detected via `TASK_MASTER_PROJECT_ROOT` env or heuristics |
| Context window | Not applicable | `all` (~21k tokens), `standard` (~10k), `core` (~5k) |

**Key insight:** The MCP and CLI share the same `.taskmaster/config.json` and `tasks.json`. Changes made via CLI are visible to MCP and vice versa.

**MCP tool loading** (set via `TASK_MASTER_TOOLS` env var in MCP config):
- `core` — 7 tools, ~5,000 tokens
- `standard` — 15 tools, ~10,000 tokens
- `all` (default) — 36 tools, ~21,000 tokens

---

### 7. Using CLI from Claude Code via Bash (Instead of MCP)

**This is fully supported and explicitly documented by the project.**

Claude Code can invoke task-master CLI commands via Bash tool calls. The `--json` flag is important for machine-readable output:

```bash
# Read operations (no API key needed)
npx task-master list --with-subtasks
npx task-master show 5
npx task-master next
npx task-master validate-dependencies

# Status updates (no API key needed)
npx task-master set-status --id=3 --status=done
npx task-master set-status --id=3.1,3.2 --status=done

# AI operations (use claude-code provider to avoid separate API key)
npx task-master parse-prd .taskmaster/docs/prd.txt
npx task-master expand --id=5
npx task-master add-task --prompt="Implement rate limiting middleware"

# TDD autopilot (designed for Bash invocation by agents)
npx task-master autopilot start 7 --json
npx task-master autopilot next --json
npx task-master autopilot complete --results '{"total":5,"passed":5,"failed":0}' --json
npx task-master autopilot commit --json
```

**The `clusters start` command** explicitly launches Claude Code agent sessions — it is an orchestration layer that spawns Claude Code sub-agents to work on tasks in parallel.

---

### 8. Avoiding a Separate API Key: The `claude-code` Provider

**Confidence: HIGH** — Documented in official GitHub docs at `docs/examples/claude-code-usage.md`.

The `claude-code` provider routes all LLM calls through the already-authenticated Claude Code CLI session. No `ANTHROPIC_API_KEY` needed in `.env`:

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "sonnet"
    },
    "research": {
      "provider": "claude-code",
      "modelId": "opus"
    },
    "fallback": {
      "provider": "claude-code",
      "modelId": "sonnet"
    }
  },
  "claudeCode": {
    "maxTurns": 5,
    "permissionMode": "default",
    "allowedTools": ["Read", "LS"],
    "disallowedTools": ["Write", "Edit"],
    "customSystemPrompt": "...",
    "appendSystemPrompt": "..."
  }
}
```

**Available `modelId` values for `claude-code` provider:** `sonnet`, `opus`

**Limitations of `claude-code` provider:**
- `temperature` and `maxTokens` are ignored (Claude Code CLI does not expose these)
- Usage cost tracking shows 0 (not tracked by Claude Code CLI)
- Session management is automatic

**The `claudeCode` config section** supports `commandSpecific` overrides:

```json
{
  "claudeCode": {
    "maxTurns": 5,
    "commandSpecific": {
      "parse-prd": {
        "maxTurns": 10,
        "customSystemPrompt": "Task breakdown specialist"
      },
      "expand": {
        "maxTurns": 8
      }
    }
  }
}
```

**This project's current config** at `/mnt/ramdisk/harness/.taskmaster/config.json` uses `provider: "anthropic"` for all three model roles with explicit `maxTokens: 16000` and `temperature: 0.1/0.2`, meaning it DOES require `ANTHROPIC_API_KEY`.

---

### 9. Features Summary Beyond Basic Task Tracking

| Feature | CLI Command | Requires API |
|---------|------------|-------------|
| PRD-to-tasks generation | `parse-prd` | Yes (main model) |
| Task decomposition into subtasks | `expand` | Yes (main model) |
| Complexity scoring (1-10) | `analyze-complexity` | Yes (main model) |
| Dependency graph validation | `validate-dependencies` | No |
| Dependency auto-fixing | `fix-dependencies` | No |
| Dependency-aware next task | `next` | No |
| Research-augmented generation | `--research` flag | Yes (research model) |
| Implementation drift correction | `update --from=<id>` | Yes |
| Task workspace isolation | tag commands | No |
| Parallel cluster visualization | `clusters` | No |
| Parallel Claude Code agent launch | `clusters start` | Yes (Claude Code) |
| TDD RED-GREEN-COMMIT orchestration | `autopilot` | Yes (Claude Code) |
| Fresh web research | `research` | Yes (research model) |
| Individual task file generation | `generate` | No |
| Status tracking | `set-status`, `list`, `show` | No |

---

### 10. Key Architectural Notes

1. **Single source of truth:** Both CLI and MCP read/write the same `.taskmaster/tasks/tasks.json`. You can mix both modes freely.

2. **Tag system** provides git-branch-level isolation of task lists. Use `add-tag --from-branch` to auto-create a tag matching the current git branch.

3. **`--json` flag** on autopilot commands produces structured output suitable for parsing in Bash scripts or by Claude Code agent.

4. **`TASK_MASTER_PROJECT_ROOT`** env var is the most reliable way to pin the project root when running CLI from arbitrary working directories.

5. **MCP tool naming convention:** CLI `parse-prd` → MCP `parse_prd`, CLI `add-task` → MCP `add_task` (underscores instead of hyphens, otherwise 1:1 mapping).

6. **`defaultNumTasks: 0` and `defaultSubtasks: 0`** in this project's config means the AI decides how many tasks/subtasks to generate based on complexity (dynamic count mode).

## Key Takeaways

1. **CLI is fully functional standalone** — not just a thin wrapper around the MCP server. Every MCP tool has a direct CLI equivalent.

2. **API keys are NOT required for read/status operations** — `list`, `show`, `next`, `set-status`, `validate-dependencies`, `fix-dependencies`, `move`, `clear-subtasks`, `tags`, and `generate` all work without any LLM credentials.

3. **API keys ARE required for generation/analysis** — `parse-prd`, `expand`, `add-task`, `update*`, `analyze-complexity`, `research`, `clusters start`, and `autopilot` all call an LLM.

4. **The `claude-code` provider eliminates the need for a separate `ANTHROPIC_API_KEY`** — set `provider: "claude-code"` in `.taskmaster/config.json` and task-master uses the authenticated Claude Code CLI session. This is the optimal setup for use within Claude Code.

5. **Claude Code can use CLI via Bash tool** — the project explicitly supports and documents this. Use `npx task-master <command>` from any Bash call. The `--json` flag on autopilot commands produces machine-readable output.

6. **MCP and CLI are interchangeable** — same config, same data files, same operations. The MCP server is preferred for IDE integration; CLI is preferred for scripting and agent-driven Bash execution.

7. **This project's current `.taskmaster/config.json`** uses `provider: "anthropic"` with explicit `maxTokens` and `temperature`. Switching to `provider: "claude-code"` would allow AI operations without a separate API key.

## Sources

- [npm package: task-master-ai](https://www.npmjs.com/package/task-master-ai)
- [GitHub: eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master)
- [Official docs: docs.task-master.dev](https://docs.task-master.dev)
- [CLI Root Commands reference](https://docs.task-master.dev/capabilities/cli-root-commands.md)
- [MCP Tools reference](https://docs.task-master.dev/capabilities/mcp.md)
- [Task Structure reference](https://docs.task-master.dev/capabilities/task-structure.md)
- [Clusters & Execution](https://docs.task-master.dev/capabilities/clusters.md)
- [TDD AI Agent Integration](https://docs.task-master.dev/tdd-workflow/ai-agent-integration.md)
- [Installation guide](https://docs.task-master.dev/getting-started/quick-start/installation.md)
- [GitHub: docs/examples/claude-code-usage.md](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/examples/claude-code-usage.md)
- [GitHub: README-task-master.md](https://github.com/eyaltoledano/claude-task-master/blob/main/README-task-master.md)
- [GitHub: docs/tutorial.md](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/tutorial.md)
- [DeepWiki: Installation and Setup](https://deepwiki.com/eyaltoledano/claude-task-master/1.1-installation-and-setup)
- [Alchemist Studios: Task-Master with Claude Code (No API Keys)](https://alchemiststudios.ai/articles/task-master-claude-code-setup.html)
- [Prior research: 2026-02-23-task-master-ai-configuration.md](./2026-02-23-task-master-ai-configuration.md)
