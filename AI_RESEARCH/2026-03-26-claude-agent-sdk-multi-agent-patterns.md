# Research: Claude Agent SDK — Multi-Agent Orchestration Patterns

Date: 2026-03-26

## Summary

The `@anthropic-ai/claude-agent-sdk` (formerly Claude Code SDK) provides a thin orchestration layer wrapping the Claude Code CLI subprocess. Its primary multi-agent primitive is **subagents** — declaratively defined agent instances spawned via the `Agent` tool. The SDK's parallelism model is emergent: Claude itself decides when to fan out to subagents; the SDK provides no explicit `Promise.all`-style coordination API. Long-running agent coordination is session-based with persistent transcripts. Harness already uses this SDK heavily via `invoker-sdk` with a custom session pool on top of the `query()` function.

## Prior Research

None on this specific topic. Related prior work:
- `2026-02-24-claude-cli-streaming-cold-start.md` — latency characteristics of the Claude CLI subprocess
- `2026-02-22-claude-code-ecosystem-state.md` — broader Claude Code ecosystem overview

---

## Current Findings

### 1. Core Primitive: `query()`

The only stable entry point for agent invocation.

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query; // extends AsyncGenerator<SDKMessage, void>
```

- Returns an async generator that streams `SDKMessage` events as Claude works
- Accepts either a static string prompt or an `AsyncIterable<SDKUserMessage>` for multi-turn streaming mode
- The `Query` object extends `AsyncGenerator` and adds runtime control methods: `interrupt()`, `rewindFiles()`, `setPermissionMode()`, `stopTask()`, `close()`

**How Harness uses it:** `create-session.ts` feeds `query()` a live async generator (`messageStream`) that stays open indefinitely. Each `send()` call yields a new message into the generator, keeping the subprocess warm between invocations. This is Harness's custom session pool pattern on top of the raw SDK.

### 2. Multi-Agent Primitive: Subagents (via `agents` option)

**This is the only first-class multi-agent primitive the SDK provides.**

```typescript
options: {
  allowedTools: ["Read", "Grep", "Glob", "Agent"], // "Agent" tool required
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer. Use for quality, security, and maintainability reviews.",
      prompt: "You are a code review specialist...",
      tools: ["Read", "Grep", "Glob"],    // subset of parent tools
      model: "sonnet"                      // per-subagent model override
    }
  }
}
```

**`AgentDefinition` shape:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Tells Claude when to use this subagent (matching is semantic, not string) |
| `prompt` | `string` | Yes | The subagent's system prompt / identity |
| `tools` | `string[]` | No | Tool allowlist for this subagent. Omit to inherit all parent tools |
| `model` | `'sonnet' \| 'opus' \| 'haiku' \| 'inherit'` | No | Model override. Defaults to parent's model |

**Critical constraint:** Subagents cannot spawn their own subagents. The `Agent` tool must not be in a subagent's `tools` array.

**How invocation happens:** The parent Claude model calls the `Agent` tool (previously called `Task` in SDK versions before v2.1.63). Invocation can be:
- **Automatic** — Claude matches the task to a subagent by `description` field
- **Explicit** — mention subagent name in the prompt: "Use the code-reviewer agent to..."
- **Built-in** — even without defining agents, Claude can spawn a generic `general-purpose` subagent if `Agent` is in `allowedTools`

### 3. Fan-Out / Fan-In Pattern

**The SDK has no explicit parallel execution API.** Fan-out is emergent:

1. The main agent's prompt instructs it to use multiple subagents
2. Claude internally dispatches multiple Agent tool calls
3. Because the SDK subprocess handles tool calls, multiple subagents can run concurrently
4. The main agent receives all subagent results and synthesizes (fan-in)

The official Research Agent demo demonstrates this: the main agent breaks a research topic into subtopics and spawns parallel researcher subagents. From the SDK's perspective this looks like ordinary tool use — the SDK itself provides no `Promise.all` or batch spawn API.

**Tracking which messages belong to which subagent:**
- Parent messages that invoke a subagent contain `tool_use` blocks where `name === "Agent"` (or `"Task"` in older SDK versions)
- Messages from within a subagent's execution include `parent_tool_use_id` field
- The `block.input.subagent_type` field names the specific subagent invoked

```typescript
// Detect subagent invocations and messages
for await (const message of query({ ... })) {
  const msg = message as any;

  // Detect fan-out: parent calling a subagent
  for (const block of msg.message?.content ?? []) {
    if (block.type === "tool_use" && (block.name === "Task" || block.name === "Agent")) {
      console.log(`Subagent spawned: ${block.input.subagent_type}`);
    }
  }

  // Detect messages originating from within a subagent
  if (msg.parent_tool_use_id) {
    console.log("  (inside subagent execution)");
  }
}
```

### 4. Context Isolation — What Subagents Inherit

This is architecturally important for designing multi-agent prompts:

| Subagent DOES receive | Subagent does NOT receive |
|----------------------|--------------------------|
| Its own `AgentDefinition.prompt` (system prompt) | Parent's conversation history |
| The `Agent` tool's `prompt` argument (the task prompt from parent) | Parent's system prompt |
| Project `CLAUDE.md` (if `settingSources: ['project']`) | Parent's tool call results |
| Tool definitions from `tools` field | Skills (unless listed in `AgentDefinition.skills`) |

**Key design implication:** All context a subagent needs must be passed explicitly via the Agent tool's prompt string. The parent cannot share state with a subagent through environment — only through text.

### 5. Session Primitives

**Session ID capture:** Available from `SDKResultMessage.session_id` (always present on result) or the `system:init` message.

**Resume a specific session:**
```typescript
query({ prompt: "follow-up", options: { resume: sessionId } })
```

**Continue most recent session (no ID needed):**
```typescript
query({ prompt: "follow-up", options: { continue: true } })
```

**Fork a session (explore alternative without losing original):**
```typescript
query({ prompt: "try JWT instead", options: { resume: sessionId, forkSession: true } })
```

**Session storage:** Sessions are stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. They are local to the machine — cross-host resume requires copying the `.jsonl` file with matching `cwd`.

**`listSessions()` / `getSessionMessages()`** — utility functions to enumerate and read session transcripts programmatically.

**Subagent transcripts persist independently** from the main conversation. They can be resumed via `agentId` + parent `sessionId`.

### 6. V2 Session API (Preview — Unstable)

A simpler multi-turn interface using `createSession()` / `resumeSession()`:

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });
await session.send("Analyze the auth module");
for await (const msg of session.stream()) { /* ... */ }
await session.send("Now refactor it");
for await (const msg of session.stream()) { /* ... */ }
```

