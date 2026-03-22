# Research: Claude Agent SDK Latency Optimization

Date: 2026-03-20

## Summary

Comprehensive investigation into `@anthropic-ai/claude-agent-sdk` (formerly Claude Code SDK) `query()` options that affect response latency, tool discovery behavior, and performance characteristics. Covers all Options fields, the `tools` vs `allowedTools` distinction, `permissionTool`, `thinking`/`effort`, MCP tool search, and the streaming input mode pattern that Harness already implements.

## Prior Research

- `2026-03-20-claude-agent-sdk-production-deployment.md` — deployment patterns
- `2026-03-13-claude-agent-sdk-session-isolation.md` — session isolation patterns
- `2026-03-02-claude-agent-sdk-structured-output.md` — structured output

## Current Findings

### 1. The Fundamental Latency Problem

Every `query()` call spawns a new subprocess. Cold-start overhead is consistently ~12 seconds regardless of prompt complexity:

```
Query 1: 13.41s
Query 2: 12.44s
Query 3: 11.80s
Direct Messages API: 1-3s
```

Source: https://github.com/anthropics/claude-agent-sdk-typescript/issues/34 (closed Oct 2025)

**Anthropic's recommended solution:** Use streaming input mode (AsyncIterable prompt) to keep the subprocess alive between turns. Subsequent warm messages drop to ~2–3s. This is what Harness already implements in `create-session.ts` via the async generator pattern.

### 2. `allowedTools` — Permission Control, NOT Tool Discovery Restriction

**Critical distinction documented in official reference:**

> `allowedTools`: Tools to auto-approve without prompting. **This does not restrict Claude to only these tools**; unlisted tools fall through to `permissionMode` and `canUseTool`. Use `disallowedTools` to block tools.

Source: https://platform.claude.com/docs/en/agent-sdk/typescript (Options table)

`allowedTools` is a **permission list**, not a schema filter. Setting `allowedTools: ["Read"]` does NOT prevent Claude from seeing or attempting to use `Bash`. It only means:
- Listed tools: auto-approved without prompting
- Unlisted tools: fall through to `permissionMode` and `canUseTool`

**`allowedTools` does NOT skip tool discovery. Tool schemas are loaded regardless.**

To actually restrict what Claude can attempt: use `disallowedTools` or pair `allowedTools` with `permissionMode: "dontAsk"` (TypeScript only). `dontAsk` denies any tool not in the pre-approved list instead of prompting.

### 3. `tools` Option — The Real Tool Schema Restrictor

The `tools` option (distinct from `allowedTools`) controls which built-in tool schemas are presented to Claude:

```typescript
tools: string[] | { type: 'preset'; preset: 'claude_code' }
```

- Pass an array of tool names: only those tools' schemas are available to Claude
- Pass `{ type: 'preset', preset: 'claude_code' }`: Claude Code's full default tool set
- Omit entirely: minimal default tool set

**If you want to reduce context by limiting tool schemas, use `tools` not `allowedTools`.**

### 4. `permissionMode` and `permissionPromptToolName`

`permissionMode` options:
- `'default'` — standard, prompts on unmatched tools
- `'acceptEdits'` — auto-approves file edits/filesystem ops
- `'bypassPermissions'` — skips all permission checks (requires `allowDangerouslySkipPermissions: true`)
- `'plan'` — no tool execution, planning only
- `'dontAsk'` (TypeScript only) — denies anything not pre-approved

`permissionPromptToolName` (documented as `permissionPromptToolName` in Options):
- An MCP tool name that handles permission prompts interactively
- This is the `permissionTool` mentioned in community discussions — it is an MCP tool that Claude calls when it needs permission to use another tool
- Adds latency because it requires an additional tool call round-trip for each permission request
- For maximum speed: use `permissionMode: 'bypassPermissions'` to eliminate all permission prompt overhead entirely

**Harness already uses `bypassPermissions` + `allowDangerouslySkipPermissions: true` — optimal.**

### 5. `thinking` and `effort` — Extended Thinking Control

```typescript
type ThinkingConfig =
  | { type: "adaptive" }         // Model decides when/how much to think (default for Opus 4.6+)
  | { type: "enabled"; budgetTokens?: number }  // Fixed token budget
  | { type: "disabled" };        // No extended thinking
```

