# Research: Anthropic API Low-Latency Chat — Replacing CLI Child Process
Date: 2026-02-24

## Summary

The current orchestrator spawns `claude` CLI as a child process, adding ~3-5s cold start overhead per message on top of API time. Replacing this with direct SDK calls using streaming can deliver sub-second time-to-first-token (TTFT) in most cases. Haiku 4.5 is the fastest current model at ~470-530ms TTFT via the direct API. Prompt caching can further reduce effective latency when conversation history grows. The Anthropic TypeScript SDK maintains persistent HTTP connections by default via a stable `httpAgent`.

## Prior Research
None on this specific topic.

## Current Findings

### 1. Direct Anthropic Messages API (`@anthropic-ai/sdk`)

**Package:** `@anthropic-ai/sdk` (npm)

Non-streaming (`.messages.create()`):
- Full response latency for a short Haiku reply (~50 tokens): approximately 800ms–1.5s total
- This is the total round-trip: network + model inference + full output generation
- Eliminates the 3-5s CLI cold-start entirely

Streaming (`.messages.stream()`):
- TTFT for Claude Haiku 4.5 via Anthropic direct API: **470–530ms** (measured by Artificial Analysis, 2025-2026)
- Users see first tokens in under 600ms in typical conditions
- Subsequent tokens arrive at ~109 tokens/second for Haiku 4.5
- For a 50-token response, total perceived completion time: ~1s from submission

This replaces `spawn('claude', [...])` which adds a Node.js process fork (~50-200ms), CLI startup (~500ms-1s), and session hydration from disk before any API call is made.

### 2. Streaming API

The TypeScript SDK provides two streaming patterns:

**Pattern A — Event-driven (recommended for chat UI):**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const stream = client.messages.stream({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  messages: conversationHistory, // full array of {role, content} objects
});

// Tokens arrive as they're generated — pipe directly to SSE or WebSocket
stream.on("text", (text) => {
  res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
});

const finalMessage = await stream.finalMessage();
// finalMessage contains stop_reason, usage stats, full content
```

**Pattern B — Accumulate silently, return complete message:**
```typescript
const message = await client.messages
  .stream({ model: "claude-haiku-4-5", max_tokens: 1024, messages: [...] })
  .finalMessage();
```

Pattern B is useful when streaming long outputs (>4K tokens) to avoid HTTP timeouts, while still getting a clean complete result object.

**SSE event flow:**
1. `message_start` — metadata (id, model, empty content)
2. `content_block_start` — opens a text block
3. `content_block_delta` (repeated) — each carries `text_delta.text` chunks
4. `content_block_stop`
5. `message_delta` — final `stop_reason`, cumulative `usage`
6. `message_stop`

### 3. Connection Keep-Alive and Persistent Connections

From the SDK source and documentation:
- The SDK creates a **stable `httpAgent`** by default for all http/https requests, which **reuses TCP connections** across API calls (connection pooling)
- TCP socket keep-alive is set by default to reduce idle timeout disconnections
- Default timeout: **600,000ms (10 minutes)** for non-streaming; streaming connections persist until `message_stop` or client close
- Default retries: **2 automatic retries** on 408, 409, 429, and 5xx errors

**Pre-warming connections:** Because the SDK reuses the underlying HTTP agent, the first request from a process will establish the TLS handshake (~50-150ms overhead). Subsequent requests reuse the socket. To pre-warm:
```typescript
// At server startup, fire a cheap request to establish the connection
await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1,
  messages: [{ role: "user", content: "ping" }],
});
```

**Custom httpAgent for tuning:**
```typescript
import https from "https";
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const client = new Anthropic({ httpAgent: agent });
```

### 4. Conversation State Management (Replacing `--resume`)

The CLI's `--resume <sessionId>` flag loads conversation history from disk. With the direct API, the caller maintains an array of `{role, content}` message objects and passes the full array on each turn.

**Implementation pattern:**
```typescript
type Message = { role: "user" | "assistant"; content: string };

// In-memory per-thread conversation store (replace with DB for persistence)
const threads = new Map<string, Message[]>();

