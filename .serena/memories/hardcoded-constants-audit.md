# Hardcoded Constants Audit — All Plugins

## Summary
Searched 7 plugins for configurable constants. Found 23 hardcoded values that could be moved to PluginConfig or env vars.

---

## 1. AUDIT PLUGIN (`packages/plugins/audit/src/`)

### Message extraction limit
- **Location:** `src/index.ts:32`
- **Value:** `take: 200`
- **Description:** Maximum number of text messages extracted from thread before deletion
- **Rationale:** Token limit on extraction prompt
- **Configurable?** Yes — could be ENV or PluginConfig

### Duplicate guard timeout
- **Location:** `src/index.ts:80`
- **Value:** `60_000` (60 seconds)
- **Description:** Prevents double-extraction if audit:requested broadcast twice
- **Calculation:** `Date.now() - 60_000`
- **Configurable?** Yes — could be ENV or per-thread config

### Model
- **Location:** `src/index.ts:44`
- **Value:** `'claude-haiku-4-5-20251001'`
- **Description:** Haiku for cost efficiency on extraction prompts
- **Configurable?** Yes — could default to config.claudeModel or env var

---

## 2. AUTO-NAMER PLUGIN (`packages/plugins/auto-namer/src/`)

### Model
- **Location:** `_helpers/generate-thread-name.ts:11`
- **Value:** `'claude-haiku-4-5-20251001'`
- **Description:** Haiku for thread name generation
- **Configurable?** Yes — could default to config.claudeModel or env var

### Prompt constants
- **Location:** `_helpers/generate-thread-name.ts:8`
- **Value:** Hard-coded prompt: "Generate a short, descriptive 5-8 word title for a chat thread..."
- **Description:** Thread naming instructions
- **Configurable?** Yes — could be ENV or PluginConfig template

---

## 3. METRICS PLUGIN (`packages/plugins/metrics/src/`)

### Pricing map
- **Location:** `plugin-contract/src/_helpers/model-pricing.ts` (shared)
- **Values:**
  - Haiku: $0.80/$4.00 per 1M input/output tokens
  - Sonnet: $3/$15 per 1M
  - Opus: $15/$75 per 1M
- **Description:** Hardcoded pricing for cost calculation
- **Note:** Moved to shared plugin-contract in Tier 2 #8 (2026-03-03)
- **Configurable?** Yes — could be ENV or PluginConfig with admin UI
- **Code:** `calculateCost(model, inputTokens, outputTokens)` reads from `getModelPricing(model)`

---

## 4. VALIDATOR PLUGIN (`packages/plugins/validator/src/`)

### Model
- **Location:** `src/index.ts:33`
- **Value:** `'claude-opus-4-6'`
- **Description:** Always Opus for delegation quality checking (non-negotiable per design)
- **Configurable?** No — explicitly chosen for rubric evaluation quality

### Rubric prompt
- **Location:** `_helpers/build-rubric-prompt.ts:3-24`
- **Value:** Hard-coded 4-question rubric + VERDICT output format
- **Questions:**
  1. Does output address the task?
  2. Is output complete?
  3. Is output coherent?
  4. Would output require significant rework?
- **Configurable?** Yes — could be ENV or PluginConfig template

---

## 5. DELEGATION PLUGIN (`packages/plugins/delegation/src/`)

### Cost cap
- **Location:** `_helpers/delegation-loop.ts:18`
- **Value:** `DELEGATION_COST_CAP_USD = Number(process.env.DELEGATION_COST_CAP_USD ?? '5')`
- **Description:** Max USD spent on delegation before stopping task
- **Configurable?** YES — already ENV-backed with $5 default
- **Used:** Lines 106, 109, 111, 112, 200, 203, 205, 206

### Max iterations
- **Location:** `_helpers/delegation-loop.ts:28` and `_helpers/setup-delegation-task.ts:20`
- **Value:** `DEFAULT_MAX_ITERATIONS = 5`
- **Description:** Max attempts to refine sub-agent output before auto-accepting
- **Configurable?** Yes — currently hard-coded, could be ENV or PluginConfig
- **Used:** Line 33, setup-delegation-task.ts:25

---

## 6. CRON PLUGIN (`packages/plugins/cron/src/`)

### Timezone
- **Location:** `_helpers/cron-server.ts:63`
- **Value:** `timezone: 'UTC'`
- **Description:** All recurring cron jobs use UTC
- **Note:** Hardcoded in croner.schedule() call
- **Configurable?** Yes — could read from config.timezone or env var
- **Current:** Config has `timezone` field (default: America/Phoenix) — not being used by cron plugin

---

## 7. SUMMARIZATION PLUGIN (`packages/plugins/summarization/src/`)

### Trigger threshold
- **Location:** `src/index.ts:7`
- **Value:** `SUMMARY_TRIGGER_COUNT = 50`
- **Description:** Summarization fires when message count is exactly a multiple of 50
- **Configurable?** Yes — could be ENV or PluginConfig

### Duplicate guard timeout
- **Location:** `src/index.ts:8`
- **Value:** `DUPLICATE_GUARD_MS = 60_000` (60 seconds)
- **Description:** Prevents double-summarization within 60s window
- **Configurable?** Yes — could be ENV or PluginConfig

---

## 8. IDENTITY PLUGIN (`packages/plugins/identity/src/`)

### Soul max characters
- **Location:** `src/index.ts:14`
- **Value:** `SOUL_MAX_CHARS = 5000`
- **Description:** Truncate agent soul in prompts to 5000 chars
- **Configurable?** Yes — could be PluginConfig or env var

