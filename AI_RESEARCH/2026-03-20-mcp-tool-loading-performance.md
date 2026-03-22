# Research: MCP Tool Loading Performance
Date: 2026-03-20

## Summary

MCP tool loading has two modes: **eager** (all schemas in every context window, the default) and **deferred** (schema stubs only; full schemas fetched on-demand via a search tool). The Claude Agent SDK and Claude Code CLI both support deferred loading via the `ENABLE_TOOL_SEARCH` environment variable. The MCP specification itself has no concept of deferred loading — it is entirely a client/framework-level optimization. The harness `invoker-sdk` does not currently pass `ENABLE_TOOL_SEARCH` into sessions, which means it is running in eager mode by default.

## Prior Research

None on this exact topic. Related: `2026-02-26-documentation-pipeline-mcp-research.md`.

## Current Findings

### 1. Eager vs Deferred Loading

**Eager loading (the default):**
- On session initialization, the Claude subprocess calls `tools/list` on every configured MCP server
- All tool definitions (name + description + full JSON Schema) are serialized into every API call's system prompt
- With Harness's current plugin count (22+ plugins, each potentially with multiple tools), this can easily reach 50-100 tool definitions
- Token cost benchmarks: a five-server MCP setup can consume ~72,000 tokens in tool definitions before conversation begins; a two-server Chrome MCP setup alone consumed 31.7k tokens in one real-world report

**Deferred loading:**
- Tool name and short description only appear in the system prompt inside an `<available-deferred-tools>` section
- Full JSON Schemas are NOT sent to the model upfront
- Claude uses a built-in "Tool Search Tool" to look up relevant tools by name/description when it needs them
- The resolved full schema for a matched tool is then injected into context at use time
- One extra round-trip per "tool discovery" event, but only pays that cost for tools actually needed

### 2. MCP Specification vs Client Implementation

The MCP specification (2025-06-18) defines only two protocol operations:
- `tools/list` — client fetches all tool definitions from the server
- `tools/call` — client invokes a specific tool by name

The spec has **no concept of deferred loading, lazy schemas, or tool caching**. The `listChanged` capability flag lets servers notify clients when the tool list changes, but that is for invalidation, not performance. There is no `defer_loading` field in the MCP protocol itself.

Deferred loading is entirely a **Claude-side client optimization**. The `defer_loading: true` field appears in the Anthropic API's tool definition format (not in MCP protocol messages). When Claude Code or the Agent SDK enables tool search, it:
1. Calls `tools/list` on startup as normal (to know what tools exist)
2. Does NOT embed the full schemas in the system prompt
3. Uses the Tool Search Tool to re-fetch and inject relevant schemas on demand

Source: https://modelcontextprotocol.io/specification/2025-06-18/server/tools

### 3. The `defer_loading` API Field

At the Anthropic Messages API level, individual tools can be marked:
```json
{
  "name": "github.createPullRequest",
  "description": "Create a pull request",
  "input_schema": {},
  "defer_loading": true
}
```

For MCP toolsets, the field can be set as a default with per-tool overrides:
```json
{
  "type": "mcp_toolset",
  "mcp_server_name": "google-drive",
  "default_config": {"defer_loading": true},
  "configs": {
    "search_files": {"defer_loading": false}
  }
}
```

Tools with `defer_loading: false` (or without the field) are always loaded eagerly — good for 1-3 high-frequency tools you know Claude will use every session.

Source: https://www.anthropic.com/engineering/advanced-tool-use

### 4. ENABLE_TOOL_SEARCH — The Practical Control Knob

The Claude Agent SDK and Claude Code CLI expose tool search behavior via a single environment variable:

| Value | Behavior |
|---|---|
| `auto` (default) | Activates when MCP tool descriptions exceed **10% of context window** |
| `auto:N` | Activates at N% threshold (e.g., `auto:5` triggers at 5%) |
| `true` | Always enabled, regardless of tool count |
| `false` | Always disabled; all schemas loaded upfront |

This is passed via the `env` field in `query()` options:
```typescript
options: {
  mcpServers: { ... },
  env: {
    ENABLE_TOOL_SEARCH: "auto:5"
  }
}
```

Or persistently in `~/.claude/settings.json`:
```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "auto:0"
  }
}
```