const sendMessage = async (threadId: string, userText: string) => {
  const history = threads.get(threadId) ?? [];
  history.push({ role: "user", content: userText });

  const stream = client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: "You are a helpful assistant.",
    messages: history,
    cache_control: { type: "ephemeral" }, // automatic caching of growing history
  });

  let assistantReply = "";
  stream.on("text", (t) => { assistantReply += t; });
  await stream.finalMessage();

  history.push({ role: "assistant", content: assistantReply });
  threads.set(threadId, history);
  return assistantReply;
};
```

For persistent storage across process restarts, serialize `history` to the existing Prisma `Thread` model (store messages as a JSON column or separate `Message` rows).

**Token cost as history grows:** Each request re-sends the full history. For a 100-turn conversation, this can mean sending thousands of tokens per request. Use prompt caching (below) to avoid re-processing the static prefix on each turn.

### 5. Prompt Caching

**Status:** GA (generally available), no beta header needed.

**How it works:**
1. The API computes a cryptographic hash of all content up to a `cache_control` breakpoint
2. If the same prefix has been seen within the TTL, the KV cache is reused — model skips re-processing those tokens
3. Cached tokens are billed at **10% of base input token cost** on reads (cache hits cost 10x less)
4. Cache writes cost **25% more** than base (one-time penalty on first request with that prefix)
5. **TTL options:** 5 minutes (default, free to refresh) or 1 hour (2x base cost)

**Latency impact:** The docs state: "You will generally see improved time-to-first-token for long documents." No specific millisecond reduction is documented, but inference is faster because the model skips KV re-computation for cached tokens. The benefit scales with context size — a 50-token system prompt gains little; a 10,000-token system prompt + 50-turn conversation history gains significantly.

**Minimum cacheable size:**
- Haiku 4.5: 4,096 tokens (must cache at least this many tokens — limits utility for short conversations)
- Sonnet 4.5/4.6, Haiku 3.5: 1,024–2,048 tokens
- NOTE: Haiku 4.5's 4096-token minimum means caching only activates once a conversation is moderately long

**Recommended pattern for multi-turn chat (automatic caching):**
```typescript
// Add cache_control at top level — system automatically moves breakpoint forward
// as conversation grows. Handles everything automatically.
await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  cache_control: { type: "ephemeral" },  // top-level automatic caching
  system: "You are a helpful assistant.",
  messages: conversationHistory,
});
```

**Explicit breakpoints for static system prompts (up to 4 breakpoints):**
```typescript
await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "You are a helpful assistant. [Long static instructions...]",
      cache_control: { type: "ephemeral" }, // Cache the stable system prompt
    }
  ],
  messages: conversationHistory, // Only new messages cost full input tokens
});
```

**Cache isolation note (effective Feb 5, 2026):** Caches are now workspace-isolated (not org-isolated). Different workspaces within the same Anthropic org do not share caches.

### 6. Batch vs Single Message

The Anthropic Batch API processes requests asynchronously (not in real time), making it unsuitable for chat where responses must arrive in seconds. It is intended for bulk offline processing with up to 50% cost reduction.

For a chat application, always use single synchronous message requests (streaming or non-streaming). There is no "batch mode" for real-time use.

**Per-request overhead reduction strategies:**
- Keep `max_tokens` as low as feasible — this sets the maximum output, but the model stops earlier at `end_turn`; a smaller `max_tokens` does not reduce TTFT
- Keep the system prompt short and static (so it can be cached)
- Use `temperature: 0` for deterministic, focused replies (can slightly reduce token count in responses)
- Avoid unnecessary tool definitions — each tool adds tokens to every request

### 7. Model Speed Comparison

Based on Artificial Analysis benchmarks and official Anthropic documentation (2025-2026):

| Model | TTFT (Anthropic direct API) | Output Speed | Input Cost | Output Cost |
|---|---|---|---|---|
| Claude Haiku 4.5 | ~470-530ms | ~109 tokens/sec | $1/MTok | $5/MTok |
| Claude Sonnet 4.6 | ~640-850ms | ~60-80 tokens/sec | $3/MTok | $15/MTok |
| Claude Opus 4.6 | ~1000-1500ms | ~30-50 tokens/sec | $5/MTok | $25/MTok |
| Claude Haiku 3 (deprecated) | ~420-450ms | ~120 tokens/sec | $0.25/MTok | $1.25/MTok |

Note: Haiku 3 is deprecated (retires April 19, 2026). Haiku 4.5 is the current fastest model.

For a ~50-token reply:
- Haiku 4.5: TTFT ~500ms + ~0.46s generation = **~1s total** (streaming perceived as ~500ms)
- Sonnet 4.6: TTFT ~750ms + ~0.75s = **~1.5s total** (streaming perceived as ~750ms)
- Opus 4.6: TTFT ~1250ms + ~1.5s = **~2.75s total**

## Key Takeaways

1. **Eliminate the CLI child process entirely.** The `@anthropic-ai/sdk` npm package makes direct HTTP calls. Removing the process fork + CLI startup + session load eliminates 2-4 seconds of overhead per message.

2. **Always stream for chat UIs.** `client.messages.stream()` delivers TTFT ~500ms for Haiku 4.5. Users see words appearing immediately, making sub-2s feel instant.

3. **Use Haiku 4.5 as the default model** (`claude-haiku-4-5`) for speed-critical flows. It is 4-5x faster than Opus at a fraction of the cost. Escalate to Sonnet for complex tasks.

4. **The SDK handles persistent connections automatically.** No manual connection pooling needed. A single `new Anthropic()` instance per process is optimal — reuse it across all requests.

5. **Add prompt caching for conversations beyond ~20 turns.** Once history exceeds Haiku 4.5's 4096-token minimum, add `cache_control: { type: "ephemeral" }` at the top level of every request. Growing conversation history will be read from cache at 10% of normal token cost, with measurable TTFT improvement.

6. **Manage conversation history in-process or in the DB.** Replace `--resume` with an in-memory Map (for stateless servers) or a Prisma-backed message store (for persistence). Pass the full `messages` array on each API call.

7. **The minimum viable fast implementation:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

// Instantiate once at module level — reuses TCP connections
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// For a chat route that streams to the client
export const streamChatMessage = async (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onToken: (text: string) => void,
) => {
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    cache_control: { type: "ephemeral" }, // auto-cache growing history
    system: "You are a helpful assistant.",
    messages,
  });

  stream.on("text", onToken);
  return stream.finalMessage();
};
```

