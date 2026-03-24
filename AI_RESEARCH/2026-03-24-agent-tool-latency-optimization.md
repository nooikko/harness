# Research: Agent Tool Latency Optimization

Date: 2026-03-24

## Summary

Research into strategies for reducing the ~11-second latency in Harness's tool pipeline (smart home control, music playback). Covers five domains: tool result caching, parallel tool execution, session warmth, direct API bypassing, and Anthropic-specific optimizations. The Harness session pool (max 8, 8-min TTL, LRU) is already well-implemented. The largest latency gains available are: (1) parallel tool execution via system prompt instruction, (2) speculative execution for common intents, and (3) caching device discovery + stable tool metadata via prompt caching.

## Prior Research

- `AI_RESEARCH/2026-03-20-claude-agent-sdk-latency-optimization.md` — prior latency research
- `AI_RESEARCH/2026-02-24-anthropic-api-low-latency-chat.md` — API-level optimizations
- `AI_RESEARCH/2026-02-25-dynamic-tool-discovery-intent-routing.md` — intent routing
- `AI_RESEARCH/2026-03-20-mcp-tool-loading-performance.md` — MCP tool loading costs

---

## 1. Tool Result Caching

### Device Discovery Cache

**mDNS/Cast device discovery** (the current `@harness/cast-devices` mDNS-based system) is fundamentally event-driven and already operates as a warm in-memory cache — `startDiscovery()` runs continuously, maintaining an up-to-date device registry. The key insight: the discovery result is **already cached in memory** from `startDiscovery()`. The latency is not from discovery, it is from the full LLM pipeline processing the tool call.

If tool-level device lookup is slow, the issue is the round-trip through the LLM to call `list_devices`, not the discovery itself.

**mDNS TTL semantics (official spec):**
- mDNS TTL recommended default: 120 seconds
- Goodbye packets (TTL=0) are sent by devices on clean shutdown, enabling immediate cache eviction
- Devices that fail silently are evicted after TTL expiry

**Tool result caching pattern (from agentic AI research):**

Use deterministic cache keys: canonicalize the tool name + validated arguments before hashing. Two semantically-identical calls with different argument order map to the same key.

```typescript
// Canonical key: "list_devices|{}" → SHA256 → Redis/Map key
const canonical = `${toolName}|${JSON.stringify(sortedArgs)}`;
const key = crypto.createHash('sha256').update(canonical).digest('hex');

const cached = cache.get(key);
if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;

const result = await executeTool(toolName, args);
cache.set(key, { value: result, ts: Date.now() });
return result;
```

**Recommended TTLs by data type (from semantic caching research):**

| Tool Result Type | Freshness Need | Recommended TTL |
|---|---|---|
| Device list (Cast) | Medium — devices join/leave | 30–60 seconds |
| Device playback state | High — changes constantly | 5 seconds or no cache |
| Music search results | Low — catalog is stable | 10–60 minutes |
| Current queue state | High | No cache (event-driven) |
| Playlist/liked songs | Low | 15 minutes |

**Warm cache on startup:**
In the plugin `start()` lifecycle, pre-populate the cache with expected tool calls:
```typescript
// Pre-warm on plugin start, not on first user request
const devices = listDevices(); // Already populated by startDiscovery
deviceCache.set('list_devices', { value: devices, ts: Date.now() });
```