### Identity max characters
- **Location:** `src/index.ts:15`
- **Value:** `IDENTITY_MAX_CHARS = 2000`
- **Description:** Truncate agent identity in prompts to 2000 chars
- **Configurable?** Yes — could be PluginConfig or env var

### Memory limit
- **Location:** `src/index.ts:16`
- **Value:** `MEMORY_LIMIT = 10`
- **Description:** Retrieve top 10 memories per invocation
- **Configurable?** Yes — could be PluginConfig or env var

### Importance threshold
- **Location:** `_helpers/score-and-write-memory.ts:7`
- **Value:** `IMPORTANCE_THRESHOLD = 6` (on 1–10 scale)
- **Description:** Only persist episodic memories with importance >= 6
- **Configurable?** Yes — could be PluginConfig or env var

### Memory snippet head/tail
- **Location:** `_helpers/score-and-write-memory.ts:8-9`
- **Values:** `SNIPPET_HEAD = 250`, `SNIPPET_TAIL = 250`
- **Description:** Truncate output to head + "[...]" + tail for scoring
- **Configurable?** Yes — could be PluginConfig or env var

### Memory summary max characters
- **Location:** `_helpers/score-and-write-memory.ts:10`
- **Value:** `SUMMARY_MAX_CHARS = 1500`
- **Description:** Summarized memory capped at 1500 chars
- **Configurable?** Yes — could be PluginConfig or env var

### Reflection importance
- **Location:** `_helpers/run-reflection.ts:5`
- **Value:** `REFLECTION_IMPORTANCE = 8`
- **Description:** All synthesized reflections written with importance=8
- **Configurable?** Yes — could be PluginConfig or env var

### Reflection threshold
- **Location:** `_helpers/check-reflection-trigger.ts:3`
- **Value:** `REFLECTION_THRESHOLD = 10`
- **Description:** Fire reflection cycle when >=10 unreflected episodic memories exist
- **Configurable?** Yes — could be PluginConfig or env var

### Memory retrieval scoring constants
- **Location:** `_helpers/retrieve-memories.ts:3-7`
- **Values:**
  - `CANDIDATE_POOL = 100` — query up to 100 recent memories for scoring
  - `DECAY_RATE = 0.995` — hourly exponential decay for recency (0.995^hours)
  - `REFLECTION_BOOST = 0.3` — type boost for REFLECTION memories
  - `MIN_REFLECTION_SLOTS = 2` — guarantee 2 REFLECTION slots in top 10
- **Configurable?** Yes — all could be PluginConfig or env vars
- **Impact:** Directly affects which memories are injected into prompts

---

## Summary Table

| Plugin | Constant | Type | Env-backed? | Notes |
|--------|----------|------|-------------|-------|
| audit | take: 200 | limit | No | Message extraction cap |
| audit | 60_000ms | timeout | No | Duplicate guard |
| audit | haiku | model | No | Should default to config.claudeModel |
| auto-namer | haiku | model | No | Should default to config.claudeModel |
| auto-namer | prompt template | string | No | Hard-coded in helper |
| delegation | $5.00 | cost cap | **YES** | DELEGATION_COST_CAP_USD env |
| delegation | 5 | max iterations | No | DEFAULT_MAX_ITERATIONS |
| cron | 'UTC' | timezone | No | Should read from config.timezone |
| summarization | 50 | threshold | No | Message count multiple |
| summarization | 60_000ms | timeout | No | Duplicate guard |
| identity | 5000 | chars | No | Soul max |
| identity | 2000 | chars | No | Identity max |
| identity | 10 | limit | No | Memory limit |
| identity | 6 | threshold | No | Importance threshold |
| identity | 250/250 | snippet | No | Head/tail truncation |
| identity | 1500 | chars | No | Summary max |
| identity | 8 | importance | No | Reflection importance |
| identity | 10 | threshold | No | Reflection trigger |
| identity | 100 | pool | No | Candidate pool for scoring |
| identity | 0.995 | decay | No | Recency decay rate |
| identity | 0.3 | boost | No | Reflection boost |
| identity | 2 | slots | No | Min reflection slots |

---

## Recommendations

1. **High Priority:** Create PluginConfig schema for model names (audit, auto-namer, validator rubric template)
2. **Medium Priority:** Unify duplicate guard timeouts (audit, summarization) into ENV var
3. **Low Priority:** Consider moving memory thresholds (identity plugin) to PluginConfig for per-agent tuning
4. **Delegation:** Already ENV-backed for cost cap — consider doing same for maxIterations
5. **Cron:** Use config.timezone instead of hardcoded 'UTC'

---

## Key Files
- `packages/plugins/audit/src/index.ts` — lines 28-44, 76-80
- `packages/plugins/auto-namer/src/_helpers/generate-thread-name.ts` — lines 8-11
- `packages/plugins/validator/src/index.ts` — line 33
- `packages/plugins/delegation/src/_helpers/delegation-loop.ts` — lines 18, 28
- `packages/plugins/cron/src/_helpers/cron-server.ts` — line 63
- `packages/plugins/summarization/src/index.ts` — lines 7-8
- `packages/plugins/identity/src/index.ts` — lines 14-16
- `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` — lines 7-10
- `packages/plugins/identity/src/_helpers/retrieve-memories.ts` — lines 3-7
- `packages/plugin-contract/src/_helpers/model-pricing.ts` — shared pricing