**`SDKSession` interface:**
```typescript
interface SDKSession {
  readonly sessionId: string;
  send(message: string | SDKUserMessage): Promise<void>;
  stream(): AsyncGenerator<SDKMessage, void>;
  close(): void;
}
```

**Status:** Marked `unstable_v2_*` — APIs may change. Session forking (`forkSession`) not yet available in V2. V1 `query()` is stable.

**How Harness already replicates this:** `create-session.ts` manually implements the send/stream split using an async generator fed to `query()`. Harness's pattern predates V2 and effectively does the same thing at a lower level.

### 7. Hooks System

Hooks intercept agent lifecycle events for custom behavior. Passed via `options.hooks`.

**All available hook events:**

| Hook | Fires when | Can block? | Notes |
|------|-----------|------------|-------|
| `PreToolUse` | Tool call requested | Yes | Can deny, modify input, auto-approve |
| `PostToolUse` | Tool executed | No | Can add context to result |
| `PostToolUseFailure` | Tool failed | No | Error handling/logging |
| `UserPromptSubmit` | User prompt submitted | No | Can inject additional context |
| `Stop` | Agent execution ends | No | Cleanup, save state |
| `SubagentStart` | Subagent initializes | No | Track parallel spawning |
| `SubagentStop` | Subagent completes | No | Aggregate results from parallel tasks |
| `PreCompact` | Conversation compaction | No | Archive full transcript |
| `PermissionRequest` | Permission dialog | Yes | Custom permission handling |
| `SessionStart` | Session initializes | No | TypeScript only |
| `SessionEnd` | Session terminates | No | TypeScript only |
| `Notification` | Agent status messages | No | Forward to Slack, PagerDuty, etc. |
| `TeammateIdle` | Teammate becomes idle | No | TypeScript only — reassign work |
| `TaskCompleted` | Background task completes | No | TypeScript only |
| `ConfigChange` | Config file changes | No | TypeScript only |

**`SubagentStop` hook input** includes `agent_id`, `agent_transcript_path`, and `stop_hook_active` — enabling supervisor patterns that react to subagent completion.

