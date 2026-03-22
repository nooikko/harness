# Research: Extended Thinking Optimization for Orchestrator Pipeline

Date: 2026-03-20

## Summary

Comprehensive research into all available controls for Claude's extended thinking behavior as used via the `@anthropic-ai/claude-agent-sdk` v0.2.80. The SDK exposes a `thinking` option and an `effort` option on `query()` that directly map to Anthropic's Messages API thinking parameter. The orchestrator currently passes no thinking controls — the Claude subprocess runs with defaults, which means adaptive thinking is on for Opus/Sonnet 4.6 (the "always thinks" default at effort: 'high').

## Current Orchestrator Setup

### How Invocation Works

The orchestrator wraps the Agent SDK `query()` function via a warm session pool (8 max sessions, 8-min TTL). Sessions are keyed by `threadId`. Each session is a long-lived async generator that keeps the Claude subprocess alive between messages.

Key files:
- `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` — where `query()` is called with `options`
- `apps/orchestrator/src/invoker-sdk/index.ts` — session pool lookup, `invoke()` call
- `apps/orchestrator/src/orchestrator/index.ts` — Step 4 where `deps.invoker.invoke()` is called

### Current `query()` Options (what's being set today)

```typescript
query({
  prompt: messageStream(),
  options: {
    model,                              // per-session, from thread or project model override
    cwd: os.tmpdir(),                   // neutral cwd
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    env,
    mcpServers: config.mcpServerFactory(contextRef),
    // thinking: NOT SET — uses SDK default
    // effort: NOT SET — uses SDK default
  },
});
```

### What's missing

`thinking` and `effort` are NOT passed. This means:
- For Opus 4.6 / Sonnet 4.6: adaptive thinking is active at effort:'high' (Claude always thinks)
- For older models (Haiku 4.5, Sonnet 4.5, etc.): default behavior per model
- The orchestrator has no per-thread or per-request control over thinking depth

### `InvokeOptions` in plugin-contract (what plugins can pass)

```typescript
export type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
  maxTokens?: number;
  sessionId?: string;
  threadId?: string;
  onMessage?: (event: InvokeStreamEvent) => void;
  traceId?: string;
  taskId?: string;
  pendingBlocks?: ContentBlock[][];
  // thinking: NOT PRESENT — no way for plugins to control this today
  // effort: NOT PRESENT
};
```

## SDK Thinking Controls (Authoritative — from sdk.d.ts v0.2.80)

### The `thinking` option (per-session, set in `query()` options)

```typescript
thinking?: ThinkingConfig;

type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled;

type ThinkingAdaptive = { type: 'adaptive' };            // Opus 4.6, Sonnet 4.6 only
type ThinkingEnabled  = { type: 'enabled'; budgetTokens?: number };  // older models
type ThinkingDisabled = { type: 'disabled' };            // all models
```

### The `effort` option (per-session, set in `query()` options)

```typescript
effort?: 'low' | 'medium' | 'high' | 'max';
```

| Effort | Thinking behavior |
|--------|------------------|
| `max`  | Always thinks, no constraint on depth. Opus 4.6 only. |
| `high` | Always thinks (default). Deep reasoning on complex tasks. |
| `medium` | Moderate thinking. May skip for simple queries. |
| `low` | Minimizes thinking. Skips for simple tasks. |

### The `maxThinkingTokens` option (deprecated)

```typescript
maxThinkingTokens?: number;
// Deprecated — use `thinking` instead.
// On Opus 4.6: 0 = disabled, any other value = adaptive
```

### The `alwaysThinkingEnabled` settings field

Found at line 3519 of sdk.d.ts in the `Settings` type:
```typescript
alwaysThinkingEnabled?: boolean;
// When false, thinking is disabled.
// When absent or true, thinking is enabled automatically for supported models.
```

This is a persistent settings field (loaded via the `settings` option), not a per-invocation control.

## API-Level Thinking Controls (from Anthropic docs)

### Three modes

| Mode | Config | Model Support |
|------|--------|--------------|
| **Adaptive** | `thinking: {type: "adaptive"}` | Opus 4.6, Sonnet 4.6 only |
| **Manual/Fixed budget** | `thinking: {type: "enabled", budget_tokens: N}` | All thinking-capable models. Deprecated on Opus 4.6/Sonnet 4.6. |
| **Disabled** | `thinking: {type: "disabled"}` or omit parameter | All models |

### Model thinking capability matrix

| Model | Extended Thinking | Adaptive Thinking | Notes |
|-------|:-----------------:|:-----------------:|-------|
| claude-opus-4-6 | Yes | Yes | Default mode for this model is adaptive |
| claude-sonnet-4-6 | Yes | Yes | Default mode for this model is adaptive |
| claude-haiku-4-5 (`claude-haiku-4-5-20251001`) | **Yes** | No | Supports `type: "enabled"` with budget_tokens only |
| claude-sonnet-4-5 | Yes | No | `type: "enabled"` required |
| claude-opus-4-5 | Yes | No | `type: "enabled"` required |
| claude-haiku-3 (deprecated) | **No** | No | No thinking support at all |

