# Research: TypeScript Agent Orchestration Frameworks
Date: 2026-03-26

## Summary

Comparative analysis of six TypeScript/JavaScript agent orchestration frameworks evaluated against the requirements of a migration from a custom plugin-based orchestrator (Harness). The key question: do any of these frameworks offer a plugin/middleware lifecycle-hook system comparable to Harness's `PluginDefinition` / `PluginHooks` model?

**Short answer:** None of the frameworks provide a direct equivalent to Harness's plugin system. The closest analogs are:
- **LangGraph.js (Deep Agents middleware)** — closest to a pluggable pipeline hook architecture
- **Mastra** — richest TypeScript-native feature set, but workflow-centric rather than hook-centric
- **Vercel AI SDK v6** — best if you want LLM-call-level middleware only (not pipeline-level)

Frameworks that are definitively ruled out: Semantic Kernel (no official TypeScript), CrewAI (Python-only officially).

---

## Prior Research

- `AI_RESEARCH/2026-03-01-industry-gap-analysis-agent-orchestration.md` — gap analysis referencing LangGraph, CrewAI patterns
- `AI_RESEARCH/2026-03-22-multi-agent-orchestration-patterns.md` — multi-agent coordination patterns
- `AI_RESEARCH/2026-03-26-claude-code-multi-agent-orchestration.md` — Claude Agent SDK specifics

---

## Current Findings by Framework

---

### 1. LangChain.js / LangGraph.js

**TypeScript-native or port?**
Both LangChain.js and LangGraph.js are TypeScript-native packages maintained in separate repositories from the Python versions (`langchain-ai/langgraphjs`). They are parallel implementations, not transpiled ports. Python and JS SDKs are developed in sync but are separate codebases.

**Version / maturity:**
- LangChain.js v1.0 and LangGraph.js v1.0 both reached stable releases (announced together). Cited adoption by Uber, LinkedIn, Klarna, JP Morgan, Blackrock.
- LangGraph CLI: v0.4.19 (March 20, 2026)
- LangGraph GitHub: 27.6k stars (MIT license)
- Described as "the first stable major release in the durable agent framework space."

**Plugin / middleware system:**
LangChain v1.0 introduced a **middleware architecture** with hooks at multiple points in the agent loop. The `createDeepAgent()` pattern (via `langchain-ai/deepagentsjs`, 965 stars) injects planning, filesystem, and subagent capabilities as **composable middleware** implementing the `AgentMiddleware` interface. The `createReactAgent` function was deprecated in favor of `createAgent` which accepts middleware.

Built-in middleware provided: human-in-the-loop approval, conversation summarization, PII redaction.

**What the middleware system can do:**
- Inject behavior at agent loop execution points
- Each middleware is a separate composable unit
- SubAgent interface: name, description, systemPrompt, tools, model, middleware, interrupt configurations
- Typed interrupts with Zod schemas for human-in-the-loop pauses

**What it CANNOT do (vs. Harness plugin system):**
- No `onMessage` hook (pre-persistence step)
- No `onPipelineStart` / `onPipelineComplete` (wrapping the full pipeline)
- No `onAfterInvoke` (post-LLM notification)
- No per-plugin settings storage (no `getSettings()` / `notifySettingsChange()` equivalent)
- No `start()` / `stop()` lifecycle (no plugin lifecycle management)
- Middleware is per-agent, not cross-cutting across a multi-thread orchestrator

**State management:**
LangGraph uses explicit graph-based state: every node receives the current state, transforms it, and passes it along. Supports both short-term (in-graph) and long-term (checkpointed) memory. MemorySaver checkpointer for session persistence. Postgres checkpointer available for durable persistence.

**Tool definitions:**
Standard function-calling tools with schema definitions. No specific MCP integration mentioned in official LangGraph docs (MCP support not confirmed in official sources as of research date).

**Anthropic Claude support:**
Confirmed — tutorials and examples use Claude Sonnet 4.5 as the default model in Deep Agents (`createDeepAgent` defaults to Claude Sonnet 4.5). Claude is a first-class supported provider via `@langchain/anthropic`.

**License:** MIT

**Confidence:** HIGH (official docs, v1.0 release blog, GitHub)

---

### 2. Semantic Kernel (TypeScript)

**TypeScript-native or port?**
No official TypeScript SDK exists from Microsoft. Official language support is **C# (primary), Python, Java** only.

