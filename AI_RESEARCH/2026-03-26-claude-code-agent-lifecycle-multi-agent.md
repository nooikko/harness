# Research: Claude Code Agent Lifecycle and Multi-Agent Coordination

Date: 2026-03-26

## Summary

Authoritative research from official Anthropic documentation (code.claude.com, platform.claude.com) on how Claude Code handles agent spawning, lifecycle, and multi-agent coordination. Covers the Agent tool (formerly Task), SendMessage, TaskOutput deprecation, background agents, and both the subagent and agent teams models.

## Prior Research

- `AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — general Claude Code ecosystem overview
- `AI_RESEARCH/2026-02-26-claude-code-context-files-reference.md` — context and tool reference

## Current Findings

### 1. Agent Tool Lifecycle: When Does a Sub-Agent Terminate?

**Confidence: HIGH** — Source: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), [platform.claude.com/docs/en/agent-sdk/subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)

A sub-agent spawned via the Agent tool (formerly called Task tool, renamed in v2.1.63) runs its own complete agentic loop and terminates when:

1. Claude produces a final text-only response with no tool calls (normal completion)
2. The `maxTurns` limit is hit
3. The `maxBudgetUsd` limit is hit
4. An error interrupts the loop (API failure, cancelled request)

After termination, the sub-agent's state is **not destroyed** — its transcript is saved to `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`. The agent can be resumed later via `SendMessage`.

**Key lifecycle facts:**
- Each sub-agent invocation creates a fresh context window (no parent conversation history)
- Sub-agents **cannot spawn other sub-agents** — nesting is prohibited
- Only the sub-agent's final message returns to the parent as the Agent tool result
- The parent's context grows by the summary result, not by the full subtask transcript
- Sub-agent transcripts persist independently of main conversation compaction
- Automatic cleanup occurs based on `cleanupPeriodDays` setting (default: 30 days)

### 2. SendMessage Tool: Usage and Behavior

**Confidence: HIGH** — Source: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), changelog v2.1.77

**What SendMessage does:**
- Sends a message to a previously-spawned agent by its agent ID
- The `to` field takes the agent's ID
- As of **v2.1.77**, if a stopped (completed) sub-agent receives a `SendMessage`, it **auto-resumes in the background** without requiring a new `Agent` tool invocation

**What happens if you SendMessage to a completed agent:**
> "If a stopped subagent receives a SendMessage, it auto-resumes in the background without requiring a new Agent invocation."
> — Source: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)

The resumed subagent retains its full conversation history — all previous tool calls, results, and reasoning. It picks up exactly where it stopped rather than starting fresh.

**Pre-v2.1.77 behavior:** The `Agent` tool had a `resume` parameter. This was **removed** in v2.1.77. The replacement pattern is:
```
// OLD (removed in v2.1.77):
Agent(resume: agentId)

// NEW (v2.1.77+):
SendMessage({to: agentId})
```

**Agent IDs:** After a sub-agent completes, Claude receives its agent ID in the Agent tool result. IDs can also be found in transcript files at `~/.claude/projects/{project}/{sessionId}/subagents/`.

**For agent teams**, SendMessage supports additional message types:
- `message` — direct message to one teammate
- `broadcast` — send to all teammates simultaneously
- `shutdown_request` / `shutdown_response` — graceful teardown
- `plan_approval_response` — quality gates

### 3. `run_in_background` Parameter

**Confidence: HIGH** — Source: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), [code.claude.com/docs/en/interactive-mode](https://code.claude.com/docs/en/interactive-mode)

**In subagent frontmatter definitions:**

```yaml
---
name: my-agent
description: Does something
background: true  # Always run this subagent as a background task
---
```

Setting `background: true` in the frontmatter makes the subagent always run as a background task.

**In the CLI Agent tool invocation:**

Claude decides whether to run subagents in the foreground or background based on the task. Users can:
- Ask Claude to "run this in the background"
- Press **Ctrl+B** to background a currently-running task (Tmux users press twice)
- Set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` to disable all background functionality

**Foreground vs Background behavior:**

