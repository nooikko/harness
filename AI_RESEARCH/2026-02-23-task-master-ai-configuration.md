# Research: task-master-ai Configuration Reference

Date: 2026-02-23

## Summary

Comprehensive reference for all `.taskmaster/config.json` configuration options in the `task-master-ai` npm package (v0.43.0 latest stable, v1.0.0-rc.1 in RC). Covers model settings, global defaults, `parse-prd` flags, `expand` flags, and the TDD autopilot workflow. There are NO built-in "review/challenger/iteration" model roles — the system uses three model roles (main, research, fallback) only.

## Prior Research

None — first research on this topic.

## Current Findings

### Package Identity

- npm package: `task-master-ai`
- GitHub repo: `https://github.com/eyaltoledano/claude-task-master`
- Official docs: `https://docs.task-master.dev`
- Latest stable: `0.43.0`
- RC available: `1.0.0-rc.1`
- MCP server name: `taskmaster-ai`

---

### Complete `.taskmaster/config.json` Schema

The config file has two top-level sections: `models` and `global`.

#### Full Example (all fields)

```json
{
  "models": {
    "main": {
      "provider": "anthropic",
      "modelId": "claude-3-7-sonnet-20250219",
      "maxTokens": 64000,
      "temperature": 0.2,
      "baseURL": "https://api.anthropic.com/v1"
    },
    "research": {
      "provider": "perplexity",
      "modelId": "sonar-pro",
      "maxTokens": 8700,
      "temperature": 0.1,
      "baseURL": "https://api.perplexity.ai/v1"
    },
    "fallback": {
      "provider": "anthropic",
      "modelId": "claude-3-5-sonnet",
      "maxTokens": 64000,
      "temperature": 0.2
    }
  },
  "global": {
    "logLevel": "info",
    "debug": false,
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "defaultTag": "master",
    "projectName": "Your Project Name",
    "ollamaBaseURL": "http://localhost:11434/api",
    "azureBaseURL": "https://your-endpoint.azure.com/openai/deployments",
    "vertexProjectId": "your-gcp-project-id",
    "vertexLocation": "us-central1",
    "responseLanguage": "English"
  }
}
```

---

### `models` Section — Per-Role Fields

There are exactly **three model roles**: `main`, `research`, `fallback`. No "challenger", "review", or "planner" roles exist.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | yes | — | Provider: `anthropic`, `openai`, `perplexity`, `azure`, `ollama`, `vertex`, `openrouter`, `mistral`, `xai`, `codex-cli` |
| `modelId` | string | yes | — | Model identifier for the provider (e.g. `claude-3-7-sonnet-20250219`) |
| `maxTokens` | number | no | — | Maximum output tokens per response |
| `temperature` | number | no | 0.2 (main), 0.1 (research) | Sampling temperature 0.0–1.0 |
| `baseURL` | string | no | — | Custom API endpoint override (per-model, overrides global) |

**Default models (factory defaults):**
- main: Claude 3.5 Sonnet (Anthropic)
- research: Perplexity Sonar Pro
- fallback: (no hard default, provider-dependent)

**Model role usage:**
- `main` — all core generation: parse-prd, expand, add-task, update, update-task
- `research` — commands run with `--research` flag (uses Perplexity or any web-search-capable model)
- `fallback` — used automatically when main or research fail

---

### `global` Section — All Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `logLevel` | string | `"info"` | Logging verbosity: `"debug"`, `"info"`, `"warn"`, `"error"` |
| `debug` | boolean | `false` | Enable debug mode with extra output |
| `defaultNumTasks` | number | `10` | Default number of tasks to generate from a PRD when `--num-tasks` is not specified |
| `defaultSubtasks` | number | `5` | Default number of subtasks per task when `expand --num` is not specified |
| `defaultPriority` | string | `"medium"` | Default priority for new tasks: `"low"`, `"medium"`, `"high"` |
| `defaultTag` | string | `"master"` | Active tag context for task operations |
| `projectName` | string | — | Human-readable project identifier (used in prompts) |
| `ollamaBaseURL` | string | `"http://localhost:11434/api"` | Ollama local API endpoint |
| `azureBaseURL` | string | — | Global Azure OpenAI deployment URL (overridden by per-model `baseURL`) |
| `vertexProjectId` | string | — | Google Cloud project ID for Vertex AI |
| `vertexLocation` | string | `"us-central1"` | GCP region for Vertex AI |
| `responseLanguage` | string | `"English"` | Language for AI-generated content |

---

### `codexCli` Section (advanced/optional)