```typescript
effort: 'low' | 'medium' | 'high' | 'max'  // default: 'high'
```

`effort` controls thinking depth for adaptive thinking. `thinking` is the explicit config. They are alternatives — use one or the other.

**Effect on latency:**
- `thinking: { type: 'disabled' }` — fastest, no reasoning overhead (Haiku doesn't support thinking anyway)
- `effort: 'low'` — minimal thinking, lower latency
- `effort: 'medium'` — moderate (good balance for Sonnet)
- `effort: 'high'` — deep thinking (default, slowest)
- `effort: 'max'` — maximum budget

**Harness currently uses:**
- Haiku: `thinking: { type: 'disabled' }` ✅
- Sonnet: `effort: 'medium'` ✅
- Opus: `effort: 'high'` ✅

This is already the optimal configuration per model tier.

### 6. MCP Tool Discovery and `ENABLE_TOOL_SEARCH`

When many MCP tools are configured, tool definitions consume context window. The SDK has a built-in "Tool Search" mechanism:

```
ENABLE_TOOL_SEARCH environment variable:
  'auto'    — activates when MCP tools exceed 10% of context (default)
  'auto:5'  — activates at 5% threshold
  'true'    — always enabled
  'false'   — disabled, all MCP tools loaded upfront
```

**How it works when triggered:**
1. MCP tools are marked `defer_loading: true` — schemas NOT loaded into context upfront
2. Claude uses a special search tool to discover tools on-demand
3. Only tools Claude actually requests are loaded

**Requirement:** Only works with Sonnet 4+ or Opus 4+. Haiku does NOT support tool search.

Set via the `env` option:
```typescript
options: {
  env: { ENABLE_TOOL_SEARCH: 'auto' }
}
```

This is the only mechanism to avoid loading all MCP tool schemas upfront. There is NO way to pre-specify schemas via the SDK `query()` call — tool schemas come from the MCP server discovery process at session start.

### 7. `mcpServers` vs `tools`

These are completely different mechanisms:

| Option | What it does |
|--------|-------------|
| `mcpServers` | Connects external MCP servers (stdio/SSE/HTTP/SDK). Tools discovered via MCP protocol at session init. |
| `tools` | Specifies which built-in (Claude Code built-in) tools to load. Does NOT affect MCP tools. |

You cannot pass raw tool schemas directly to `query()` to bypass MCP discovery. If you want custom tools without MCP overhead, use `createSdkMcpServer()` which runs in-process (no subprocess spawn) but still goes through MCP protocol internally.

**SDK MCP servers require streaming input mode** (AsyncIterable prompt). They cannot be used with string prompts.

### 8. `maxTurns` — Preventing Runaway Tool Loops

```typescript
maxTurns: number  // undefined = unlimited
```

Setting a low `maxTurns` (e.g., 1 for simple Q&A, 3 for focused tasks) stops the agent loop early and eliminates unnecessary tool-use round trips. Each turn adds at least one API call latency.

For pure Q&A with no tools needed: `maxTurns: 1`.

### 9. `systemPrompt` and `settingSources`

```typescript
systemPrompt: string | { type: 'preset'; preset: 'claude_code'; append?: string }
settingSources: ('user' | 'project' | 'local')[]  // default: [] (no filesystem loading)
```

**Performance implication:** Setting `settingSources` causes the subprocess to read filesystem settings files at startup. Omitting it (the default) skips this I/O entirely. For Harness, which manages all configuration programmatically, `settingSources: []` (the default) is already optimal.

**`systemPrompt` as a string** (not the preset object) replaces Claude Code's default system prompt with a minimal one, reducing tokens-per-call.

### 10. `persistSession` — Eliminating Session File I/O

```typescript
persistSession: boolean  // default: true
```

When `true` (default), the SDK writes session transcripts to `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` after every message. Setting `persistSession: false` disables this, eliminating disk I/O per message.

**Trade-off:** Cannot resume sessions that were not persisted. Since Harness uses the streaming async generator pattern (sessions are long-lived in memory), `persistSession: false` could reduce per-message overhead.

### 11. `model` — Fastest Available Model

Haiku is the fastest model by far. For tasks that don't require deep reasoning:
- `claude-haiku-4-5-20251001` — fastest, cheapest, no extended thinking

For models supporting thinking:
- Sonnet: best balance of speed and quality
- Opus: slowest, most expensive, deepest reasoning

### 12. Streaming Input Mode (Already Implemented in Harness)

The most impactful latency optimization. Harness already implements this correctly in `create-session.ts`:

```typescript
// Async generator keeps subprocess alive
const messageStream = async function* (): AsyncGenerator<SDKUserMessage> {
  while (alive) {
    const msg = await new Promise<SDKUserMessage>((resolve) => {
      yieldResolver = resolve;
      drainQueue();
    });
    yield msg;
  }
};

const q = query({
  prompt: messageStream(),  // AsyncIterable keeps process warm
  options: { ... }
});
```

Cold start penalty (first message): ~12s
Warm messages (subsequent): ~2–3s

Session pool (max 8, 8-min TTL) ensures warm sessions are reused per thread.

## Options Latency Impact Summary

| Option | Latency Impact | Notes |
|--------|---------------|-------|
| `prompt: AsyncIterable` | **CRITICAL** — ~77% reduction on warm calls | Already implemented in Harness |
| `thinking: { type: 'disabled' }` | High — eliminates reasoning overhead | Use for Haiku |
| `effort: 'low'` | High — minimal thinking budget | Use for simple tasks |
| `maxTurns: N` | High — prevents runaway loops | Set low for known-simple tasks |
| `tools: [...]` | Medium — reduces context length | Fewer tool schemas = smaller prompt |
| `ENABLE_TOOL_SEARCH: 'auto'` | Medium — defers MCP schema loading | Only Sonnet 4+ / Opus 4+ |
| `persistSession: false` | Low — eliminates session file I/O | Loses resume capability |
| `settingSources: []` | Low — skips filesystem reads | Already default |
| `allowedTools` | None on latency | Permission control only, not schema filter |
| `permissionMode: 'bypassPermissions'` | Low — eliminates permission prompt overhead | Already implemented in Harness |
| `model: 'haiku'` | Very High — fastest model | Trade-off: less capable |
| `systemPrompt: string` | Low — smaller system prompt | Replaces large Claude Code prompt |

## What allowedTools Does NOT Do

Common misconception: `allowedTools: ["Read", "Glob"]` does NOT:
- Prevent other tool schemas from being sent to Claude
- Skip MCP tool discovery for unlisted tools
- Make Claude unaware of unlisted tools

It ONLY:
- Auto-approves listed tools without permission prompts

To actually restrict tool availability, use `tools: ["Read", "Glob"]` for built-in tools, or `disallowedTools` to explicitly block.

## Key Takeaways

1. **Streaming input mode is the single most important optimization** — Harness already implements it
2. **`allowedTools` is a permission list, not a schema filter** — it has no latency impact
3. **`tools` (the built-in tool schema option) does reduce context** — fewer schemas = faster processing
4. **`thinking: disabled` / `effort: low`** are the fastest configurations — use per model tier
5. **MCP tool search (`ENABLE_TOOL_SEARCH`)** is the only way to defer schema loading for MCP tools
6. **No way to inject raw tool schemas to bypass MCP discovery** — it's always a protocol-level discovery
7. **`permissionPromptToolName`** adds a tool-call round trip per permission — avoid with `bypassPermissions`

## Sources

- https://platform.claude.com/docs/en/agent-sdk/overview — SDK overview
- https://platform.claude.com/docs/en/agent-sdk/typescript — Full TypeScript Options reference
- https://platform.claude.com/docs/en/agent-sdk/mcp — MCP configuration and tool search
- https://platform.claude.com/docs/en/agent-sdk/custom-tools — In-process SDK MCP servers
- https://platform.claude.com/docs/en/agent-sdk/permissions — Permission modes and allow/deny rules
- https://platform.claude.com/docs/en/agent-sdk/sessions — Session management and resume
- https://github.com/anthropics/claude-agent-sdk-typescript/issues/34 — The ~12s overhead issue
- https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk — npm package page