**Hook callback signature (TypeScript):**
```typescript
type HookCallback = (
  input: HookInput,
  toolUseId: string | undefined,
  context: { signal: AbortSignal }
) => Promise<HookOutput>;
```

**`PreToolUse` output structure:**
```typescript
return {
  systemMessage: "Optional message injected into conversation",
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow" | "deny" | "ask",
    permissionDecisionReason: "...",
    updatedInput: { ...modifiedToolInput }  // requires permissionDecision: "allow"
  }
};
```

Return `{}` to allow without modification.

### 8. Key `Options` Fields Relevant to Multi-Agent Work

From the complete `Options` type:

| Option | Type | Notes |
|--------|------|-------|
| `agents` | `Record<string, AgentDefinition>` | Define subagents |
| `agent` | `string` | Name the main agent (must be in `agents` or filesystem) |
| `allowedTools` | `string[]` | Auto-approved tools. Must include `"Agent"` for subagent use |
| `disallowedTools` | `string[]` | Overrides `allowedTools` — always denied |
| `permissionMode` | `'default' \| 'acceptEdits' \| 'bypassPermissions' \| 'dontAsk'` | Harness uses `bypassPermissions` |
| `maxTurns` | `number` | Limit tool-use round trips |
| `maxBudgetUsd` | `number` | Cost cap |
| `effort` | `'low' \| 'medium' \| 'high' \| 'max'` | Controls thinking depth |
| `thinking` | `ThinkingConfig` | Direct thinking control |
| `hooks` | Hook config | See hooks section |
| `mcpServers` | `Record<string, McpServerConfig>` | External tool servers |
| `systemPrompt` | `string \| { type: 'preset', preset: 'claude_code', append?: string }` | Override system prompt |
| `resume` | `string` | Resume by session ID |
| `continue` | `boolean` | Resume most recent session |
| `forkSession` | `boolean` | Fork on resume |
| `persistSession` | `boolean` | Disable disk persistence (TypeScript only) |
| `cwd` | `string` | Working directory for the subprocess |
| `spawnClaudeCodeProcess` | custom spawn fn | Run in VMs, containers, remote hosts |
| `outputFormat` | `{ type: 'json_schema', schema }` | Structured output from agent |
| `settingSources` | `SettingSource[]` | Load CLAUDE.md, .claude/settings.json from filesystem |

### 9. How the SDK Differs from Claude Code's Agent Tool

| Dimension | SDK (`query()`) | Claude Code Agent Tool |
|-----------|----------------|----------------------|
| Execution model | Subprocess spawned by your Node.js process | Subprocess spawned by Claude's own runtime |
| Invocation | Programmatic (`query()` / `send()`) | Claude decides to call `Agent` tool |
| Context sharing | No parent context inheritance | Same — subagent gets fresh context |
| Parallelism control | Emergent (Claude decides when to fan out) | Same |
| Session persistence | To `~/.claude/projects/` `.jsonl` files | Same backing store |
| Lifecycle | You manage pool, timeouts, teardown | Managed by Claude Code CLI |

The SDK is "Claude Code as a library." The Agent tool in Claude Code is Claude Code invoking itself recursively. The underlying mechanism is the same subprocess + session model — the difference is who drives the lifecycle.

### 10. Supervisor/Worker Pattern

The SDK has no native supervisor primitive. The recommended approach:

1. Define worker subagents in `agents: { ... }`
2. Write the main agent's `systemPrompt` / prompt to describe the supervisor role
3. Use `SubagentStop` hooks to collect worker results as they complete
4. Use `parent_tool_use_id` to correlate worker output back to the specific dispatch

For dynamic worker counts (fan-out N workers where N is not known in advance), the main Claude model must decide how many Agent tool calls to make. The SDK orchestrator cannot inject additional workers mid-stream.

**Practical pattern from Research Agent demo:**
```
main prompt → "Research these 5 subtopics in parallel using researcher subagents"
→ Claude spawns 5 concurrent Agent tool calls
→ Each researcher subagent runs, returns findings
→ Main agent receives all 5 results and synthesizes
```

The "parallel" execution happens because the Claude model issues multiple tool calls simultaneously, not because the SDK provides a parallel execution primitive.

---

## Harness-Specific Observations

### What Harness Does Today

