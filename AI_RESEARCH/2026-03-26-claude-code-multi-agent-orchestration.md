# Claude Code Multi-Agent Orchestration Research

**Date:** 2026-03-26
**Trigger:** bug-hunt and test-hunt skills fail because SendMessage can't reach completed sub-agents
**Claude Code Version:** 2.1.78

---

## Root Cause: SendMessage Is Gated Behind an Experimental Flag

**The entire failure is caused by one thing:** `SendMessage` is part of the Agent Teams toolset, gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, which is **disabled by default**.

When the bug-hunt/test-hunt skills spawn 3 agents and wait for them to complete, then try to use `SendMessage` to send cross-review findings:

1. Each agent completes Round 0 and returns its report
2. The orchestrator tries to `SendMessage({to: 'bug-hunt-alpha'})` to relay findings
3. **`SendMessage` does not exist in the tool list** — it's behind the experimental flag
4. Claude either fails silently or tries to spawn a new Agent (which creates a fresh context with zero prior knowledge)

The official docs say: *"If a stopped subagent receives a SendMessage, it auto-resumes in the background without requiring a new Agent invocation."* This is accurate but **only works when the flag is enabled**.

### Fix

```bash
# Add to environment (shell profile, .env, or settings.json)
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Known Issues Even With the Flag Enabled

| Issue | GitHub # | Status |
|-------|----------|--------|
| SendMessage gated behind Agent Teams flag | #35240 | OPEN |
| Background agent resume creates retry loop when agent still running | #32085 | OPEN |
| Subagent resume missing all user prompts | #11712 | Existing |
| 400 error on resume after tool use (tool_use_id mismatch) | #13619 | Existing |
| Background subagent completion notifications delayed until user interaction | #39335 | OPEN |

---

## Two Models of Multi-Agent Coordination

### Model A: Subagents (Stable, Default)

Single session. Parent manages all work. Sub-agents only report back to the parent — they **never communicate with each other**. Lower token cost.

**Lifecycle:**
- Spawned via `Agent` tool with `name`, `prompt`, `subagent_type`
- Terminate when they produce a final text response with no tool calls
- Also terminate on `maxTurns`, `maxBudgetUsd`, or error
- Transcript persists as `.jsonl` under `~/.claude/projects/{project}/{sessionId}/subagents/`
- Can be resumed via `SendMessage({to: agentId})` — **requires Agent Teams flag**

**Constraints:**
- Sub-agents **cannot spawn other sub-agents** (one level deep max)
- Only the final message returns to parent; intermediate tool calls stay in subagent context
- No shared state between sibling subagents
- All coordination goes through parent's text output

**Best for:** Focused tasks, context isolation, parallel research, sequential chaining

### Model B: Agent Teams (Experimental)

Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Separate Claude Code sessions. Teammates communicate directly via a mailbox system. Shared task list with self-coordination and dependency tracking.

**Features:**
- Direct inter-agent messaging (not just parent-child)
- Shared task list with dependency tracking
- Plan approval workflows
- Quality gate hooks (`TeammateIdle`, `TaskCreated`, `TaskCompleted`)

**Limitations:**
- No session resumption with in-process teammates
- One team per session
- No nested teams
- Significantly higher token cost
- Experimental — may change or break

**Best for:** Complex work requiring debate, cross-layer implementation, adversarial review

---

## Impact on Harness Multi-Agent Patterns

### Current Skills and Their Requirements

| Skill | Pattern | Requires SendMessage? | Requires Agent Teams? |
|-------|---------|----------------------|----------------------|
| `/bug-hunt` | 3 adversarial agents with cross-review rounds | YES | YES (for resume) |
| `/test-hunt` | 3 adversarial agents with cross-review rounds | YES | YES (for resume) |
| `/do` | Single agent per phase, no inter-agent comms | NO | NO |
| `/engine` | Parallel worktree agents, no inter-agent comms | NO | NO |
| `/research` | Parallel research agents, results collected by parent | NO | NO |

### Recommended Architecture by Pattern Type

**Pattern 1: Fan-out / Fan-in (No Inter-Agent Communication)**
- Spawn N agents in parallel (single message, multiple Agent tool calls)
- Wait for all to complete
- Parent synthesizes results
- **No SendMessage needed** — works with default subagents
- Used by: `/do`, `/engine`, `/research`

**Pattern 2: Adversarial Cross-Review (Requires Inter-Agent Communication)**
- Round 0: Spawn N agents, wait for completion
- Round 1+: Send each agent the others' findings, wait for responses
- Repeat until convergence
- **Requires SendMessage + Agent Teams flag**
- Used by: `/bug-hunt`, `/test-hunt`

**Pattern 3: Restructured Cross-Review (No SendMessage Needed)**
- Round 0: Spawn N agents, collect results
- Round 1+: Spawn N **new** agents, passing prior round's findings in the initial prompt
- Each round creates fresh agents with the accumulated context
- **No SendMessage needed** — works with default subagents
- Higher token cost but no experimental feature dependency

---

## Recommended Actions

### Immediate: Enable Agent Teams Flag

Add to settings or environment:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

This unblocks bug-hunt and test-hunt immediately but depends on an experimental feature.

### Short-Term: Restructure Skills to Not Depend on SendMessage

Rewrite bug-hunt and test-hunt to use **Pattern 3** (fresh agents per round):

```
Round 0: Spawn alpha, beta, gamma → collect reports
Round 1: Spawn alpha-r1(prompt includes beta+gamma reports),
         beta-r1(prompt includes alpha+gamma reports),
         gamma-r1(prompt includes alpha+beta reports)
