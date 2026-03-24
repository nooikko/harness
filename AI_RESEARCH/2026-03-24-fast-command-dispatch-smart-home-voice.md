# Research: Fast Command Dispatch for Smart Home and Voice-First AI Systems

Date: 2026-03-24

## Summary

Research into how production smart home and voice AI systems achieve fast command dispatch, specifically addressing the problem of an 11-second "turn on the lights" latency when routed through a full LLM pipeline. The core finding across every system examined: **no production voice-first system uses a full LLM call as its primary dispatch path for known device commands.** They all layer a fast deterministic tier before the LLM.

## Prior Research

- `2026-03-20-claude-agent-sdk-latency-optimization.md` — cold start problem (~12s per new subprocess), session warm-up, why Harness already uses async generator sessions
- `2026-02-25-dynamic-tool-discovery-intent-routing.md` — structured tool_use vs text parsing, how production agent systems route tool calls
- `2026-02-24-anthropic-api-low-latency-chat.md` — direct API latency characteristics

---

## Area 1: Home Assistant Voice Pipeline (Hassil + Speech-to-Phrase)

### Pipeline Architecture

Home Assistant Assist runs four sequential stages:

```
Wake Word → STT (Speech-to-Text) → Intent Recognition → TTS (Text-to-Speech)
```

Stages can be partially skipped via `start_stage` / `end_stage` parameters (e.g., start at text-in if already transcribed). The `start_stage` shortcut is significant: text-input can bypass STT entirely, collapsing "turn on the lights" directly into intent matching.