`apps/orchestrator/src/invoker-sdk/create-session.ts` implements a custom session multiplexing layer:

1. Calls `query()` once with an open-ended async generator as the prompt stream
2. Keeps the subprocess warm between invocations (queue of pending requests fed to the generator)
3. Implements its own session pool with LRU eviction (`maxSessions: 8`, `ttlMs: 35min`)
4. Per-session `contextRef` updated on each send to pass `threadId`, `traceId`, `taskId` to MCP tool handlers

This is essentially a hand-rolled version of what `unstable_v2_createSession` now provides — but with the addition of a session pool and MCP tool context plumbing.

### What Harness Does NOT Use

- **SDK subagents** (`agents` option) — Harness has its own delegation plugin that spawns sub-agents by calling `ctx.sendToThread()`, creating separate task threads with full DB persistence. This is architecturally different from SDK subagents (which are ephemeral subprocess invocations).
- **SDK hooks** (`options.hooks`) — Harness's hook system is its plugin system (`PluginHooks`), not SDK-level hooks.
- **Session resume/fork** — Harness's session pool keeps the subprocess alive; it does not use `resume`/`continue`/`forkSession`.
- **`persistSession: false`** — Harness lets sessions persist to disk (default), using `os.tmpdir()` as `cwd` to avoid loading project config files.

### Gap: Harness Delegation vs SDK Subagents

Harness's delegation plugin creates full DB-tracked task threads, runs the validator, and delivers results via cross-thread notification. This is heavier than SDK subagents, which are ephemeral subprocess calls. For workspace orchestration (spawning multiple coding agents for parallel tasks), the delegation approach gives full visibility, persistence, and quality gating. SDK subagents would be lighter but lose DB tracking and validator integration.

---

## Key Takeaways

1. **The SDK's multi-agent story is subagents.** `agents: { ... }` + `allowedTools: ["Agent"]` is the only first-class SDK primitive. Everything else (fan-out, fan-in, supervisor/worker) is implemented at the Claude model layer via prompt design.

2. **Parallelism is emergent, not explicit.** The SDK provides no `Promise.all([subagent1, subagent2])` API. Claude decides to dispatch multiple Agent tool calls concurrently based on the prompt.

3. **Context isolation is strict.** Subagents get a fresh context window. The only channel from parent to subagent is the `prompt` string in the Agent tool call.

4. **Sessions are file-based, local.** Cross-host session resume requires copying `.jsonl` files. `listSessions()` + `getSessionMessages()` enable programmatic session management.

5. **The V2 API (`unstable_v2_createSession`) is what Harness already implements manually.** No migration needed; Harness's pattern is more capable (session pool, MCP context ref, queue management).

6. **Hooks are rich for observability.** `SubagentStart`/`SubagentStop` hooks can track fan-out/fan-in progress. `PreToolUse` can block, redirect, or transform tool calls across the entire agent graph.

7. **SDK subagents are one-level deep.** Subagents cannot spawn further subagents. Harness's delegation plugin supports recursive delegation chains (parent → child → grandchild) because it uses `ctx.sendToThread()` outside the SDK subprocess.

---

## Gaps Identified

- **Parallel execution with N workers** — no SDK primitive for "spawn N subagents and collect results"; must be prompt-engineered
- **Dynamic worker addition** — cannot inject new subagent definitions mid-stream; all `agents` must be defined before `query()` is called
- **Cross-subagent state sharing** — no shared memory or message bus between sibling subagents; coordination must go through the parent
- **Subagent recursion** — hard limit of one level deep in SDK subagents
- **Cross-host session resume** — requires manual file transport; no built-in distributed session store

---

## Sources

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Anthropic official docs
- [Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) — Anthropic official docs
- [Subagents documentation](https://platform.claude.com/docs/en/agent-sdk/subagents) — Anthropic official docs
- [Sessions documentation](https://platform.claude.com/docs/en/agent-sdk/sessions) — Anthropic official docs
- [TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript) — Anthropic official docs (full Options type, all exported functions)
- [TypeScript V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) — Anthropic official docs
- [Hooks documentation](https://platform.claude.com/docs/en/agent-sdk/hooks) — Anthropic official docs
- [claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos) — Anthropic official demos (Research Agent fan-out pattern)
- [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) — Official TypeScript SDK repo
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — Package registry
- Harness source: `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/` — current SDK usage