**Known bug (as of Claude Code v2.1.7, January 2026):** The `tengu_mcp_tool_search: true` flag in `~/.claude.json` does NOT reliably activate tool search. The `ENABLE_TOOL_SEARCH` environment variable is required as the working trigger. This was reported as GitHub issue #18397 and closed as a duplicate of #18370, with no official Anthropic response confirming fix status.

Source: https://github.com/anthropics/claude-code/issues/18397

**Model support constraint:** Tool search (deferred loading) requires models that support `tool_reference` blocks:
- Sonnet 4 and later: YES
- Opus 4 and later: YES
- Haiku models: NO — tool search is not available

### 5. Performance Numbers (from Anthropic Engineering Blog)

| Setup | Without Tool Search | With Tool Search |
|---|---|---|
| Five-server MCP (typical) | ~72,000 tokens upfront | ~500 tokens upfront + ~3K on demand |
| Two Chrome MCP servers | 31.7k tokens (32% of context) | ~0 tokens upfront |
| Eight MCP servers | 70.5k tokens (35.3% of context) | 0 (on-demand) |

Context window recovery for heavy users: 50-100k tokens per session.

Accuracy improvements when tool library is large:
- Opus 4: 49% → 74% accuracy on MCP evaluations
- Opus 4.5: 79.5% → 88.1%

Round-trip cost of a ToolSearch call: one additional model inference turn. For a session that uses 5 distinct tools, that's 5 extra tool discovery calls before those tools become available. On Sonnet 4.5, this is typically 200-500ms per call.

Source: https://www.anthropic.com/engineering/advanced-tool-use

### 6. `mcpServers` Query Options — Full Shape

The `Options` type in `@anthropic-ai/claude-agent-sdk` (TypeScript SDK reference):

```typescript
mcpServers: Record<string, McpServerConfig>
```

`McpServerConfig` supports four transport types:
- `McpStdioServerConfig` — `{ command, args, env }`
- `McpSSEServerConfig` — `{ type: "sse", url, headers }`
- `McpHttpServerConfig` — `{ type: "http", url, headers }`
- `McpSdkServerConfigWithInstance` — `{ type: "sdk", instance }` (in-process)

**There are no tool-loading-specific fields on `McpServerConfig`** — no `cacheTools`, no `deferLoading`, no `alwaysAllow`. The only levers at the `query()` call level are:
- `allowedTools: string[]` — tools Claude can auto-approve (does NOT restrict which schemas are loaded)
- `disallowedTools: string[]` — tools always blocked
- `env: Record<string, string>` — environment variables including `ENABLE_TOOL_SEARCH`
- `permissionMode: "bypassPermissions" | "acceptEdits" | "default"` — permission flow

`allowedTools` is about **permission**, not **schema loading**. Tools not listed in `allowedTools` still have their full schemas sent to the model; Claude just can't use them without hitting the permission prompt.

The `strictMcpConfig: boolean` option enforces strict MCP validation but doesn't affect loading behavior.

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

### 7. MCP Tool Caching (Server-Side)

Some MCP client frameworks (OpenAI Agents SDK, FastMCP) expose a `cache_tools_list` option that caches the response from `tools/list` so the client doesn't re-query the server on every session initialization. This is **not** a feature of the Anthropic Agent SDK's MCP implementation — it is not exposed as a config option on `McpServerConfig`.

The Claude Agent SDK re-fetches `tools/list` on session initialization (i.e., when a new `query()` stream starts). The Harness session pool keeps sessions warm (8-minute TTL, max 8 sessions), which means `tools/list` is NOT called on every invocation — only when a new session is created. Warm sessions reuse the already-fetched tool list.

Source: https://openai.github.io/openai-agents-python/mcp/ (for comparison)

### 8. Harness `invoker-sdk` Current State

File: `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`

The session is created with:
```typescript
const q = query({
  prompt: messageStream(),
  options: {
    model,
    cwd: os.tmpdir(),
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    env,  // ← spreads process.env minus CLAUDECODE and ANTHROPIC_API_KEY
    ...(config?.mcpServerFactory ? { mcpServers: config.mcpServerFactory(contextRef) } : {}),
    ...(config?.thinking ? { thinking: config.thinking } : {}),
    ...(config?.effort ? { effort: config.effort } : {}),
  },
});
```

The `env` spread includes whatever `ENABLE_TOOL_SEARCH` value is in `process.env` at orchestrator startup. **If the orchestrator process was not started with `ENABLE_TOOL_SEARCH` set, tool search is off.** There is no explicit opt-in in the current code.