Source: [Assist Pipeline Developer Docs](https://developers.home-assistant.io/docs/voice/pipelines/)

### Hassil: Template-Based Intent Matching (NOT ML)

Hassil is Home Assistant's intent parser. It uses **template-based pattern matching** — effectively compiled regex over YAML-defined sentence templates, not a neural network.

Pattern syntax:
- Alternatives: `(red|green|blue)`
- Optionals: `[the]`
- Permutations: `(patience; you must have) my young Padawan`
- Slot lists: `{list_name:slot_name}` (variables like entity names)
- Expansion rules: `<rule_name>`

Performance implications: pure string matching with no ML inference, sub-millisecond matching time once templates are compiled. No GPU required, runs on Raspberry Pi.

Source: [HassIL GitHub](https://github.com/OHF-Voice/hassil)

### Speech-to-Phrase: The Fast Local Path (2025)

Released in Voice Chapter 9 (February 2025), Speech-to-Phrase is the architectural answer to the latency problem:

> "Instead of trying to transcribe whatever you said it tries to find the best match over the collection of phrases it assembled on startup."

**Performance numbers (Confidence: HIGH):**
- Raspberry Pi 4: ~0.5 seconds from finish speaking to response
- Raspberry Pi 5: ~150ms per command
- Traditional Whisper STT: 2-15 seconds (up to 15s for non-matching sentences before 2024.12 optimization)

**How it achieves this:** On startup, it pre-generates all possible phrases by expanding templates against the current device/entity list. It then fine-tunes a small model specifically on those phrases. At runtime, it classifies against that narrow fixed set — not open-ended transcription.

**What it cannot handle:** Wildcards, open-ended inputs (shopping lists, named timers, broadcasts), anything requiring free-form text generation.

Source: [Voice Chapter 9](https://www.home-assistant.io/blog/2025/02/13/voice-chapter-9-speech-to-phrase/)

### The Hybrid Fallback Pattern (Key Architecture Insight)

Since Home Assistant 2024.12, the production-recommended architecture is:

```
Command → Hassil template match → SUCCESS: execute immediately (<500ms)
                                → FAIL: route to LLM agent (2-8s)
```

> "Specific known commands will be processed locally and extremely fast, and the power of an LLM will only be used for more complex queries that Home Assistant does not natively understand."

The LLM's API footprint is also deliberately constrained: "an AI agent will only have access to one API at a time" and the API is "based on the intent system because it is our smallest API" — they deliberately reduce tool count to lower model confusion.

Source: [AI Agents for the Smart Home](https://www.home-assistant.io/blog/2024/06/07/ai-agents-for-the-smart-home/)

### Measured Latency Breakdown (Community Data)

Real user measurements from the community forums:
- STT: 0.8s
- NLP/Intent: 0.16s
- TTS: 0.0s (negligible)
- **End-to-end with HA pipeline orchestration: 13s**

The 13-second figure is attributed entirely to pipeline orchestration overhead, not the component latencies. This matches the Harness 11-second problem exactly — the components are fast, the scaffolding is slow.

Source: [Workaround for Pipeline Orchestration Latency](https://community.home-assistant.io/t/workaround-for-pipeline-orchestration-latency-in-ha/964783)

---

## Area 2: OpenAI / Anthropic Function Calling Fast Patterns

### Parallel Tool Calling

OpenAI models (GPT-4.1+, o3-mini, o1) support `parallel_tool_calls=true`, which allows a single inference pass to emit multiple tool calls simultaneously. Relevant for compound commands like "turn on lights and play music" — both can dispatch in one round-trip rather than two.

**LLMCompiler** (ICML 2024, Stanford/Berkeley) demonstrated this approach at scale: by decomposing tasks into parallel function calls in a single planning step, they achieved measurable latency reduction for multi-tool workflows.

Source: [LLMCompiler GitHub](https://github.com/SqueezeAILab/LLMCompiler)

### Anthropic Prompt Caching for Tool Definitions

This is directly applicable to Harness. Claude supports caching of tool definitions and system prompts:

```
Tool definitions (static) → cache_control: "ephemeral" → 5-min or 1-hour TTL
System prompt (static) → cache_control: "ephemeral"
Conversation history (growing) → automatic cache breakpoint
```

**Latency impact (Confidence: HIGH):**
- Cache reads provide "improved time-to-first-token for long documents"
- Cache reads cost 0.1× base input tokens (10× cheaper than cold reads)
- 5-minute and 1-hour TTLs have identical latency characteristics
- For tool-heavy prompts (many device definitions), caching eliminates re-processing the static context on every message

**Minimum cacheable length:** 4,096 tokens for Haiku/Opus, 2,048 for Sonnet. Harness's device list + tool definitions must exceed this threshold for caching to help.

**Critical placement rule:** Cache breakpoints must be on stable content. If the device list or tool definitions change per-request, they will never cache-hit.

Source: [Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

### Anthropic Programmatic Tool Calling

Anthropic's "programmatic tool calling" pattern lets Claude write code that orchestrates multiple tool calls in a single code execution block, rather than returning to the model after each tool invocation:

- Traditional 5-tool workflow: 5 inference passes
- Programmatic: 1 inference pass + n tool calls in code
- Token reduction: 37% fewer tokens (43,588 → 27,297 average on benchmark tasks)

This is the right pattern for compound commands, but it still requires one LLM pass to decide what code to write.

Source: [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)

---

## Area 3: Voice Assistant Architectures (Alexa, Google Home, Siri)

### Alexa's Speculative End-Pointing

Amazon's most relevant latency optimization for Harness's use case:

> "One is a speculative end-pointer that we have tuned to be about 200 milliseconds faster than the final end-pointer."

The aggressive end-pointer fires ~200ms before the conservative one, allowing NLU to begin processing before the user has fully stopped speaking. If the speculative cut is wrong, processing resets.

**On-device vs cloud split:**
- On-device: acoustic feature extraction, ASR lattice generation, speculative end-pointing, context biasing
- Cloud: neural language model reranks ASR hypotheses, final intent dispatch

The key insight: "only the lattice is sent to the cloud, where a large and powerful neural language model reranks the hypotheses" — not raw audio. This reduces bandwidth and cloud processing time substantially.

Source: [Alexa On-Device Speech Processing](https://www.amazon.science/blog/on-device-speech-processing-makes-alexa-faster-lower-bandwidth)

### Google Home Local Execution Architecture

**Latency breakdown by execution path (Confidence: HIGH):**
- Local execution (Matter/Thread/Zigbee): sub-200ms
- Cloud-only routines: 2-3 seconds
- Full cloud execution path: 2-5 seconds, fails when internet drops

Architecture layers:
1. Device layer: Zigbee, Matter, BLE
2. Bridge layer: Nest Hub / Chromecast as local hub
3. Cloud layer: Google Assistant, Home Graph

When local execution is possible (Matter devices), Google Home bypasses the cloud entirely and routes the command to the device directly. The NLU still happens in the cloud, but the device command is executed locally.

### Voice Agent Latency Benchmarks (2025 Production Data)

From Twilio's November 2025 benchmark (voice call agents, applicable principles):

| Component | Target | Upper Limit |
|-----------|--------|-------------|
| Speech-to-Text | 350ms | 500ms |
| LLM Time-to-First-Token | 375ms | 750ms |
| TTS Time-to-First-Byte | 100ms | 250ms |
| **Total mouth-to-ear** | **1,115ms** | **1,400ms** |

Key insight: Even with an LLM in the critical path for voice call agents (which have harder latency requirements than home automation), the target is ~375ms for LLM TTFT. This is achievable because the models are streaming and the content is short.

For smart home specifically (no TTS required), the target is sub-500ms.

Source: [Twilio Core Latency Guide](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)

### Cresta's Real-Time Voice Agent Optimization Patterns

Production-proven techniques from a real-time voice AI company:

- **Connection reuse**: Persistent connections to LLM, no DNS in critical path
- **Speculative execution**: Start LLM calls before the user finishes speaking
- **Hedging**: Launch 2 parallel LLM calls, use whichever returns first (reduces tail latency)
- **Concurrent pre-fetch**: Pre-emptively trigger external lookups at start of turn, not after NLU

Source: [Cresta Engineering for Real-Time Voice Agent Latency](https://cresta.com/blog/engineering-for-real-time-voice-agent-latency)

---

## Area 4: Agent Framework Fast Paths

### The Semantic Router Pattern (Most Relevant to Harness)

**Semantic Router** (Aurelio AI, MIT licensed) is the most directly applicable technology found:

> "Rather than asking an LLM to classify the query at runtime, one can pre-encode a set of example utterances for each intent (route) and then route by nearest-neighbor in embedding space."

**Performance claim:** "Reduces processing latency from 5000ms to just 100ms."

**How it works:**
1. At startup: define routes with sample utterances (e.g., `Route(name="lights_on", utterances=["turn on the lights", "lights on please", "can you turn on the lights"])`)
2. Pre-compute embeddings for all utterances using a small local embedding model
3. At runtime: embed the user query (one fast embedding call), find nearest route via cosine similarity
4. If confidence above threshold: dispatch tool directly without LLM call
5. If confidence below threshold: fall through to full LLM

**Accuracy:** 92-96% precision in production deployments.

Source: [Semantic Router GitHub](https://github.com/aurelio-labs/semantic-router)

### Embedding-Based Intent Classification at <1ms

Research paper demonstrated sub-millisecond intent classification:

> "A fast intent router strategy handles 95% of queries instantly with lightweight models, while routing the complex 5% to heavier models."

The approach uses pre-computed embedding centroids for each intent class. At runtime, one embedding call + dot product comparison. For a fixed device list (lights, music, thermostat, etc.), all centroids can be held in memory.

Source: [Intent Classification in <1ms (Medium)](https://medium.com/@durgeshrathod.777/intent-classification-in-1ms-how-we-built-a-lightning-fast-classifier-with-embeddings-db76bfb6d964)

### LangGraph Conditional Routing

LangGraph's relevant pattern is the **deterministic conditional edge** — routing logic that inspects state without an LLM call:

```typescript
// Route function: pure JS, no LLM call
const route = (state) => {
  if (state.intent_confidence > 0.9) return "direct_dispatch";
  if (state.intent_confidence > 0.6) return "llm_with_hint";
  return "full_llm";
};
graph.addConditionalEdges("classify", route);
```

The key insight: the routing decision itself can be deterministic (embedding similarity score check), with LLM inference only happening in the selected downstream node.

Source: [LangGraph Conditional Edges](https://dev.to/jamesli/advanced-langgraph-implementing-conditional-edges-and-tool-calling-agents-3pdn)

### Semantic Kernel's Approach

Semantic Kernel (Microsoft) documents the same pattern:

> "A rules engine or keyword matcher for simple intents (e.g. if the question contains 'weather' then call the weather agent)"

Their official guidance acknowledges that function calling via LLM is slower than pre-routing, and recommends hybrid approaches. They specifically endorse Semantic Router as a complementary tool.

Source: [Semantic Kernel Function Calling](https://jamiemaguire.net/index.php/2024/07/13/function-calling-and-planners/)

### BERT-Based Routing for Cost/Latency Reduction

Academic research (2024) showed a BERT-based router model:
- Reduces costs by 30%
- Reduces latency by 40%
- Compared to stand-alone generalist LLM handling all requests

BERT-class models are tiny (110M parameters), run locally, and classify in <10ms on CPU.

---

## Area 5: Device State Caching Patterns

### Event-Driven vs Polling Architecture

Home Assistant uses an **event-driven state bus** as its core architecture:

> "Home Assistant is built upon an event-driven architecture where most actions, state changes, and internal processes generate events that are broadcast across the system."

This means device state is always current in memory — no polling latency on read. State changes (a light turns on physically) push events to the bus, updating the internal state store immediately.

**For tool dispatch:** When a plugin needs to know "what lights are on," the answer comes from in-memory state, not a network call. This is what makes sub-200ms local device control possible.

Source: [Home Assistant Event Bus](https://newerest.space/mastering-home-assistant-event-bus/)

### Google Cast / Chromecast State Regression Example

A real-world latency regression in Home Assistant 2021.12 showed Cast device latency went from <1s to 4s. Root cause: polling interval change. Fix: revert to event-based state tracking.

This demonstrates that device state polling (even with short intervals) introduces compounding latency when commands depend on fresh state.

### TTL Strategies for Device Lists

Community consensus from Home Assistant discussions:
- **Device discovery (mDNS/Zeroconf):** Cache indefinitely, re-discover on error
- **Device capability lists:** Cache until next device firmware update event
- **Device state (on/off, brightness):** Event-driven (no TTL needed if using push events)
- **Device availability:** Short poll (30s) as a fallback for devices that don't push events

For a music plugin context (Cast devices), the relevant approach is:
- Device list: cache from startup mDNS discovery, refresh on error
- Playback state: subscribe to Cast status events (pychromecast/node-castv2 does this natively)

### TinyML Edge Processing (Extreme Low-Latency Reference)

For context on what is achievable at the edge:

> "Quantized models can achieve 5ms latency using 7.9K RAM and 43.7K flash for keyword classification on resource-constrained devices."

This is the floor for keyword-based intent matching — 5ms on a microcontroller with no network. It's cited here as a reference point, not a recommendation.

Source: [TinyML Keyword Spotting MDPI](https://www.mdpi.com/2673-4591/82/1/30)

---

## Synthesis: The Three-Tier Dispatch Architecture

Every production system examined converges on the same layered architecture:

```
Tier 1 (Fast Path): Deterministic matching
  - Technique: Template matching (Hassil), keyword rules, embedding similarity
  - Latency: <50ms to <500ms
  - Coverage: 80-95% of smart home commands
  - Examples: "turn on the lights", "play music", "set volume to 50%"
  - No LLM involved

Tier 2 (Medium Path): LLM with pre-classified context
  - Technique: Small fast model (Haiku, Flash, Haiku-mini) + tool call
  - Latency: 1-3s
  - Coverage: Commands with ambiguous parameters or complex logic
  - Examples: "turn on the lights in the living room for my movie night"
  - One LLM call, constrained tool set, cached system prompt

Tier 3 (Slow Path): Full LLM reasoning
  - Technique: Full Claude pipeline with all context and tools
  - Latency: 5-15s
  - Coverage: Complex multi-step tasks, unknown commands, agent reasoning
  - Examples: "help me set up a morning routine", "why won't the thermostat respond"
  - Full Harness pipeline as currently implemented
```

The current Harness architecture has only Tier 3. The 11-second "turn on the lights" problem is that a simple Tier 1 command is going through Tier 3.

---

## Key Takeaways for Harness

1. **The Hassil pattern is the fastest practical path:** Pre-enumerate all known commands (device names × action verbs), build a deterministic matcher at startup. "Turn on [device]" should never touch an LLM. ~100-500ms achievable.

2. **Embedding-based routing (Semantic Router) is the next tier:** For commands that don't match templates exactly, embed the query and compare to pre-computed intent centroids. 100ms with a local FastEmbed model, 92-96% accuracy. Falls through to LLM only on low-confidence.

3. **Prompt caching is immediately applicable:** Cache all tool definitions and the system prompt with `cache_control: "ephemeral"`. For the existing full-LLM path, this alone can reduce TTFT on subsequent turns. Requires prompt > 4,096 tokens for Haiku, 2,048 for Sonnet.

4. **Constrain tool sets for device commands:** Home Assistant explicitly limits their LLM to "the smallest API" — fewer tools means faster model decision. When routing to an LLM for device control, pass only device-control tools, not the full MCP tool set.

5. **Parallel tool calls for compound commands:** "Turn on lights and play music" should dispatch both tools in one LLM inference pass, not two sequential ones. This is already supported in Claude via parallel tool_use blocks.

6. **The Harness session pool already solves the cold-start problem** (from `2026-03-20-claude-agent-sdk-latency-optimization.md`): subsequent warm turns are 2-3s. The 11-second latency is not all cold-start — it includes reasoning time for a simple command.

7. **Event-driven device state:** Cache the device list at startup, subscribe to push events for state. Never query device state on every command. This eliminates network round-trips from the dispatch path.

---

## Gaps Identified

- **Specific Claude Haiku TTFT for tool-call-only responses:** The docs confirm caching helps, but no millisecond numbers for "Haiku with 3 tools, single turn, cached system prompt" are publicly documented. (Confidence: LOW for exact numbers)
- **Semantic Router actual benchmark with local FastEmbed:** The "100ms" claim is for the routing step with a hosted encoder. Local FastEmbed (no network) may be faster or slower depending on hardware.
- **Anthropic parallel tool_use in Claude Agent SDK:** OpenAI explicitly documents `parallel_tool_calls=true`. Claude Agent SDK equivalent behavior is not documented with the same specificity.

---

## Recommendations for Next Steps

1. **Implement a command pattern matcher** for known device commands (lights, volume, play/pause, Cast target). This is a pure TypeScript function with zero ML dependency. Estimated coverage: 70-80% of "turn on X / turn off X / set X to Y" commands.

2. **Add Semantic Router or equivalent** for commands that don't match exact patterns. Aurelio's library supports Qdrant (already in Harness) as a vector backend. Routes defined with 5-10 sample utterances per intent.

3. **Add prompt caching** to the existing Haiku invocation in Harness's full LLM path. Cache the system prompt + tool definitions. Low-effort, immediate latency improvement for the 20-30% of commands that genuinely need LLM reasoning.

4. **Create a "device command" sub-path** that invokes Haiku directly (not the full Claude Agent SDK pipeline) with only device-control tools. Target: 1-2s for non-template commands.

---

## Sources

- [Home Assistant Assist Pipeline Docs](https://developers.home-assistant.io/docs/voice/pipelines/)
- [HassIL GitHub](https://github.com/OHF-Voice/hassil)
- [Voice Chapter 9: Speech-to-Phrase](https://www.home-assistant.io/blog/2025/02/13/voice-chapter-9-speech-to-phrase/)
- [Voice Chapter 10](https://www.home-assistant.io/blog/2025/06/25/voice-chapter-10/)
- [AI Agents for the Smart Home](https://www.home-assistant.io/blog/2024/06/07/ai-agents-for-the-smart-home/)
- [HA Voice Pipeline Orchestration Latency (Community)](https://community.home-assistant.io/t/workaround-for-pipeline-orchestration-latency-in-ha/964783)
- [HA Voice Command Latency (Community)](https://community.home-assistant.io/t/voice-command-latency/889423)
- [Alexa On-Device Speech Processing](https://www.amazon.science/blog/on-device-speech-processing-makes-alexa-faster-lower-bandwidth)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Semantic Router GitHub](https://github.com/aurelio-labs/semantic-router)
- [Intent Classification in <1ms](https://medium.com/@durgeshrathod.777/intent-classification-in-1ms-how-we-built-a-lightning-fast-classifier-with-embeddings-db76bfb6d964)
- [LLMCompiler (ICML 2024)](https://github.com/SqueezeAILab/LLMCompiler)
- [Cresta Real-Time Voice Agent Latency](https://cresta.com/blog/engineering-for-real-time-voice-agent-latency)
- [Twilio Core Latency AI Voice Agents](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)
- [Intent Recognition and Auto-Routing in Multi-Agent Systems](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa)
- [LangGraph Conditional Edges](https://dev.to/jamesli/advanced-langgraph-implementing-conditional-edges-and-tool-calling-agents-3pdn)
- [Semantic Kernel Function Calling](https://jamiemaguire.net/index.php/2024/07/13/function-calling-and-planners/)
- [Home Assistant Event Bus](https://newerest.space/mastering-home-assistant-event-bus/)
- [TinyML Keyword Spotting MDPI](https://www.mdpi.com/2673-4591/82/1/30)
- [Google Home Local Execution Architecture](https://www.jegec.com/2026/02/24/how-voice-assistants-like-alexa-and-google-assistant-process-your-requests/)