| Aspect | Foreground | Background |
|--------|-----------|------------|
| Blocking | Blocks main conversation until complete | Runs concurrently |
| Permission prompts | Passed through to user | Pre-approved upfront before launch; auto-denies anything not pre-approved |
| AskUserQuestion | Passed through | Tool call fails, but subagent continues |
| Failure recovery | Retry with interactive prompts | Must start new foreground subagent to retry |

**Key background behavior (v2.1.77+):**
> "Killing a background agent now preserves its partial results in the conversation context."

**Output retrieval:** Background task output is written to a file. As of **v2.1.83**, the recommended way to retrieve it is with the `Read` tool on the task's output file path (not `TaskOutput`).

### 4. TaskOutput Tool: Deprecated

**Confidence: HIGH** — Source: [code.claude.com/docs/en/tools-reference](https://code.claude.com/docs/en/tools-reference), changelog v2.1.83

The `TaskOutput` tool is **deprecated** as of v2.1.83.

From the tools reference:
> `TaskOutput` — (Deprecated) Retrieves output from a background task. Prefer `Read` on the task's output file path.

The replacement is to use the `Read` tool on the background task's output file path. This simplifies the toolset by leveraging existing file reading capabilities.

### 5. Multi-Agent Patterns: Two Models

**Confidence: HIGH** — Source: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), [code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)

Anthropic offers two distinct multi-agent coordination models:

---

#### Model A: Subagents (Stable, Default)

Subagents run within a single session. The parent agent manages all work.

**Architecture:**
```
Main agent
├── Spawns subagent A → A reports results back to main
├── Spawns subagent B → B reports results back to main
└── Main synthesizes results
```

**Key constraints:**
- Sub-agents cannot spawn other sub-agents (no nesting)
- Sub-agents can only report results back to the main agent
- Sub-agents never talk to each other
- Results from sub-agents accumulate in the main context

**When to use:**
- Focused tasks where only the result matters
- Context isolation (verbose output stays in subagent)
- Sequential chaining
- Lower token cost (results summarized back)

**Recommended patterns:**
1. **Isolate high-volume operations** — run tests/docs fetching in a subagent, get only the summary
2. **Run parallel research** — spawn multiple subagents for independent investigations
3. **Chain subagents** — each subagent completes its task, then Claude passes relevant context to the next

---

#### Model B: Agent Teams (Experimental, opt-in)

Agent teams use separate Claude Code sessions. Teammates communicate directly with each other.

**Architecture:**
```
Team lead (main session)
├── Teammate A ←→ Teammate B (direct messaging)
└── Shared task list (all agents can read/write)
```

**Enable:** Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**Architecture components:**
- **Team lead** — creates the team, spawns teammates, coordinates
- **Teammates** — separate Claude Code instances working on tasks
- **Task list** — shared work items with pending/in-progress/complete states + dependency management
- **Mailbox** — messaging system between agents

**Key features:**
- Teammates message each other directly (not just through the lead)
- Shared task list with self-coordination and self-claiming
- Task dependencies with automatic unblocking
- Plan approval workflow (teammate plans → lead approves → teammate implements)
- `SubagentStart`/`SubagentStop` hooks for quality gates

**When to use:**
- Complex work requiring discussion and collaboration
- Research with competing hypotheses (adversarial debate)
- Cross-layer coordination (frontend + backend + tests, each owned by different teammate)
- Parallel review with independent lenses (security + performance + test coverage simultaneously)

**Limitations (experimental):**
- No session resumption with in-process teammates
- Task status can lag
- One team per session
- No nested teams (teammates cannot spawn their own teams)
- Permissions set at spawn time only

---

### 6. Agent Tool / Task Tool Rename

**Confidence: HIGH** — Source: changelog v2.1.63, SDK subagents docs

- In **v2.1.63**, the `Task` tool was renamed to `Agent`
- Existing `Task(...)` references in settings and agent definitions still work as aliases
- The SDK still uses `"Task"` in the `system:init` tools list and in `result.permission_denials[].tool_name` for backward compatibility
- New SDK emit `"Agent"` in `tool_use` blocks

### 7. SDK Subagent API (Programmatic)

**Confidence: HIGH** — Source: [platform.claude.com/docs/en/agent-sdk/subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)