A separate top-level section for Codex CLI provider configuration. Only relevant when using `provider: "codex-cli"`.

```json
{
  "codexCli": {
    "allowNpx": true,
    "approvalMode": "on-failure",
    "sandboxMode": "workspace-write",
    "commandSpecific": {
      "parse-prd": {
        "verbose": true,
        "approvalMode": "never"
      },
      "expand": {
        "sandboxMode": "read-only",
        "verbose": true
      }
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `allowNpx` | Allow npx execution in Codex CLI |
| `approvalMode` | When to require approval: `"never"`, `"on-failure"`, `"always"` |
| `sandboxMode` | Execution sandbox: `"workspace-write"`, `"read-only"` |
| `commandSpecific` | Per-command overrides of `approvalMode`/`sandboxMode`/`verbose` |

---

### `parse-prd` Command — All Flags

```bash
task-master parse-prd <prd-file.txt> [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--num-tasks=<number>` | `10` (or `global.defaultNumTasks`) | Number of tasks to generate. Set to `0` for dynamic count based on PRD complexity |
| `--research` | off | Enable research-backed parsing using the `research` model (Perplexity by default) for richer, more up-to-date task generation |
| `--input=<file>` | positional arg | Alternative way to specify PRD file path |
| `--append` | off | Append generated tasks to existing `tasks.json` instead of overwriting. Supports multi-PRD projects |
| `--tag=<name>` | `global.defaultTag` | Parse PRD into a specific tag context |

**Key behaviour notes:**
- `--num-tasks=0` tells the AI to decide the appropriate count based on the PRD's complexity.
- `--research` routes through the `research` model role (configured in `models.research`).
- Without `--append`, existing tasks are overwritten.

---

### `expand` Command — All Flags

```bash
task-master expand --id=<id> [flags]
task-master expand --all [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--id=<id>` | — | Expand a specific task into subtasks |
| `--num=<number>` | `global.defaultSubtasks` (5) | Number of subtasks to generate. Use `0` for dynamic count |
| `--prompt="<context>"` | — | Additional context for subtask generation |
| `--all` | off | Expand all pending tasks |
| `--force` | off | Regenerate subtasks even if they already exist |
| `--research` | off | Use research-backed subtask generation |
| `--tag=<name>` | `global.defaultTag` | Operate within a specific tag context |
| `--file=<path>` | — | Use an alternative tasks JSON file |

---

### `analyze-complexity` Command — All Flags

```bash
task-master analyze-complexity [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--output=<file>` | auto-generated path | Custom report output location |
| `--model=<model>` | `models.main` | Override which model performs analysis |
| `--threshold=<1-10>` | `5` | Complexity score threshold for flagging tasks |
| `--file=<file>` | — | Alternative tasks.json source |
| `--research` | off | Use Perplexity AI for analysis |

---

### `research` Command — All Flags

```bash
task-master research "<query>" [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--id=<id1,id2>` | — | Include specific task context via fuzzy search |
| `--files=<file1,file2>` | — | Include code file context |
| `--context="<text>"` | — | Custom context string |
| `--tree` | off | Include project directory tree |
| `--detail=<low\|medium\|high>` | `medium` | Research depth level |
| `--file=<path>` | — | Alternative tasks source |
| `--tag=<name>` | — | Operate within specific tag |
| `--save-file` | off | Persist conversation to `.taskmaster/docs/research/` |
| `--save-to=<id>` | — | Commit findings directly to a task or subtask |

---

### Task Structure (from source schemas)

Tasks generated by `parse-prd` follow this structure:

```json
{
  "id": 1,
  "title": "string (1-200 chars)",
  "description": "string",
  "details": "string or null",
  "testStrategy": "string or null",
  "priority": "high | medium | low | null",
  "dependencies": [1, 2],
  "status": "pending | in-progress | blocked | done | cancelled | deferred"
}
```

Subtasks (from `expand`) have stricter requirements:

```json
{
  "id": 1,
  "title": "string (5-200 chars)",
  "description": "string (min 10 chars)",
  "details": "string (min 20 chars)",
  "dependencies": [1],
  "status": "pending | done | completed",
  "testStrategy": "string or null"
}
```

---

### TDD Autopilot Workflow (separate from config)

There is an autopilot/TDD workflow system (`tm autopilot`) that runs RED-GREEN-COMMIT cycles per subtask. This is an MCP-based orchestration layer, **not configurable via config.json**. It operates through MCP tool calls:

- `autopilot_start` — starts workflow for a task, creates git branch `task-{taskId}`
- `autopilot_next` — returns next action: `generate_test`, `implement_code`, or `commit_changes`
- `autopilot_complete_phase` — validates RED (test must fail) or GREEN (all tests pass)
- `autopilot_commit` — commits changes and advances to next subtask

Phases: PREFLIGHT → BRANCH_SETUP → SUBTASK_LOOP (RED→GREEN→COMMIT per subtask) → FINALIZE → COMPLETE

---

### What Does NOT Exist

The following concepts were researched and confirmed as **absent** from task-master-ai:

| Concept | Status |
|---------|--------|
| "challenger" model role | Does not exist |
| "planner" or "reviewer" model role | Does not exist |
| Iterative review config | Does not exist in config |
| `--planning-depth` flag | Does not exist |
| `--iterations` or retry config | Does not exist |
| Per-task detail level config | Does not exist (only subtask count) |
| Config for autopilot TDD phases | Not configurable via config.json |

"Review" and "validation" are handled procedurally (the `analyze-complexity` command and `validate-dependencies` / `fix-dependencies` commands), not via config settings.

---

### Environment Variables (API Keys Only)

`.env` file is **only** for secrets — no behavioral config goes here anymore:

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
PERPLEXITY_API_KEY=
GOOGLE_API_KEY=
AZURE_OPENAI_API_KEY=
MISTRAL_API_KEY=
OPENROUTER_API_KEY=
XAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
OLLAMA_BASE_URL=
VERTEX_PROJECT_ID=
VERTEX_LOCATION=
GOOGLE_APPLICATION_CREDENTIALS=
```

### Tool Loading (MCP context only)

Set via `TASK_MASTER_TOOLS` env var in MCP config to control which tools are registered:

| Value | Token Cost | Tools | Use Case |
|-------|-----------|-------|----------|
| `core` | ~5,000 | 7 | Daily dev |
| `standard` | ~10,000 | 15 | Regular workflows |
| `all` | ~21,000 | 36 | Full access |

---

### Project's Current config.json (in this repo)

Located at `/mnt/ramdisk/harness/.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "anthropic",
      "modelId": "claude-opus-4-6"
    },
    "research": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4-6"
    },
    "fallback": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4-6"
    }
  },
  "global": {
    "projectName": "harness",
    "defaultTag": "master"
  }
}
```

Note: `maxTokens` and `temperature` are omitted, so provider defaults apply. No `defaultNumTasks` or `defaultSubtasks` set, so factory defaults (10 and 5) apply.

## Key Takeaways

1. **Three model roles only**: `main`, `research`, `fallback`. No challenger, reviewer, or planner roles.
2. **Task count control**: `global.defaultNumTasks` (default: 10) sets the default for `parse-prd`. Override per-invocation with `--num-tasks=<n>` or `--num-tasks=0` for AI-decided count.
3. **Subtask depth control**: `global.defaultSubtasks` (default: 5) sets subtasks per task. Override with `expand --num=<n>` or `--num=0`.
4. **Research mode**: `--research` flag routes to `models.research` for web-search-augmented generation. Works on `parse-prd`, `expand`, `update`, `update-task`, `update-subtask`, `add-task`, `analyze-complexity`.
5. **Generation parameters**: `maxTokens` and `temperature` are per-model-role in config. Main defaults to `temperature: 0.2`, research defaults to `temperature: 0.1`.
6. **No review config**: The `analyze-complexity` command + `validate-dependencies` / `fix-dependencies` handle validation procedurally. Nothing is configurable for review iterations.
7. **Append multiple PRDs**: Use `parse-prd --append` to add tasks from additional PRD files without overwriting.
8. **Tag isolation**: Use `--tag=<name>` on most commands to isolate task sets per feature/branch.

## Sources

- [npm package page](https://www.npmjs.com/package/task-master-ai)
- [GitHub repo: eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master)
- [Official docs: docs.task-master.dev](https://docs.task-master.dev)
- [Advanced configuration docs](https://docs.task-master.dev/best-practices/configuration-advanced)
- [Command reference (raw)](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/command-reference.md)
- [Configuration.md (raw)](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/configuration.md)
- [Source: src/schemas/parse-prd.js](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/src/schemas/parse-prd.js)
- [Source: src/schemas/base-schemas.js](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/src/schemas/base-schemas.js)
- [Context7: /eyaltoledano/claude-task-master](https://context7.com/eyaltoledano/claude-task-master/llms.txt)
- [PRD quick start](https://docs.task-master.dev/getting-started/quick-start/prd-quick)
- [TDD AI agent integration](https://github.com/eyaltoledano/claude-task-master/blob/main/apps/docs/tdd-workflow/ai-agent-integration.mdx)