Source: [Semantic Caching in Agentic AI](https://www.ashwinhariharan.com/semantic-caching-in-agentic-ai-determining-cache-eligibility-and-invalidation/), [Agentic AI Schema-Validated Tool Execution and Deterministic Caching](https://dev.to/sudarshangouda/agentic-ai-schema-validated-tool-execution-and-deterministic-caching-2d14)

---

## 2. Parallel Tool Execution

### Claude's Native Parallel Tool Use (Confidence: HIGH)

Claude natively supports parallel tool calling. When Claude identifies independent operations, it returns multiple `tool_use` blocks in a single response. This is available in all current Claude models.

**Key constraint:** All tool results must be returned in a **single user message** before Claude continues. The consumer must fan out the parallel calls, await all results, and batch them into one response.

**The Messages API pattern:**

```typescript
// Claude returns multiple tool_use blocks in one assistant message
const toolUses = response.content.filter(b => b.type === 'tool_use');

// Fan out: execute all in parallel
const results = await Promise.all(
  toolUses.map(async (toolUse) => ({
    type: 'tool_result' as const,
    tool_use_id: toolUse.id,
    content: await executeToolCall(toolUse.name, toolUse.input),
  }))
);

// Return all results in ONE message
await client.messages.create({
  ...
  messages: [
    ...previousMessages,
    { role: 'assistant', content: response.content },
    { role: 'user', content: results }, // All results together
  ]
});
```

**Forcing parallel tool use via system prompt:**
```
For maximum efficiency, whenever you need to perform multiple independent operations,
invoke all relevant tools simultaneously rather than sequentially.
```

Or the stronger form:
```xml
<use_parallel_tool_calls>
For maximum efficiency, whenever you perform multiple independent operations,
invoke all relevant tools simultaneously rather than sequentially.
Prioritize calling tools in parallel whenever possible.
</use_parallel_tool_calls>
```

**Disabling parallel tool use:**
```typescript
{ disable_parallel_tool_use: true }
// With tool_choice: 'auto' → at most one tool per turn
// With tool_choice: 'any'/'tool' → exactly one tool
```

**SDK-level parallel execution (Agent SDK):**
Within the Claude Agent SDK loop, read-only tools are automatically run concurrently. To enable parallel execution for custom MCP tools, mark them as read-only:
```typescript
// In tool definition
{ name: 'list_devices', readOnly: true }
```

**Known issue:** A documented race condition exists in the SDK when using `createSdkMcpServer` for in-process MCP servers — concurrent tool calls can fail with "Stream closed" errors. This is being tracked in [anthropics/claude-agent-sdk-typescript#41](https://github.com/anthropics/claude-agent-sdk-typescript/issues/41).

**Token-efficient tools beta:**
For older models (pre-Claude 4), the beta header `token-efficient-tools-2025-02-19` encourages parallel tool use.

Sources: [Tool Use Overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [Implement Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use), [Agent Loop Docs](https://platform.claude.com/docs/en/agent-sdk/agent-loop), [Parallel Calling Issues](https://github.com/anthropics/claude-agent-sdk-typescript/issues/41)

### Programmatic Tool Calling (Confidence: HIGH — beta feature)

A new approach where Claude writes **code** that calls multiple tools, rather than making individual API round-trips. Available on Claude Opus 4.6 with the `code_execution_20260120` tool version. Requires the code execution tool to be enabled.

**Performance claim:** Eliminates N-1 inference passes for N tool calls. For 20 tool calls, removes 19 model round-trips. Showed a 37% reduction in token consumption on complex research benchmarks.

**Not eligible for Zero Data Retention (ZDR).**

Source: [Programmatic Tool Calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling), [Advanced Tool Use engineering post](https://www.anthropic.com/engineering/advanced-tool-use)

---

## 3. Session Warmth and Pre-Computation

### Harness's Existing Session Pool (Confidence: HIGH — from codebase)

The current implementation in `/apps/orchestrator/src/invoker-sdk/index.ts`:
- **Pool size:** 8 sessions max
- **TTL:** 8 minutes (480 seconds)
- **Eviction:** LRU
- **Pre-warm API:** `prewarm({ threadId, model })` exposed via `ctx.invoker.prewarm()`
- **Stale session retry:** Automatic single retry on "Session is closed" error
- **Pool key:** `${threadId}:effort:${effort}:dt:${disallowedTools.length}...`

The web plugin calls `/api/prewarm` to warm sessions before the user submits a message.

**Gap:** The `prewarm()` function warms an empty session but does **not** pre-load context. The full `onBeforeInvoke` chain (identity injection + context history injection) still runs at invocation time, adding latency.

### Anthropic Prompt Caching (Confidence: HIGH — official docs)

This is the single highest-impact Anthropic-specific optimization available. It allows caching stable portions of prompts between API calls.

**How it works:**
Place `cache_control: { type: "ephemeral" }` on content blocks. On subsequent requests with an identical prefix up to that breakpoint, the model reads from the KV cache instead of re-processing those tokens.

**TTL options:**
- **5-minute cache** (default): `{ type: "ephemeral" }` — refreshed at no extra cost on each hit within window. Best for frequent multi-turn conversations.
- **1-hour cache:** `{ type: "ephemeral", ttl: "1h" }` — 2x write cost, 0.1x read cost. Better when prompts are accessed less frequently.

**Cost:**
| Token type | Multiplier |
|---|---|
| Base input | 1.0x |
| 5-min cache write | 1.25x |
| 1-hour cache write | 2.0x |
| Cache reads | **0.1x** |

**Latency:** Up to 85% reduction for long prompts. Example: 100K-token prompt dropped from 11.5s to 2.4s.

**Minimum token requirements:**
| Model | Minimum cached tokens |
|---|---|
| Claude Haiku 4.5 | 4,096 |
| Claude Sonnet 4.5/4/3.7 | 1,024 |
| Claude Sonnet 4.6 | 2,048 |
| Claude Opus 4.5 | 4,096 |

**Cacheable:** Tool definitions, system messages, text messages, images, documents, tool results.

**TypeScript example:**
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: longSystemPromptWithAllToolDescriptions, // stable
      cache_control: { type: 'ephemeral' }          // cache this
    }
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: conversationHistory,        // stable portion
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: currentUserMessage         // dynamic — no cache_control
        }
      ]
    }
  ]
});
```

**Key rule:** Place breakpoints on the **last unchanging block**. Dynamic content (timestamps, per-request data) must come after the breakpoint, not at it.

**For Harness specifically:** The identity plugin's soul/memory injection + context plugin's history injection are the large stable portions that should be cached. Tool definitions (music/smart home tools) can be cached in the system prompt section.

**Mixing TTLs:** Longer TTLs must appear before shorter ones in the request.

**Cache lookback window:** System checks the last 20 blocks. For growing conversations, use multiple explicit breakpoints.

Sources: [Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Anthropic Prompt Caching announcement](https://www.anthropic.com/news/prompt-caching)

### Effort Level Optimization (Confidence: HIGH — official docs)

The Agent SDK `effort` parameter controls reasoning depth and directly trades latency for quality:

| Level | Behavior | Good for |
|---|---|---|
| `"low"` | Minimal reasoning | File lookups, device state queries |
| `"medium"` | Balanced | Routine commands |
| `"high"` | Thorough | Complex multi-step |
| `"max"` | Maximum reasoning | Architectural decisions |

**TypeScript SDK defaults to `"high"` if not set.** For smart home and music commands, `"low"` or `"medium"` is appropriate. Setting `effort: "low"` explicitly disables extended thinking on supported models.

Source: [Agent Loop — Effort Level](https://platform.claude.com/docs/en/agent-sdk/agent-loop#effort-level)

---

## 4. Direct API Bypassing the LLM

### Speculative Execution Pattern (Confidence: HIGH — from industry implementations)

The most applicable pattern for Harness's smart home/music use case. Pre-execute predicted tool calls **in parallel** with the LLM processing, hiding tool execution latency behind LLM thinking time.

**How it works (voice/assistant pattern):**
```typescript
async function handleRequest(userMessage: string) {
  // Parallel tracks
  const [llmTask, speculativeTask] = await Promise.all([
    processWithLLM(userMessage),
    speculativelyExecute(userMessage),  // pre-execute predicted tools
  ]);

  const llmDecision = await llmTask;

  if (llmDecision.toolCall === speculativeTask.predictedTool) {
    // Cache hit: result already ready
    return buildResponse(llmDecision, speculativeTask.result);
  } else {
    // Cache miss: fall through to normal execution
    return buildResponse(llmDecision, await executeActualTool(llmDecision));
  }
}
```

**incident.io implementation** (Go, but pattern is universal):
- Keywords match ("update", "pause", "play", "stop") trigger immediate speculative execution
- A WriteBarrier pattern separates "prepare" from "commit" — speculative work is drafted but not applied until LLM confirms
- If LLM rejects: draft is discarded without side effects
- **Result:** 6.5s → 3s (54% reduction)

**Safety constraints:**
- Only speculatively execute **read-only** or **reversible** operations
- Good candidates: `list_devices`, `get_playback_state`, `get_current_queue`, weather, account balance
- Never pre-execute: `send_email`, `play` (starts playback), `delete`, `purchase`
- The only cost of a wrong speculation is wasted CPU time

**For Harness music plugin:** When the user message contains "play", "pause", "skip", or "volume", pre-fetch the current device state and queue in parallel with the LLM decision. By the time the LLM confirms which device/action, the device state is already fresh in memory.

Sources: [incident.io speculative tool calling](https://incident.io/building-with-ai/speculative-tool-calling), [Stream.io voice speculative execution](https://getstream.io/blog/speculative-tool-calling-voice/), [Arxiv: Speculative Tool Calls](https://arxiv.org/pdf/2512.15834)

### Semantic Router / Fast Intent Classification (Confidence: HIGH)

Pre-route common intents using embedding similarity before invoking the full LLM pipeline.

**How it works:**
1. Pre-encode example utterances per intent as embedding vectors at startup
2. Embed the user query (fast — typically 10–50ms with a local model)
3. Find nearest neighbor in embedding space → route decision
4. If confidence above threshold: execute direct API call, bypass LLM
5. If confidence below threshold: fall through to full pipeline

**Latency:** 10–50ms for embedding lookup vs. 1000–11000ms for full LLM pipeline. One community implementation achieved sub-1ms using pre-computed embedding indexes.

**Confidence thresholds from research:**
- Below 0.6 → escalate to full LLM
- Above 0.85 → execute direct API
- 0.6–0.85 → hybrid (use LLM but inject pre-fetched tool data)

**Python library (semantic-router):** Python-only. No official TypeScript equivalent, but the pattern is straightforward with a local embedding model or Qdrant vector search.

**For Harness:** The existing `@harness/vector-search` package (HuggingFace `all-MiniLM-L6-v2`, 384-dim) is already available for embedding lookups. This same infrastructure could power a semantic intent router without additional dependencies.

**Example intents to pre-route:**
- "play [artist/song]" → `music__play`
- "pause / stop the music" → `music__pause`
- "skip this song" → `music__skip`
- "volume up/down" → `music__set_volume`
- "turn on/off [room]" → home automation tool

Sources: [semantic-router GitHub](https://github.com/aurelio-labs/semantic-router), [Intent Classification sub-1ms](https://medium.com/@durgeshrathod.777/intent-classification-in-1ms-how-we-built-a-lightning-fast-classifier-with-embeddings-db76bfb6d964), [AI Agent Routing Best Practices](https://www.patronus.ai/ai-agent-development/ai-agent-routing)

### Hybrid Architecture: Fast Path + Slow Path

```
User Message
     │
     ├─── Embed query (10–50ms)
     │         │
     │    Confidence ≥ 0.85?
     │         ├── YES → Direct API call → Response (50–200ms total)
     │         └── NO  → Full LLM pipeline → Response (2–11s)
     │
     └─── (Parallel) Speculative prefetch of likely tool data