For programmatic SDK use, subagents are defined via the `agents` parameter:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review the authentication module for security issues",
  options: {
    allowedTools: ["Read", "Grep", "Glob", "Agent"], // Agent tool required
    agents: {
      "code-reviewer": {
        description: "Expert code review specialist.",
        prompt: "You are a code reviewer...",
        tools: ["Read", "Grep", "Glob"],  // tool restriction
        model: "sonnet"
      }
    }
  }
})) { ... }
```

**AgentDefinition fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | When to use this agent (Claude uses this to decide) |
| `prompt` | Yes | System prompt defining the agent's role |
| `tools` | No | Allowed tools; inherits all if omitted |
| `model` | No | Model override: `sonnet`, `opus`, `haiku`, or `inherit` |

**Resuming a subagent via SDK:**
1. Capture `session_id` from `ResultMessage` after first query
2. Extract `agentId` from message content (appears in Agent tool results)
3. Resume: pass `resume: sessionId` in second query's options

**What subagents inherit:**
| Inherited | NOT inherited |
|-----------|--------------|
| Own system prompt | Parent conversation history |
| Project CLAUDE.md (via settingSources) | Parent's tool results |
| Tool definitions (subset if `tools` specified) | Parent's system prompt |
| Agent tool prompt string | Skills (unless in `AgentDefinition.skills`) |

### 8. Agent Loop Fundamentals (SDK)

**Confidence: HIGH** — Source: [platform.claude.com/docs/en/agent-sdk/agent-loop](https://platform.claude.com/docs/en/agent-sdk/agent-loop)

The SDK agent loop lifecycle:
1. **Receive prompt** — SDK yields `SystemMessage` with `subtype: "init"`
2. **Evaluate and respond** — SDK yields `AssistantMessage`
3. **Execute tools** — SDK yields `UserMessage` with tool results
4. **Repeat** steps 2-3 (each cycle = one turn)
5. **Return result** — SDK yields final `AssistantMessage` (no tool calls) then `ResultMessage`

**Termination conditions (ResultMessage subtypes):**

| Subtype | Meaning |
|---------|---------|
| `success` | Completed normally |
| `error_max_turns` | Hit `maxTurns` limit |
| `error_max_budget_usd` | Hit `maxBudgetUsd` limit |
| `error_during_execution` | API failure or cancelled request |
| `error_max_structured_output_retries` | Structured output validation failed |

Only `success` provides a `result` field. All subtypes carry `total_cost_usd`, `usage`, `num_turns`, `session_id`.

## Key Takeaways

1. **Sub-agents terminate after their last text-only response** (no tool calls) — or on limit/error. Their transcript persists for 30 days and can be resumed.

2. **SendMessage to a stopped agent auto-resumes it** (as of v2.1.77) — no new `Agent` invocation required. The `resume` parameter was removed from the Agent tool.

3. **`run_in_background: true`** (as `background: true` in frontmatter) makes a subagent always run in background. Background agents run concurrently, require upfront permission approval, and auto-deny anything not pre-approved.

4. **TaskOutput is deprecated** (v2.1.83) — use `Read` on the output file path instead.

5. **Two multi-agent models exist:**
   - **Subagents** (stable) — single session, parent manages all work, no inter-agent communication
   - **Agent teams** (experimental) — separate sessions, direct inter-agent messaging, shared task list

6. **Subagents cannot spawn other subagents** — nesting is explicitly prohibited. Chain from the main conversation or use agent teams instead.

7. **The Task tool was renamed Agent** in v2.1.63 — `Task(...)` still works as an alias.

8. **Context isolation is the primary benefit** of subagents — verbose tool output stays in the subagent context; only the final summary returns to the parent.

## Sources

- [Create custom subagents — code.claude.com](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK — platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [How the agent loop works — platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/agent-loop)
- [Agent teams — code.claude.com](https://code.claude.com/docs/en/agent-teams)
- [Tools reference — code.claude.com](https://code.claude.com/docs/en/tools-reference)
- [Interactive mode — code.claude.com](https://code.claude.com/docs/en/interactive-mode)
- [Claude Code changelog — github.com/anthropics/claude-code](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Sub-agents search results — docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