**Current status:**
A GitHub issue (#12093, opened May 2025) requesting TypeScript/Node.js support was marked **stale** after 90+ days with no commitment. The only official Microsoft response pointed to an **unofficial community port** (`afshinm/semantic-kernel-js`) maintained by a few Microsoft contributors in a personal capacity.

A separate community project (`semantic-kernel-typescript` by `lordkiz`) exists on GitHub but is not affiliated with Microsoft.

**What this means for migration:**
There is no production-suitable TypeScript Semantic Kernel. The C# version is enterprise-grade and production-ready. The TypeScript versions are experimental community ports with unknown maintenance commitments.

**Anthropic Claude support:** Confirmed in community ports; not relevant given overall status.

**License:** MIT (official C# SDK); community ports vary.

**Confidence:** HIGH for "not suitable" conclusion. Official GitHub issue confirms no Microsoft roadmap for TypeScript.

---

### 3. CrewAI

**TypeScript-native or port?**
**Python-only** officially. The CrewAI team (`crewAIInc`) has not released an official TypeScript SDK.

**Community ports:**
- `crewai-js` (GitHub: `clevaway/crewai-js`) — unofficial, the original maintainer has stopped maintaining it
- `crewai-ts` (GitHub: `ShMcK/crewai-ts`) — TypeScript port "under active development" but very early stage, not production-ready

**What this means for migration:**
CrewAI's multi-agent orchestration concepts (roles, tasks, crews) are Python-first. There is no TypeScript path to CrewAI without using the community ports that are either abandoned or early-stage.

**Confidence:** HIGH for "Python-only official" conclusion. Community ports verified via GitHub.

---

### 4. Vercel AI SDK (v6)

**TypeScript-native or port?**
TypeScript-native. Not a port. Built specifically for TypeScript/JavaScript environments.

**Version / maturity:**
v6 (latest as of research date). Open source. Automated migration available (`npx @ai-sdk/codemod v6`). Used widely in production — Vercel's own platform infrastructure.

**Plugin / middleware system:**
The AI SDK has a **language model middleware** system, but it operates at the LLM-call level only, not at the pipeline/agent level.

Three hook types:
- `transformParams` — modify parameters before they reach the LLM (applies to both generate and stream)
- `wrapGenerate` — intercept `doGenerate` (non-streaming), modify parameters and results
- `wrapStream` — intercept `doStream`, modify stream chunks via TransformStream

Five built-in middleware implementations: `extractReasoningMiddleware`, `extractJsonMiddleware`, `simulateStreamingMiddleware`, `defaultSettingsMiddleware`, `addToolInputExamplesMiddleware`.

Middleware composes sequentially: `firstMiddleware(secondMiddleware(yourModel))`.

**What the middleware system CANNOT do (vs. Harness plugin system):**
- No `onPipelineStart` / `onPipelineComplete` (middleware is per-LLM-call, not per-pipeline)
- No `onMessage` hook (no notification before/after user message persistence)
- No `onAfterInvoke` (middleware wraps the call, not a post-invoke notification)
- No plugin `start()` / `stop()` lifecycle
- No cross-cutting settings storage
- No `sendToThread` / `broadcast` equivalents

**What the Agent abstraction provides (v6):**
`ToolLoopAgent` class handles the complete tool execution loop automatically: appending responses to history, executing tool calls, triggering additional generations until max steps or text response. `inputProcessors` and `outputProcessors` on Agent constructor for message modification pipelines.

**Multi-agent:**
Subagents supported as a primitive. No first-class multi-agent orchestration pattern (no supervisor/worker framework built in).

**State management:**
Message history management built-in to ToolLoopAgent. `Memory` capabilities documented. No graph-based state management (that is LangGraph's domain, not Vercel AI SDK's).

**Tool definitions:**
`tool()` function, `dynamicTool()` for runtime-generated tools. `createMCPClient()` for MCP integration via stdio transport.

**MCP support:**
Native MCP integration in v6: `createMCPClient()` with OAuth authentication, resources, prompts, and elicitation. HTTP transport and stdio transport both supported.

**Anthropic Claude support:**
Confirmed first-class. Claude Sonnet 4.5 used in official documentation examples. Provider-specific tools: Anthropic memory and code execution tools exposed as native tools.

**License:** Apache 2.0 (Vercel AI SDK is Apache licensed)

**Confidence:** HIGH (official docs, v6 release blog)

---

### 5. Mastra

**TypeScript-native or port?**
TypeScript-native. Explicitly described as "a TypeScript framework." Created by the team behind Gatsby. Launched January 2026 after Y Combinator W25 batch ($13M funding).

**Version / maturity:**
- Current: `@mastra/core@1.13.0` (March 2026)
- 76+ releases, 22.4k GitHub stars, 1.8k forks, 1,700+ dependent projects
- Dual licensing: **Apache 2.0 core** + Enterprise License for premium features
- Production indicators: active changelog, YC-backed, multiple breaking changes showing rapid evolution

**Plugin / middleware system:**
Mastra does NOT have a `PluginDefinition`-style system with `register()`, `start()`, `stop()`, and named hooks. Instead, it uses:

1. **Workflow steps** with `execute()` as the primary execution unit. Steps can share state via `stateSchema` using `setState()` and `state` accessors.

2. **Tool lifecycle hooks** on `createTool()`:
   - `onInputStart` — streaming begins
   - `onInputDelta` — each incremental input chunk
   - `onInputAvailable` — complete input parsed and validated
   - `onOutput` — after successful execution and return
   - No `onError` hook at tool level (as of research date — GitHub issue #7751 requesting it)

3. **Workflow lifecycle callbacks** (not hooks):
   - `onFinish` — workflow completes with any status (success/failed/suspended/tripwire)
   - `onError` — workflow failure handler
   - NO `onStart` at workflow level documented

4. **Agent constructor processors** (not hooks):
   - `inputProcessors` — modify messages before agent processes them
   - `outputProcessors` — modify agent output before returning
   - `maxProcessorRetries` for processor resilience

5. **HTTP server middleware** (Hono-based):
   - `onValidationError` on `ServerConfig`/`createRoute()`
   - Standard Hono middleware for auth, CORS, request context
   - NOT an agent pipeline hook system

**What Mastra provides that Harness does NOT:**
- Built-in evaluation/observability (ObservabilityStorage, scoring, metrics — `@mastra/core@1.13.0`)
- Persistent agent workspace (`@mastra/agentfs` — database-persistent file storage via Turso/SQLite)
- Graph-based workflow engine with suspend/resume cycles
- Human-in-the-loop native (workflow `suspended` state)
- 40+ LLM providers through one standard interface
- Built-in RAG and vector search

**State management:**
`stateSchema` for cross-step state sharing. `suspended` / `resume` workflow states for durable execution pauses. Workflow result discriminated union: `success | failed | suspended | tripwire | paused`.

**Tool definitions:**
`createTool()` with Zod schemas. MCP exposure via `mcp` property with behavior annotations.

**MCP support:**
Yes — MCP server authoring built in. Tool `mcp` property exposes tools to MCP clients. `MCPClient` integration for consuming external MCP servers. The entire Mastra server can operate as an MCP server.

**Anthropic Claude support:**
Confirmed — "40+ providers through one standard interface" includes Anthropic. `instructions` field supports dynamic functions for per-request prompt modification.

**Confidence:** HIGH (official docs, GitHub, changelog)

---

### 6. Notable Additional Frameworks

#### VoltAgent
- TypeScript-native, MIT license, 7k+ GitHub stars
- "Observability-first" design philosophy
- Tool registry with Zod-typed tools + lifecycle hooks + cancellation
- MCP support: `@voltagent/mcp-docs-server`, MCP server connections without glue code
- Durable memory adapters (LibSQL and others)
- Supervisor agent orchestration with task delegation
- Anthropic Claude: supported via Vercel AI SDK integration
- VoltOps Console: production observability platform
- Status: active development, production-ready claimed
- Confidence: MEDIUM (GitHub README, landing page — full hook API details not verified)

#### OpenAI Agents SDK (TypeScript) — `@openai/agents`
- TypeScript-native
- `AgentHooks` class for lifecycle management at key execution points
- `InputGuardrail` / `OutputGuardrail` interfaces (middleware-style for request/response filtering)
- `addTraceProcessor` / `setTraceProcessors` for observability hooks
- `MCPServers` class with `connectMcpServers()` — stdio, SSE, HTTP transport
- `MemorySession` and `OpenAIConversationsSession` for state persistence
- Anthropic Claude: NOT supported (OpenAI models only). Third-party models require MCP server wrappers
- Status: v1 stable, production-ready
- License: not verified in research
- Confidence: MEDIUM (official docs site)

#### Strands Agents SDK (TypeScript) — `@strands-agents/sdk`
- TypeScript port of AWS-backed Python Strands framework (parallel implementations)
- Apache 2.0 license
- Extensible lifecycle hooks for monitoring and customizing agent behavior
- MCP client support built in
- Zod-based tool schemas
- Model-agnostic; Amazon Bedrock (Claude Sonnet 4) as default
- Status: **Preview/early stability** — 543 GitHub stars, explicitly marked preview
- Confidence: MEDIUM (GitHub README)

---

## Key Takeaways

### On Plugin/Hook System Parity

| Framework | Pipeline-level hooks | Tool-level hooks | Plugin lifecycle (start/stop) | Cross-cutting settings | sendToThread equivalent |
|-----------|---------------------|-----------------|-------------------------------|----------------------|------------------------|
| Harness (current) | YES — onMessage, onBeforeInvoke, onAfterInvoke, onPipelineStart, onPipelineComplete, onBroadcast | N/A | YES — register/start/stop | YES — getSettings/notifySettingsChange | YES |
| LangGraph.js | Partial — AgentMiddleware interface, no named pipeline steps | N/A | NO | NO | NO |
| Mastra | NO — workflow steps only, no pipeline hooks | YES (4 hooks: onInputStart/Delta/Available, onOutput) | NO (no start/stop) | NO | NO |
| Vercel AI SDK v6 | NO — LLM-call middleware only | N/A | NO | NO | NO |
| VoltAgent | YES (claimed) — tool lifecycle hooks + supervisor orchestration | YES | Unclear | Unclear | NO |
| OpenAI Agents SDK | Partial — AgentHooks, guardrails | N/A | NO | NO | NO |
| Semantic Kernel (TS) | N/A — no viable TS version | N/A | N/A | N/A | N/A |
| CrewAI | N/A — Python only | N/A | N/A | N/A | N/A |

### On MCP Compatibility

All TypeScript-native frameworks (Mastra, Vercel AI SDK v6, VoltAgent, OpenAI Agents SDK) support MCP. Harness's existing plugin tool system (`pluginName__toolName` prefix) is closest to MCP tool registration conventions — migration to MCP-compatible tool definitions would be architecturally natural.

### On Anthropic Claude Support

| Framework | Claude Support | Notes |
|-----------|---------------|-------|
| LangGraph.js | YES (first-class) | `@langchain/anthropic`, default in Deep Agents |
| Mastra | YES | 40+ providers via unified interface |
| Vercel AI SDK v6 | YES (first-class) | Anthropic-specific tools exposed natively |
| VoltAgent | YES | Via Vercel AI SDK |
| OpenAI Agents SDK | NO | OpenAI models only; MCP workaround only |
| Strands TS | YES | Via Amazon Bedrock (Claude Sonnet 4) |

### Migration Suitability Assessment

**Cannot migrate (insufficient TypeScript maturity):**
- Semantic Kernel — no official TS SDK, no roadmap
- CrewAI — no official TypeScript version

**Poor fit (wrong abstraction model):**
- Vercel AI SDK v6 — excellent for LLM call middleware, fundamentally wrong layer for Harness's plugin system. Would require rebuilding the pipeline from scratch without a hook system.
- OpenAI Agents SDK — locked to OpenAI; no Anthropic support; guardrail model != Harness hooks

**Possible fit (with significant rework):**
- LangGraph.js — powerful stateful graph execution and middleware, but no equivalent to `onPipelineStart`, `onPipelineComplete`, `onAfterInvoke`, `onMessage`. The Deep Agents middleware pattern is the closest conceptual match but serves a different architectural role. State management (graph checkpointing) is superior to Harness.

**Best fit for greenfield (if migrating):**
- Mastra — richest TypeScript-native feature set, active development, YC-backed, best production observability. BUT: architectural model is fundamentally different. Mastra uses workflow graphs + tool hooks, not a plugin system with pipeline-level hooks. Harness's 21 plugins would not map cleanly; each would need to be rewritten as workflow steps or processors.

**Keep what you have:** Harness's plugin system with named lifecycle hooks (`onBeforeInvoke`, `onAfterInvoke`, `onMessage`, `onPipelineStart/Complete`, `onBroadcast`, `onSettingsChange`) is more composable for this specific use case (multi-threaded orchestrator with per-plugin DB settings, start/stop lifecycle, cross-cutting broadcast) than any framework currently offers in TypeScript.

---

## Gaps Identified

1. **LangGraph.js middleware API specifics**: Could not access the complete `AgentMiddleware` interface signature from official docs. Only the `createDeepAgent()` usage pattern was verified.

2. **VoltAgent full hook API**: The complete hook type signatures (what hooks exist, what data they receive) were not accessible from the website — only marketing-level descriptions.

3. **LangGraph.js MCP support**: MCP is not mentioned in the LangGraph.js official documentation in any of the pages visited. This absence may mean it is not supported, or documentation has not been updated.

4. **Mastra plugin system**: Mastra explicitly does not have a "plugin" concept. Its closest equivalent is the `Mastra` constructor's dependency injection (`agents`, `workflows`, `tools`, `memory`, `storage` as registered services). This is structural, not behavioral hook-based.

5. **VoltAgent production evidence**: 7k stars and active development confirmed, but no verified large-scale production deployments found in primary sources.

---

## Recommendations for Next Steps

1. **Do not migrate** based on current framework landscape. No TypeScript framework replicates the Harness plugin hook system at the pipeline-message level (`onMessage`, `onPipelineStart`, `onPipelineComplete`, `onBroadcast`, `onSettingsChange`).

2. **Adopt selectively:** Consider adopting specific capabilities from these frameworks rather than wholesale migration:
   - **Mastra's `@mastra/agentfs`** for agent workspace persistence
   - **Mastra's ObservabilityStorage** patterns for the observability gaps identified in the gap analysis
   - **Vercel AI SDK v6's MCP client** (`createMCPClient()`) if migrating Harness tool definitions to MCP format
   - **LangGraph.js checkpointing** patterns for durable task execution (fixes orphaned task gap)

3. **Monitor VoltAgent**: At 7k stars with a TypeScript-first plugin hook design, VoltAgent is the most architecturally similar to Harness. Worth reading the full source code (`@voltagent/core`) to see if the hook API is a match before ruling it out.

4. **Consider Mastra as a long-term migration target** if the Harness plugin system becomes a maintenance burden. Mastra is the best-maintained, most feature-complete TypeScript agent framework, but the migration would be a rewrite of the plugin layer, not a drop-in replacement.

---

## Sources

- LangGraph.js overview: https://docs.langchain.com/oss/javascript/langgraph/overview
- LangGraph v1.0 release blog: https://blog.langchain.com/langchain-langgraph-1dot0/
- LangGraph v1 changelog: https://docs.langchain.com/oss/javascript/releases/langgraph-v1
- Deep Agents JS GitHub: https://github.com/langchain-ai/deepagentsjs
- LangGraph GitHub: https://github.com/langchain-ai/langgraph
- Semantic Kernel TypeScript issue: https://github.com/microsoft/semantic-kernel/issues/12093
- Semantic Kernel GitHub: https://github.com/microsoft/semantic-kernel
- CrewAI GitHub: https://github.com/crewAIInc/crewAI
- CrewAI-JS (abandoned): https://github.com/clevaway/crewai-js
- CrewAI-TS (community): https://github.com/ShMcK/crewai-ts
- Vercel AI SDK v6 release: https://vercel.com/blog/ai-sdk-6
- Vercel AI SDK docs: https://ai-sdk.dev/docs/introduction
- Vercel AI SDK middleware: https://ai-sdk.dev/docs/ai-sdk-core/middleware
- Vercel AI SDK agents: https://ai-sdk.dev/docs/foundations/agents
- Mastra GitHub: https://github.com/mastra-ai/mastra
- Mastra docs: https://mastra.ai/docs
- Mastra Agent reference: https://mastra.ai/reference/agents/agent
- Mastra createTool reference: https://mastra.ai/reference/tools/create-tool
- Mastra changelog 2026-03-13: https://mastra.ai/blog/changelog-2026-03-13
- VoltAgent GitHub: https://github.com/VoltAgent/voltagent
- VoltAgent website: https://voltagent.dev/
- OpenAI Agents SDK TypeScript: https://openai.github.io/openai-agents-js/
- Strands Agents TypeScript SDK: https://github.com/strands-agents/sdk-typescript
