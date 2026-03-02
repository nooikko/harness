# Identity Plugin — Developer Notes

## Overview

Two-hook plugin. Implements `onBeforeInvoke` and `onAfterInvoke`. Read `src/index.ts` and all helpers in `src/_helpers/` before editing.

---

## Registration order

The identity plugin must be **first** in the `ALL_PLUGINS` array in `apps/orchestrator/src/plugin-registry/index.ts`.

`onBeforeInvoke` is a chain hook: each plugin receives the output of the previous plugin's `onBeforeInvoke`. If identity runs first, the soul and memory header forms the foundation of the assembled prompt. The context plugin (which runs next) then prepends conversation history above the prompt content — meaning history is correctly sandwiched between the soul header and the original user message. If the order is reversed, history appears before the soul, weakening character consistency.

---

## `onBeforeInvoke` behavior

```
1. loadAgent(db, threadId)          — db.thread.findUnique → db.agent.findFirst(enabled: true)
   If no agent found: return prompt unchanged (no-op for unassigned threads)

2. retrieveMemories(db, agentId, prompt, 10)
   — Fetches up to 100 recent AgentMemory rows, scores them, returns top 10
   — Scoring: recency (exponential decay, DECAY_RATE=0.995/hour) + importance (0–1 normalized)
   — Updates lastAccessedAt on the top 10 as a side effect

3. formatIdentityHeader(agent, memories, options)
   — Builds: "# {name} — Session Identity" + soul (≤5000 chars) + identity (≤2000 chars)
   — If memories present: adds "## Relevant Memory" section
   — Appends Chain of Persona instruction (PCL 2025)

4. formatIdentityAnchor(agent)
   — Extracts first non-empty line of soul as core principle
   — Builds: "## {name} — Behavioral Anchor" + "You are {name}..." + core principle

5. Return [header, prompt, anchor].join('\n\n---\n\n')
```

The **dual injection** (header at top, anchor at bottom) is intentional. The header establishes identity before the user message; the anchor reinforces it after. Long code-heavy responses can drift away from the soul — the anchor at the bottom is the last thing Claude reads before generating a response, pulling character back to center.

---

## `onAfterInvoke` behavior

```
1. loadAgent(db, threadId)          — same two-query lookup as onBeforeInvoke
   If no agent: return immediately (no-op)

2. void scoreAndWriteMemory(ctx, agentId, threadId, result.output)
   — Fire-and-forget: hook resolves immediately, scoring runs in background
   — Does NOT block the pipeline
```

`scoreAndWriteMemory` internally:

```
1. buildScoringSnippet(output)      — head 250 chars + "[...]" + tail 250 chars
   (If output ≤ 500 chars: use as-is)

2. ctx.invoker.invoke(scoringPrompt, { model: 'claude-haiku-4-5-20251001' })
   — Ask Haiku to rate 1–10. Parse integer.
   — On error: return silently (no pipeline impact)

3. If importance < 6: return (threshold = IMPORTANCE_THRESHOLD)

4. ctx.invoker.invoke(summaryPrompt, { model: 'claude-haiku-4-5-20251001' })
   — Ask Haiku for 1–2 sentence memory in past tense, third person
   — On error: fall back to first 200 chars of scoring snippet

5. db.agentMemory.create({ agentId, content, type: 'EPISODIC', importance, threadId })
6. logger.debug('Wrote episodic memory', { agentId, threadId, importance })
```

---

## Memory snippet strategy

`SNIPPET_HEAD = 250`, `SNIPPET_TAIL = 250`, separator `[...]`.

Rationale: code-heavy responses often begin with reasoning and end with a conclusion. Capturing only the head would miss the conclusion; capturing only the tail would miss the framing. Head+tail with a separator captures both with minimal token cost for the Haiku importance-scoring call.

If the full output fits within 500 chars, no truncation occurs.

---

## Importance threshold

`IMPORTANCE_THRESHOLD = 6` on the Park et al. 1–10 scale:

- **1–5**: Mundane exchanges — greetings, simple acknowledgments, short factual lookups. Not worth long-term memory.
- **6–10**: Significant events — decisions, insights, new understanding, solutions to hard problems, completed tasks with non-obvious outcomes.

Lowering the threshold increases memory volume (noisier retrieval). Raising it means fewer memories (risk of losing important events). 6 is calibrated to capture roughly the top third of interactions.

---

## Model

Both importance scoring and summarization use `claude-haiku-4-5-20251001`.

Haiku is chosen because:
1. Importance scoring requires parsing exactly one integer — no reasoning depth needed.
2. Summarization is a compression task, not a reasoning task — Haiku is sufficient.
3. These calls happen in the background after every invocation. Using Sonnet or Opus would meaningfully increase per-message cost without improving memory quality.

Do not change the model without a clear, cost-justified reason.

---

## Debugging

**Memories not being written:**
1. Check whether `onAfterInvoke` is firing (look for other plugin logs at that pipeline step).
2. Check the importance score: add a temporary `logger.debug` before the threshold check in `score-and-write-memory.ts`. If scores are consistently below 6, the content is being rated as mundane.
3. Check whether `ctx.invoker.invoke` is throwing — errors are swallowed silently. Add a `logger.warn` in the catch blocks temporarily.
4. Verify the thread has an agent assigned (`thread.agentId` non-null, `agent.enabled = true`).

**Soul not appearing in prompts:**
1. Verify the thread has an `agentId` set in the database.
2. Verify the agent record exists with `enabled = true`.
3. Confirm `loadAgent` is being called — the identity plugin must be in `ALL_PLUGINS` and must not be disabled via `PluginConfig` in the DB.
4. Confirm the identity plugin is listed **before** other `onBeforeInvoke` plugins in the registry.

**Memories retrieved but stale:**
`retrieveMemories` updates `lastAccessedAt` on every retrieval. If you see the same memories every time regardless of recency, check that `DECAY_RATE` (0.995 per hour) and the candidate pool (`CANDIDATE_POOL = 100`) are reasonable for the agent's memory volume.