Given the "auto" default requires >10% of context to be consumed by tool descriptions, and Harness exposes 22+ plugins each with multiple tools, it is very likely the threshold is exceeded in practice — but the known bug (#18397) means auto-detection may not be reliably triggering even if the threshold is met.

The `SessionConfig` type accepted by `createSession` includes `mcpServerFactory` but no `enableToolSearch` flag.

### 9. `alwaysAllow` — What It Actually Means in Claude Code

In the Claude Code settings (`~/.claude/settings.json`), `tools[].alwaysAllow` is a permission concept, not a loading concept. It tells Claude Code to skip the "approve this tool call?" prompt for specific tools. It has zero effect on when or how tool schemas are fetched.

Source: https://code.claude.com/docs/en/mcp

### 10. Schema Pre-warming (Connection-Level)

The MCP SDK has a 60-second default timeout for server connections. For stdio servers (like Harness's plugin tool server), this is the `npx` startup time. Once connected, `tools/list` is called and schemas are fetched once per session.

The Harness `prewarm()` method on the invoker creates a warm session ahead of first use:
```typescript
const prewarm = (options: { threadId: string; model?: string }) => {
  const model = options.model ?? config.defaultModel;
  pool.get(options.threadId, model);
};
```

This is called by the web plugin via `POST /api/prewarm`. It creates the session (spawning the Claude subprocess) and establishing MCP connections before the first real invocation, eliminating cold-start latency. This means MCP tool schemas are loaded at prewarm time, not at first message time.

## Key Takeaways

1. **Deferred loading is not an MCP spec feature** — it is a Claude client-side optimization. The MCP protocol always delivers full schemas via `tools/list`.

2. **The single control lever is `ENABLE_TOOL_SEARCH`** — passed as an env var. Options: `auto` (default, 10% threshold), `auto:N`, `true`, `false`.

3. **Auto-detection has a known bug** — as of v2.1.7, the `tengu_mcp_tool_search` flag doesn't work. `ENABLE_TOOL_SEARCH=true` in `env` is the reliable workaround.

4. **Haiku cannot use tool search** — `tool_reference` blocks are only supported on Sonnet 4+ and Opus 4+. Harness uses Haiku for lightweight operations; those sessions cannot benefit.

5. **Session pooling helps significantly** — `tools/list` is only called once per session creation, not per invocation. The 8-minute TTL warm pool means most invocations pay zero schema-fetching overhead.

6. **`allowedTools` is about permissions, not schema loading** — restricting the list does not reduce tokens consumed by tool definitions.

7. **Enabling `ENABLE_TOOL_SEARCH=true` in harness** would require adding it to the `env` passed to `query()` in `create-session.ts`, or setting it in the orchestrator's process environment. A `SessionConfig.enableToolSearch` boolean would be the clean way to expose this.

8. **Per-tool control** is possible via `defer_loading: false` on specific high-frequency tools — these would always load eagerly even when tool search is enabled globally.

## Gaps Identified

- No official documentation on whether the auto-detection bug in #18397 has been patched in versions after v2.1.7
- The exact overhead cost (ms) of a single ToolSearch round-trip in the Harness context is not publicly benchmarked; only token counts are available
- No documentation on whether `ENABLE_TOOL_SEARCH` is honored by the SDK's in-process MCP server (`McpSdkServerConfigWithInstance`)
- OpenAI Agents SDK `cache_tools_list` is not available as a first-class option in the Anthropic Agent SDK

## Sources

- https://platform.claude.com/docs/en/agent-sdk/mcp — Official Agent SDK MCP documentation
- https://platform.claude.com/docs/en/agent-sdk/typescript — Full Options type reference including all `query()` parameters
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools — MCP spec: tools/list, tools/call, listChanged
- https://www.anthropic.com/engineering/advanced-tool-use — Deferred loading mechanism, defer_loading API field, ENABLE_TOOL_SEARCH, performance benchmarks
- https://github.com/anthropics/claude-code/issues/18397 — Bug: ENABLE_TOOL_SEARCH not auto-activating; tengu_mcp_tool_search non-functional
- https://paddo.dev/blog/claude-code-hidden-mcp-flag/ — Real-world token recovery numbers (32k tokens from two Chrome MCPs), ENABLE_TOOL_SEARCH configuration
- https://openai.github.io/openai-agents-python/mcp/ — OpenAI comparison: cache_tools_list option (not available in Anthropic SDK)