**Critical finding: Haiku 4.5 supports extended thinking** but not adaptive mode. The current Harness default model is Haiku. If Haiku is used without explicit thinking config, it falls back to a non-adaptive default.

### Minimum budget for `type: "enabled"`

- Must be >= 1,024 tokens
- Must be < `max_tokens`
- Thinking tokens count toward the `max_tokens` limit

## tool_choice Limitations with Thinking Enabled

**This is a hard API constraint.** When thinking is active, only two `tool_choice` values are allowed:
- `tool_choice: {"type": "auto"}` — Claude decides whether to call a tool
- `tool_choice: {"type": "none"}` — No tool calls allowed

**Will cause errors:**
- `tool_choice: {"type": "any"}` — Forces Claude to call some tool
- `tool_choice: {"type": "tool", "name": "..."}` — Forces a specific tool call

**Why:** Forcing tool use is incompatible with thinking because thinking may change Claude's decision about which tool to call or whether to call any tool. The orchestrator's plugin tools all use `auto` today (MCP tools are called by the model's discretion), so this constraint is unlikely to affect the current system.

## Interleaved Thinking (Thinking Between Tool Calls)

With normal extended thinking, Claude thinks once before any tool calls. With interleaved thinking, Claude thinks after each tool result — enabling more sophisticated multi-step tool use.

| Mode | Interleaved Thinking |
|------|---------------------|
| Adaptive on Opus 4.6 | Automatically enabled |
| Adaptive on Sonnet 4.6 | Automatically enabled |
| Manual on Sonnet 4.6 | Requires `interleaved-thinking-2025-05-14` beta header |
| Manual on Opus 4.6 | Not available in manual mode |
| Older models | Requires `interleaved-thinking-2025-05-14` beta header |

**Implication:** If you want interleaved thinking for agentic tool-calling workflows, adaptive mode on Opus/Sonnet 4.6 is the path of least resistance.

## Streaming Behavior and `display: "omitted"`

Thinking blocks stream via `thinking_delta` events **before** text blocks. This means when thinking is long, time-to-first-text-token is delayed.

**Key optimization: `display: "omitted"`** — Pass this in the thinking config to skip streaming thinking tokens entirely. The server delivers only the signature (needed for multi-turn) and streams text immediately.

```json
{
  "thinking": {
    "type": "adaptive",
    "display": "omitted"
  }
}
```

- **Latency reduction:** Faster TFTT because thinking tokens are not streamed
- **Cost:** Same — you are still billed for full thinking tokens
- **Multi-turn:** Signature is preserved, so conversation continuity still works
- **SDK support:** The Agent SDK v0.2.80 does NOT appear to surface `display` in the `ThinkingEnabled` or `ThinkingAdaptive` type definitions, but the Anthropic docs state: "No SDK currently includes `display` in its type definitions. The Python SDK forwards unrecognized dict keys to the API at runtime; passing `display` in the thinking dict works transparently. The TypeScript SDK requires a type assertion."

**The orchestrator currently processes thinking blocks** via `map-stream-event.ts` which emits a `thinking` stream event for each thinking block. If `display: "omitted"` were used, the thinking blocks would still arrive (as empty blocks with a signature) but `block.thinking` would be falsy — the `if (block.thinking)` guard in `map-stream-event.ts` would simply skip them. No code change needed to handle omitted thinking.

## Adaptive vs Fixed Budget Thinking: Key Trade-offs

From official Anthropic documentation:

> Adaptive thinking can drive better performance than extended thinking with a fixed `budget_tokens` for many workloads, especially bimodal tasks and long-horizon agentic workflows.

> For workloads where predictable latency and token usage matter, or where you need precise control over thinking costs, extended thinking with `budget_tokens` continues to be fully supported.

**Adaptive is the right default for this orchestrator** because:
1. It handles bimodal tasks (trivial cron jobs vs. complex delegation chains) with one config
2. Effort level can be set per-session to tune the aggressiveness

**Fixed budget is appropriate when:**
- You need to cap token spend per invocation with a hard ceiling
- You want predictable latency SLAs

## The `effort` Parameter as a Practical Knob

For the current harness, `effort` is the most practical lever because it can be set per-model-session in `query()` options. Using `effort: 'low'` or `effort: 'medium'` with `thinking: {type: 'adaptive'}` allows Claude to skip thinking entirely for simple queries (cron digest, auto-naming, simple delegation check-ins).

| Use Case | Recommended effort | Expected behavior |
|----------|--------------------|-------------------|
| Cron digests, morning digest | `low` or `medium` | Skips thinking for report generation, thinks for complex calendar logic |
| Auto-namer (thread title) | Irrelevant — uses Haiku | Haiku supports `type: "enabled"` only |
| Delegation sub-agents | `high` or `max` | Always thinks for complex reasoning |
| Primary user conversation | `high` (default) | Always thinks |
| Simple tool-only responses | `medium` | May skip thinking for "what time is it?" |

## Where the Control Can Be Added

The `thinking` and `effort` options are set in `create-session.ts` inside the `query()` call. Since sessions are per-thread (keyed by threadId), these options are **per-session, not per-message**. Changing them requires evicting and recreating the session.

This means:
1. **Can be set globally** in `createSession()` by adding them to the `query()` options object
2. **Can be made per-thread** by passing them through `SessionConfig` → `createSession` → `query()` options
3. **Cannot be changed mid-conversation** without losing session continuity (new session = fresh context)
4. **Cannot be changed per-message** within the same session

The `InvokeOptions` type in `plugin-contract` does NOT currently include `thinking` or `effort`, so plugins cannot vary these today. Adding them would require:
1. Adding `thinking?: ThinkingConfig` and `effort?: 'low' | 'medium' | 'high' | 'max'` to `InvokeOptions`
2. Passing them through the invoker to `create-session.ts`
3. Either using them at session creation time (per-thread) or looking for a per-message API (unclear if available)

## Key Finding: The SDK `thinking` Option is Per-Session, Not Per-Message

The harness `query()` call passes an `options` object that configures the Claude subprocess. This subprocess is kept alive between messages via the async generator pattern. The `thinking` and `effort` options affect how the subprocess behaves globally.

**There is no documented mechanism in the Agent SDK to change thinking config per-message within an existing session.** The `send()` method on the session only accepts a `prompt` string and `onMessage` callback (via `SendOptions`). Per-message thinking control would require per-message sessions (one session per invocation) — which would eliminate the warm-session benefit.

## Practical Recommendations (Confidence: HIGH)

These are factual findings about what levers exist and their characteristics — not implementation recommendations:

1. **Disabling thinking entirely** — Set `thinking: {type: 'disabled'}` in `query()` options. Works for all models. Eliminates thinking latency entirely. Available today with a one-line change to `create-session.ts`.

2. **Effort level** — Set `effort: 'medium'` or `effort: 'low'` in `query()` options. For Opus/Sonnet 4.6 with adaptive thinking, this allows Claude to skip thinking on simple queries while still thinking for complex ones. Most practical per-session optimization.

3. **display: "omitted"** — Reduces time-to-first-text-token in streaming by skipping thinking token delivery. Requires a type assertion in TypeScript. Charges remain the same. Does not reduce total invocation time (thinking still happens internally).

4. **Model routing** — Routing simpler tasks to Haiku 4.5 (`claude-haiku-4-5-20251001`) avoids adaptive thinking entirely (Haiku doesn't support adaptive). Haiku supports `type: "enabled"` with a budget. The auto-namer and summarization plugins already use Haiku via `ctx.invoker.invoke({model: 'haiku', ...})`.

5. **Prompt-based tuning** — Official docs confirm thinking behavior is promptable: adding instructions like "Only use extended reasoning when the problem requires multi-step analysis" can reduce thinking frequency with adaptive mode.

## Gaps Identified

- **Per-message thinking control:** No documented SDK mechanism. Only per-session (per-subprocess).
- **Whether `effort` applies to Haiku:** The SDK type says `effort?: 'low' | 'medium' | 'high' | 'max'` without model restriction, but the docs say effort levels guide adaptive thinking, which Haiku doesn't support. Behavior on Haiku with effort set is undocumented.
- **`display: "omitted"` in TypeScript SDK:** Requires a type assertion (`as any` or cast to `unknown`). This would conflict with Harness's `block-any-types` pre-commit hook. An alternative is passing via `extraArgs` or environment variable if the SDK supports it.
- **Exact Haiku default thinking behavior:** When `thinking` is omitted for Haiku 4.5, whether it silently applies a small fixed budget or skips thinking entirely is not explicitly documented. The SDK comment says "thinking is enabled automatically for supported models" — but the `alwaysThinkingEnabled: false` setting suggests thinking can be disabled system-wide.

## Sources

- `/Users/quinn/dev/harness/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.2.80_zod@4.3.6/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — SDK type definitions (authoritative)
- `https://platform.claude.com/docs/en/api/messages` — Messages API thinking parameter schema
- `https://platform.claude.com/docs/en/docs/build-with-claude/adaptive-thinking` — Adaptive thinking guide (full page, fetched successfully)
- `https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking` — Extended thinking with tool use, interleaved thinking, display options
- `https://platform.claude.com/docs/en/about-claude/models/overview` — Model capability matrix (fetched successfully)
- `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` — Current query() options
- `/Users/quinn/dev/harness/packages/plugin-contract/src/index.ts` — InvokeOptions type