```

**Fallback handling when fast path misclassifies:**
- Log misses for threshold tuning
- The LLM slow path always remains as the authoritative fallback
- Never take irreversible actions on the fast path

---

## 5. Anthropic-Specific Optimizations

### tool_choice Parameter (Confidence: HIGH — official docs)

| Value | Behavior |
|---|---|
| `"auto"` | Claude decides (default) |
| `"any"` | Claude must use a tool, not a specific one |
| `{ type: "tool", name: "X" }` | Forces specific tool — eliminates LLM deliberation |
| `"none"` | No tools |

**Latency benefit of forced tool use:** When intent is unambiguous, `tool_choice: "any"` eliminates the LLM's decision overhead and forces direct tool invocation. The API prefills the assistant message, so Claude skips any pre-tool explanation text.

**Constraints:**
- `tool_choice: "any"` and `"tool"` are **incompatible with extended thinking**
- Changing `tool_choice` invalidates prompt cache breakpoints

### Streaming (Confidence: HIGH)

Streaming doesn't reduce total latency but reduces **perceived latency** significantly. The user sees partial results as they arrive rather than waiting for the full response.

The Claude Agent SDK supports streaming via `includePartialMessages: true`:
```typescript
for await (const message of query({ prompt, options: { includePartialMessages: true } })) {
  if (message.type === 'stream') {
    // StreamEvent: raw API streaming events (text deltas, tool input chunks)
    yield message; // Forward to client
  }
}
```

**For tool-heavy interactions:** Streaming shows tool invocation and result in real-time (the Harness pipeline already broadcasts `pipeline:step` events for this).

### Automatic Prompt Caching in Agent SDK (Confidence: HIGH)

The Agent SDK **automatically applies prompt caching** for static content (system prompt, CLAUDE.md, tool definitions) at no configuration cost. From the official docs:

> "Content that stays the same across turns (system prompt, tool definitions, CLAUDE.md) is automatically prompt cached, which reduces cost and latency for repeated prefixes."

This means the Harness plugin descriptions injected by the context plugin are already being cached across turns within a session. The benefit is most pronounced in multi-turn conversations (the existing session pool ensures this).

### Effort Level for Tool-Heavy Agents (Confidence: HIGH)

For the music and home automation use cases, setting `effort: "low"` on the invocation is appropriate and will materially reduce latency:

```typescript
await ctx.invoker.invoke(prompt, {
  threadId,
  model: 'claude-haiku-4-5',  // Haiku already has thinking disabled
  effort: 'low',              // On Sonnet, explicitly minimize reasoning
});
```

Haiku already disables thinking by default in Harness (see `resolveThinkingConfig` in `invoker-sdk/index.ts`).

### Model Selection Impact (Confidence: HIGH)

From the existing Harness `resolveThinkingConfig` logic, Haiku disables thinking automatically. For latency-sensitive tool actions, using Haiku directly reduces inference time by 3–5x compared to Sonnet.

| Model | Thinking Default | Relative Latency |
|---|---|---|
| Haiku | Disabled | 1x (fastest) |
| Sonnet | effort: 'medium' | ~3x |
| Opus | effort: 'high' | ~5x |

---

## Prioritized Recommendations for Harness

Ordered by estimated impact vs. implementation effort:

### Tier 1: High impact, low effort

1. **System prompt instruction for parallel tool use** — Add the `<use_parallel_tool_calls>` instruction to the system prompt assembled by the context plugin. Zero infrastructure change. Claude will consolidate independent tool calls (e.g., "play X on living room") into one turn.

2. **Explicit prompt caching breakpoints in context plugin** — Add `cache_control: { type: "ephemeral" }` on the stable portions injected by `onBeforeInvoke`: soul/identity header, tool definitions, static context files. The dynamic user message and recent history must come after the breakpoint. This directly addresses the pre-processing latency that leads to the 11-second figure.

3. **Lower effort for music/home tool threads** — Pass `effort: 'low'` for tool invocations in music and smart home contexts where reasoning depth is not required.

### Tier 2: High impact, moderate effort

4. **Speculative device state prefetch** — In the music plugin's `onMessage` hook, detect keywords ("play", "pause", "skip", "volume") and pre-fetch the current playback state + device list before the LLM responds. By the time the `list_devices` or `play` tool call arrives, results are already in-memory.

5. **Tool result TTL cache** — Wrap the MCP tool handlers for `list_devices`, `search`, and `my_playlists` with an in-memory TTL cache (Map + timestamp). Device list: 30s TTL. Playlists: 15min TTL. This eliminates redundant mDNS queries and YouTube API calls.

### Tier 3: High impact, higher effort

6. **Semantic intent router** — Use the existing `@harness/vector-search` infrastructure to build a lightweight router that pre-classifies music/home commands with ≥0.85 confidence and executes them directly, bypassing the full LLM pipeline. Fallback to full pipeline for anything below threshold.

7. **Explicit prompt cache on tool definitions** — Cache the entire block of MCP tool definitions (music plugin has 16 tools, home automation adds more) using the 1-hour TTL cache since these are fully static.

---

## Gaps and Unknowns

- **Actual latency breakdown not measured:** The 11-second figure is end-to-end. Without profiling the specific phases (session acquisition, `onBeforeInvoke` chain, LLM inference, tool round-trips), it is unclear which phase is the largest contributor.
- **Prompt caching minimum token check:** The identity + context injection must meet the minimum cacheable token count for the model in use (2048 for Sonnet 4.6, 4096 for Haiku 4.5). If the combined system prompt is below this threshold, caching will not engage.
- **Semantic router accuracy baseline:** The threshold values (0.6/0.85) are from general research, not measured against Harness's specific utterance distribution.
- **Programmatic Tool Calling availability:** Requires Claude Opus 4.6 with code execution enabled. Higher cost per token than Haiku.

---

## Sources

- [Tool Use Overview — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Implement Tool Use — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Programmatic Tool Calling — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)
- [How the Agent Loop Works — Anthropic Docs](https://platform.claude.com/docs/en/agent-sdk/agent-loop)
- [Prompt Caching — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Advanced Tool Use — Anthropic Engineering Blog](https://www.anthropic.com/engineering/advanced-tool-use)
- [Speculative Tool Calling — incident.io](https://incident.io/building-with-ai/speculative-tool-calling)
- [Speculative Tool Calling for Voice — Stream.io](https://getstream.io/blog/speculative-tool-calling-voice/)
- [Semantic Router GitHub — aurelio-labs](https://github.com/aurelio-labs/semantic-router)
- [Semantic Caching in Agentic AI — Ashwin Hariharan](https://www.ashwinhariharan.com/semantic-caching-in-agentic-ai-determining-cache-eligibility-and-invalidation/)
- [Deterministic Tool Caching — DEV Community](https://dev.to/sudarshangouda/agentic-ai-schema-validated-tool-execution-and-deterministic-caching-2d14)
- [Agent SDK TypeScript Concurrent Tool Calls Issue #41](https://github.com/anthropics/claude-agent-sdk-typescript/issues/41)
- [Optimizing Agentic LLM Inference via Speculative Tool Calls — ArXiv](https://arxiv.org/pdf/2512.15834)
- [AI Agent Routing Best Practices — Patronus AI](https://www.patronus.ai/ai-agent-development/ai-agent-routing)
- [mDNS Device Discovery — WellWells](https://wellstsai.com/en/post/mdns-iot-device-discovery/)