Round 2: Same pattern with Round 1 outputs
Converge: Parent synthesizes final report
```

**Advantages:**
- No experimental flag dependency
- No SendMessage timing issues
- Each agent gets a complete, clean context per round
- Works reliably on any Claude Code version

**Disadvantages:**
- Higher token cost (fresh context per round vs resumed context)
- Agents lose "memory" of their own reasoning between rounds (but receive their prior output)

### Long-Term: Watch Agent Teams Stabilization

Agent Teams is the correct primitive for adversarial multi-agent work. When it exits experimental:
- Direct inter-agent messaging eliminates parent-as-relay
- Shared task lists enable self-coordination
- Quality gate hooks provide structured convergence detection

---

## Claude Agent SDK Perspective

The SDK (`@anthropic-ai/claude-agent-sdk`) offers the same subagent mechanism used by Claude Code internally. Key points for Harness:

- **No explicit parallel execution API** — fan-out is prompt-engineered
- **Subagents are one level deep** — no recursive spawning
- **No shared state between siblings** — all coordination through parent
- **`SubagentStart`/`SubagentStop` hooks** available for tracking worker progress
- **Harness's delegation plugin** (via `ctx.sendToThread`) is architecturally superior for DB-persisted, recursive, quality-gated delegation chains

The SDK subagent model is best for lightweight, ephemeral subtasks within a single invocation. Harness's plugin-based delegation system is better for production multi-agent workflows.

---

## Source Registry

| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Claude Code sub-agents docs | https://code.claude.com/docs/en/sub-agents | PRIMARY | Official, current |
| Claude Code agent teams docs | https://code.claude.com/docs/en/agent-teams | PRIMARY | Experimental feature |
| Agent SDK subagents | https://platform.claude.com/docs/en/agent-sdk/subagents | PRIMARY | SDK perspective |
| Agent SDK sessions | https://platform.claude.com/docs/en/agent-sdk/sessions | PRIMARY | Session persistence |
| Agent SDK hooks | https://platform.claude.com/docs/en/agent-sdk/hooks | PRIMARY | SubagentStart/Stop |
| GitHub #35240 | https://github.com/anthropics/claude-code/issues/35240 | PRIMARY | Root cause bug |
| GitHub #32085 | https://github.com/anthropics/claude-code/issues/32085 | PRIMARY | Resume retry loop |
| GitHub #35973 | https://github.com/anthropics/claude-code/issues/35973 | PRIMARY | Duplicate confirmation |
| GitHub #36196 | https://github.com/anthropics/claude-code/issues/36196 | PRIMARY | Duplicate confirmation |
| claude-agent-sdk-demos | https://github.com/anthropics/claude-agent-sdk-demos | PRIMARY | Official examples |
