# Research: OpenRouter + Perplexity Integration for Selective Routing

Date: 2026-03-01

## Summary

OpenRouter provides an OpenAI-compatible API gateway to 400+ models via a single key. Perplexity's Sonar
family (6 models) is fully available on OpenRouter and delivers real-time, web-grounded responses with
structured citations baked into the response object. The integration pattern that fits Harness is a plugin
tool: a `web_search` or `research` MCP tool that Claude calls during invocation, which internally makes a
fetch to OpenRouter with a Perplexity model ID. Claude traffic never touches OpenRouter — only non-Claude
model calls go through it.

---

## Prior Research

No prior research on this topic in AI_RESEARCH/.

---

## Current Findings

### 1. OpenRouter API Basics

**Base URL:** `https://openrouter.ai/api/v1/chat/completions`

**Format:** Fully OpenAI-compatible. Identical to the OpenAI Chat Completions API schema. The only
differences are:
- The `model` field uses namespaced IDs like `perplexity/sonar-pro` instead of `gpt-4o`
- Two optional attribution headers: `HTTP-Referer` and `X-OpenRouter-Title`
- The response object may contain provider-specific extensions (e.g., Perplexity's `citations` array)

**Authentication:** Single API key, passed as `Authorization: Bearer <OPENROUTER_API_KEY>`.

**TypeScript — native fetch:**
```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://your-app.example.com",
    "X-OpenRouter-Title": "Harness",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "perplexity/sonar-pro",
    messages: [{ role: "user", content: "What is the current state of TypeScript 5.8?" }],
  }),
});
const data = await response.json();
// data.choices[0].message.content — text answer
// data.citations — array of source URLs (Perplexity-specific extension)
```

**TypeScript — using OpenAI SDK with baseURL override (no new dependency):**
```typescript
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://your-app.example.com",
    "X-OpenRouter-Title": "Harness",
  },
});

const completion = await openrouter.chat.completions.create({
  model: "perplexity/sonar-pro",
  messages: [{ role: "user", content: "What is the current state of TypeScript 5.8?" }],
});
```

**Official OpenRouter SDK (`@openrouter/sdk`):**
```typescript
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const completion = await openRouter.chat.send({
  model: "perplexity/sonar-pro",
  messages: [{ role: "user", content: "What is the current state of TypeScript 5.8?" }],
});
```

Confidence: HIGH — verified from official OpenRouter quickstart documentation at openrouter.ai/docs/quickstart

---

### 2. Perplexity Response Object (Citation Format)

Perplexity Sonar models return an OpenAI-compatible response with two non-standard top-level fields:

```json
{
  "id": "pplx-...",
  "model": "sonar-pro",
  "created": 1740825600,
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "TypeScript 5.8 introduced [1] improved infer type predicates..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 312,
    "total_tokens": 326
  },
  "citations": [
    "https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/",
    "https://github.com/microsoft/TypeScript/releases/tag/v5.8.0"
  ],
  "search_results": [
    {
      "title": "Announcing TypeScript 5.8",
      "url": "https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/",
      "date": "2025-02-20",
      "snippet": "Today we're excited to announce the release of TypeScript 5.8..."
    }
  ]
}
```

**Key behavior notes:**
- `citations`: Array of source URLs. Numbers in the response text like `[1]` index into this array.
- `search_results`: Richer array with title, URL, date, and snippet. Not always returned — depends on model.
- Through OpenRouter, the `citations` field is confirmed present on the response object. Community testing
  (AnythingLLM issue #3581) verified `response.citations` is accessible with the standard OpenAI Python/JS
  client pointed at OpenRouter. No special handling needed — it just appears as an extra field.
- **Streaming caveat:** In streaming mode, citations and search_results arrive in the final chunk(s), not
  incrementally. Plan accordingly when streaming.

Confidence: HIGH for the field names and structure; MEDIUM for exact OpenRouter passthrough behavior
(confirmed by community testing, not official documentation).

---

### 3. Perplexity Models Available on OpenRouter

All six Perplexity Sonar models are accessible via `perplexity/<model-id>` on OpenRouter.

| Model ID (OpenRouter) | Context | Max Output | Input $/M | Output $/M | Search $/K | Use Case |
|---|---|---|---|---|---|---|
| `perplexity/sonar` | 127K | 8K | $1 | $1 | $5 | Fast factual Q&A, lightweight grounding |
| `perplexity/sonar-pro` | 200K | 8K | $3 | $15 | $6 | Complex multi-step queries, more citations |
| `perplexity/sonar-reasoning` | 128K | 8K | $1 | $5 | $5 | Search + reasoning chain (DeepSeek R1) |
| `perplexity/sonar-reasoning-pro` | 128K | 8K | $2 | $8 | $6 | Advanced CoT with more citations per search |
| `perplexity/sonar-deep-research` | 128K | 8K | $2 | $8 | $5 | Autonomous multi-search research, full reports |
| `perplexity/sonar-pro-search` | 200K | 8K | $3 | $15 | $18 | Agentic search, OpenRouter-exclusive mode |

**Important pricing note:** The "search" column is a per-request fee (per 1,000 calls), not per-token. It is
charged per API call on top of the token cost. Additionally, Perplexity's direct API has a separate
`search_context_size` parameter (low/medium/high) that adjusts the per-request fee:
- `low` = $5/K (Sonar) or $6/K (Sonar Pro)
- `medium` = $8/K (Sonar) or $10/K (Sonar Pro)
- `high` = $12/K (Sonar) or $14/K (Sonar Pro)

**OpenRouter-exclusive model: `perplexity/sonar-pro-search`**
This model (launched October 30, 2025) is described as "exclusively available on the OpenRouter API."
It adds autonomous, multi-step research workflows to standard Sonar Pro capabilities. Web search priced
at $18/K requests — significantly higher than standard Sonar Pro's $6/K. Use it for deep agentic research
only.

Confidence: HIGH — pulled directly from individual model pages on openrouter.ai/perplexity

---

### 4. Direct Perplexity API vs OpenRouter

| Dimension | Direct Perplexity API | Via OpenRouter |
|---|---|---|
| Base URL | `https://api.perplexity.ai/chat/completions` | `https://openrouter.ai/api/v1/chat/completions` |
| SDK | `@perplexity-ai/perplexity_ai` or OpenAI SDK | OpenAI SDK, `@openrouter/sdk`, or native fetch |
| API Key | Separate `PERPLEXITY_API_KEY` | Single `OPENROUTER_API_KEY` for all models |
| Model IDs | `sonar-pro`, `sonar`, etc. (no prefix) | `perplexity/sonar-pro`, `perplexity/sonar`, etc. |
| Pricing | Same token/request rates | Identical rates (no markup on Perplexity) |
| Citations field | Present in response | Present in response (confirmed) |
| Exclusive models | None known | `sonar-pro-search` is OpenRouter-only |
| Latency | One hop to Perplexity | Two hops: OpenRouter → Perplexity |
| Key management | Separate key per provider | One key for all non-Claude models |
| Rate limits | Per Perplexity limits | No platform-level limits (pay-as-you-go) |
| Free tier | Requires paid API subscription | Very small free allowance; 50 reqs/day baseline |

**The decisive advantage of OpenRouter for this use case:** One API key handles all non-Claude models.
If you later want to add Gemini, DeepSeek, or any other model for specific tool use, you extend the same
client with a different model ID — no new SDKs, no new keys, no new auth flows.

**The decisive advantage of direct Perplexity:** Eliminates one network hop. For latency-sensitive
applications, direct is marginally faster. Also, Perplexity's direct API has `search_mode: "academic"` and
`search_mode: "sec"` parameters for specialized corpora that may not be exposed through OpenRouter.

Confidence: HIGH for structural differences; MEDIUM for the `search_mode` OpenRouter availability (not
explicitly confirmed).

---

### 5. Perplexity-Specific Request Parameters

When calling Perplexity models (whether via OpenRouter or direct), these non-standard parameters are
supported in the request body:

```typescript
interface PerplexityExtra {
  // Search temporal filter
  search_recency_filter?: "hour" | "day" | "week" | "month" | "year";

  // Domain allow/block list
  search_domain_filter?: string[]; // e.g., ["github.com", "arxiv.org"]

  // Search depth (affects per-request fee)
  web_search_options?: {
    search_context_size?: "low" | "medium" | "high"; // default: "low"
    search_type?: "fast" | "pro" | "auto";
    user_location?: {
      latitude?: number;
      longitude?: number;
      country?: string;
      city?: string;
      region?: string;
    };
  };

  // Additional response content
  return_images?: boolean;
  return_related_questions?: boolean;

  // Date-based filters
  search_after_date_filter?: string;   // ISO date string
  search_before_date_filter?: string;  // ISO date string
}
```

**Through OpenRouter:** The `web_search_options` parameter is listed as supported on individual model
pages. The other Perplexity-specific fields should pass through as OpenRouter forwards the full request
body, but this is not explicitly documented. The `search_recency_filter` is widely used in community
integrations through OpenRouter without issues.

Confidence: HIGH for the parameter names and types (from official Perplexity docs); MEDIUM for OpenRouter
passthrough of all these parameters.

---

### 6. Recommended Integration Pattern for Harness

The correct architectural home in Harness is a **plugin tool** — a `PluginTool` registered on a plugin,
exposed to Claude as an MCP tool during `invoker.invoke()`. Claude then decides when to call the tool
based on its reasoning.

**Why a plugin tool (not a hook):**
- `onBeforeInvoke` runs unconditionally on every message — not appropriate for an on-demand search
- A tool is pull-based: Claude calls it only when it determines a web-grounded answer is needed
- This matches the `delegation__delegate` pattern already in the codebase

**Conceptual shape of a `research` plugin:**

```typescript
// packages/plugins/research/src/index.ts
// (conceptual — not implementation code)

const researchPlugin: PluginDefinition = {
  name: "research",
  version: "1.0.0",
  tools: [
    {
      name: "web_search",
      description: "Search the web for current, real-time information. Returns answer with source citations.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          recency: {
            type: "string",
            enum: ["hour", "day", "week", "month"],
            description: "Only return results from this time window"
          },
          domains: {
            type: "array",
            items: { type: "string" },
            description: "Restrict to these domains (e.g. ['github.com'])"
          }
        },
        required: ["query"]
      },
      handler: async (ctx, input, meta) => {
        // POST to https://openrouter.ai/api/v1/chat/completions
        // model: "perplexity/sonar-pro"
        // Returns: formatted text + sources from response.citations
      }
    },
    {
      name: "deep_research",
      description: "Conduct a multi-source research task. Use for comprehensive reports, not quick facts.",
      schema: { /* ... */ },
      handler: async (ctx, input, meta) => {
        // model: "perplexity/sonar-deep-research"
        // Returns: full report + citations
      }
    }
  ],
  register: async (ctx) => ({}) // No hooks needed
};
```

**Config pattern:** Store `OPENROUTER_API_KEY` as an environment variable. Optionally expose model
selection in `PluginConfig` via `ctx.config` for runtime switching.

**Selective routing is automatic:** Claude keeps using `@anthropic-ai/claude-agent-sdk` for all its
own inference. The OpenRouter client is only instantiated inside plugin tool handlers. There is no routing
decision to make at the orchestrator level — separation is enforced by the architecture.

---

### 7. Cost Estimates Per Query

These are rough estimates for a typical tool call (short query, medium-length answer with citations).
Assumptions: 100 input tokens, 500 output tokens, `search_context_size: "low"`.

| Model | Input | Output | Search | Total per call |
|---|---|---|---|---|
| `sonar` | $0.0001 | $0.0005 | $0.005 | ~$0.006 |
| `sonar-pro` | $0.0003 | $0.0075 | $0.006 | ~$0.014 |
| `sonar-reasoning-pro` | $0.0002 | $0.004 | $0.006 | ~$0.010 |
| `sonar-deep-research` | $0.0002 | $0.004 | $0.005 | ~$0.010 + reasoning |
| `sonar-pro-search` | $0.0003 | $0.0075 | $0.018 | ~$0.026 |

**Practical budget:** At $0.006-0.014 per tool call, 1,000 web searches cost $6-14. This is far cheaper
than using Claude's extended thinking for research tasks that require current information.

**Deep Research caveat:** `sonar-deep-research` may conduct 5-20 internal searches per request, so the
effective cost can be $0.025-0.10 per deep research call before reasoning token costs.

Confidence: MEDIUM — computed from documented per-unit rates, but real costs vary with actual token counts.

---

### 8. Alternative Search-Grounded Models on OpenRouter

For cases where Perplexity is overkill or you want different characteristics:

| Model | Provider | OpenRouter ID | Approach | Cost Estimate |
|---|---|---|---|---|
| Sonar Pro | Perplexity | `perplexity/sonar-pro` | LLM + real-time web search | ~$0.014/call |
| Gemini 2.0 Flash with search | Google | `google/gemini-2.0-flash-001` (with grounding) | Google Search grounding | ~$0.003/call |
| Llama 3.3 70B + search | Various | Check openrouter.ai/models?q=online | Some providers add `:online` suffix | Varies |

OpenRouter also has an `:online` model suffix convention. Any model ID with `:online` appended (e.g.,
`openai/gpt-4o:online`) gains web search grounding via OpenRouter's own search augmentation layer.
This is distinct from Perplexity — it uses OpenRouter's search infrastructure rather than Perplexity's.
Pricing: standard model cost + $4/K requests for the search augmentation.

**Specialized research tools (not through OpenRouter):**
- **Tavily** (`tavily.com`) — dedicated search API, returns chunked results for LLM consumption.
  $0.01/search, 1,000/month free. Integrates with LangChain/LlamaIndex natively. No LLM synthesis —
  returns raw search results that Claude then processes.
- **Exa** (`exa.ai`) — semantic/neural search. $5/1,000 operations. Better than keyword search for
  conceptual queries. Returns metadata + snippets.
- **Brave Search API** — privacy-first, independent index (not Google/Bing). $3-5/1,000 queries,
  2,000/month free.
- **Firecrawl** (`firecrawl.dev`) — web scraping + extraction + autonomous agent. Flat-rate credits.
  Good for when you need the full page content, not just a search snippet.

Confidence: MEDIUM for the `:online` suffix (documented on OpenRouter); HIGH for Tavily/Exa/Brave as
established products.

---

### 9. Auth and Key Management Summary

**OpenRouter:**
1. Create account at openrouter.ai
2. Go to openrouter.ai/keys → create a key, optionally set a credit limit
3. Add credits via pay-as-you-go (credit card or crypto)
4. Single env var: `OPENROUTER_API_KEY`
5. One key accesses all 400+ models

**Direct Perplexity:**
1. Go to perplexity.ai/api-platform
2. Purchase API credits (separate from Perplexity Pro subscription)
3. Generate API key
4. Env var: `PERPLEXITY_API_KEY`

**BYOK on OpenRouter:** If you bring your own provider keys (e.g., your Perplexity key), OpenRouter
routes through your key. First 1M BYOK requests/month are free; 5% fee thereafter. This could make sense
if you already have a Perplexity subscription and want unified routing.

Confidence: HIGH — from openrouter.ai/docs/api/reference/authentication and openrouter.ai/pricing.

---

## Key Takeaways

1. **OpenRouter is drop-in OpenAI SDK compatible.** Zero new SDK dependency required — use `baseURL`
   override on the existing OpenAI client.

2. **Citations work through OpenRouter.** The `response.citations` field is present on the response
   object even when going through OpenRouter. No workarounds needed.

3. **Sonar Pro is the practical default.** 200K context, double citations vs standard Sonar, handles
   complex multi-step queries. $0.014/call typical cost. Use `sonar` for high-volume lightweight lookups
   and `sonar-deep-research` for comprehensive reports.

4. **`sonar-pro-search` is OpenRouter-exclusive.** Highest capability (agentic search), also highest
   cost ($0.026/call typical). Best reserved for dedicated research tasks.

5. **The plugin tool is the right Harness pattern.** Selective routing is enforced by architecture —
   Claude stays on native SDK, OpenRouter only appears inside plugin tool handlers.

6. **One OpenRouter key beats two provider keys.** If you anticipate adding more non-Claude models
   over time, consolidating on OpenRouter now avoids future key sprawl.

7. **Direct Perplexity is marginally better if latency matters.** One fewer network hop. Consider
   direct if the tool proves latency-sensitive in practice.

8. **Streaming citations are deferred.** In streaming mode, `citations` and `search_results` arrive
   in the final chunk, not incrementally. If the tool streams, handle citations post-stream.

---

## Sources

- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter Rate Limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter Perplexity Models](https://openrouter.ai/perplexity)
- [Perplexity Sonar Pro on OpenRouter](https://openrouter.ai/perplexity/sonar-pro)
- [Perplexity Sonar Pro Search on OpenRouter](https://openrouter.ai/perplexity/sonar-pro-search)
- [Perplexity Sonar Deep Research on OpenRouter](https://openrouter.ai/perplexity/sonar-deep-research)
- [Perplexity Sonar Reasoning Pro on OpenRouter](https://openrouter.ai/perplexity/sonar-reasoning-pro)
- [Perplexity Direct API Quickstart](https://docs.perplexity.ai/docs/sonar/quickstart)
- [Perplexity API Reference — Chat Completions POST](https://docs.perplexity.ai/api-reference/chat-completions-post)
- [Perplexity Sonar Features](https://docs.perplexity.ai/docs/sonar/features)
- [Perplexity Pricing (Direct API)](https://docs.perplexity.ai/docs/getting-started/pricing)
- [AnythingLLM Issue #3581 — Citations via OpenRouter confirmed](https://github.com/Mintplex-Labs/anything-llm/issues/3581)
- [Firecrawl — Best Deep Research APIs 2026](https://www.firecrawl.dev/blog/best-deep-research-apis)
- [Beyond Perplexity: How OpenRouter Web Search Works](https://bertomill.medium.com/beyond-perplexity-how-open-router-web-search-is-a-game-changer-a971737dab05)