## Gotchas and Warnings

- **Haiku 4.5 prompt caching minimum is 4096 tokens** — caching only activates once the conversation is ~3000+ words long. Early in a conversation there is no cache benefit.
- **Cache TTL is 5 minutes by default.** If users are inactive for >5 minutes, the next message will be a cache miss (more expensive + slightly slower). Use 1-hour TTL (`"ttl": "1h"`) for slow-paced conversations.
- **Rate limits:** Cache hits do NOT count against token-per-minute rate limits. High-volume chat benefits doubly from caching.
- **Tool definitions invalidate caches.** If the tool list changes between requests (dynamic tools), the entire cache is invalidated. Keep tool definitions static.
- **Automatic caching requires the request to be structurally identical** except for the last user message. Any change to system prompt, tool list, or prior messages invalidates it.
- **The CLI's `--resume` session ID is not portable to the SDK.** Existing CLI-managed conversation histories cannot be resumed via the direct API without exporting the conversation history.

## Sources
- [Anthropic Streaming Messages API docs](https://platform.claude.com/docs/en/api/messages-streaming)
- [Anthropic Prompt Caching docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
- [Anthropic Reduce Latency docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [anthropics/anthropic-sdk-typescript GitHub](https://github.com/anthropics/anthropic-sdk-typescript)
- [Artificial Analysis — Claude 4.5 Haiku benchmarks](https://artificialanalysis.ai/models/claude-4-5-haiku/providers)
- [Artificial Analysis — Anthropic provider](https://artificialanalysis.ai/providers/anthropic)
- [AI Latency — Claude benchmarks](https://www.ailatency.com/claude-latency.html)
- [kwindla Twitter benchmark — Haiku 4.5 TTFT 637ms voice agent](https://x.com/kwindla/status/2025785150441660686)
- [Anthropic Claude Haiku 4.5 announcement](https://www.anthropic.com/claude/haiku)
