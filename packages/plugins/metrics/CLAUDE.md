# Metrics Plugin — Developer Notes

## Overview

The metrics plugin implements a single `onAfterInvoke` hook. It calculates cost from token counts and writes four `Metric` rows to the database. That is all it does. Read `src/index.ts`, `src/_helpers/calculate-cost.ts`, and `src/_helpers/record-usage-metrics.ts` before editing.

---

## Metric record structure

Each invocation writes exactly four rows via `db.metric.createMany()`:

| `name` | `value` | `tags` | `threadId` |
|---|---|---|---|
| `token.input` | input token count | `{ model }` | thread ID |
| `token.output` | output token count | `{ model }` | thread ID |
| `token.total` | input + output | `{ model }` | thread ID |
| `token.cost` | estimated USD | `{ model }` | thread ID |

The `tags` column contains only `{ model }`. The `threadId` is a top-level column on the `Metric` table, not a tag. Do not conflate the two.

---

## Pricing is hardcoded and must be maintained manually

`MODEL_PRICING` in `src/_helpers/calculate-cost.ts` is a static map of model name → USD per million tokens. It was current as of 2025 pricing. Anthropic changes prices; this map does not update itself.

The map contains both full model IDs (e.g., `claude-sonnet-4-20250514`) and short aliases (e.g., `sonnet`). Both must be kept in sync when prices change.

Model resolution order:
1. Exact match on the lowercased model string.
2. Partial match — iterates the map and checks if the model string contains a known key.
3. Falls back to Sonnet pricing (`{ inputPerMillion: 3, outputPerMillion: 15 }`).

The partial match is order-dependent because it iterates `Object.entries(MODEL_PRICING)`. If a model string matches multiple keys (unlikely but possible with future model names), whichever key appears first in the map wins.

The fallback to Sonnet pricing for unknown models is silent — no log, no warning. If a new model is deployed and not added to `MODEL_PRICING`, its cost records will silently use Sonnet rates. This can significantly over- or underestimate costs for Opus-class or Haiku-class models.

---

## Silent skip when result fields are missing

In `src/index.ts` at line 17:

```typescript
if (!model || inputTokens == null || outputTokens == null) {
  return;
}
```

If the `InvokeResult` is missing `model`, `inputTokens`, or `outputTokens`, the plugin returns immediately and writes nothing. There is no log message for this case. If metrics seem to be missing for some invocations, check whether the invoker SDK is populating these fields on the result.

---

## Errors are swallowed, never propagated

The entire cost calculation and DB write is wrapped in a try/catch. Errors are logged at `error` level but do not propagate to the pipeline. This means a broken metrics plugin will never crash or stall the orchestrator.

The consequence: if the DB write fails repeatedly (e.g., schema mismatch after a migration, connection error), the pipeline continues silently and the delegation plugin's cost cap enforcement stops working. Check logs if cost caps appear to be ignored.

---

## Impact on delegation cost caps

The delegation plugin queries `Metric` rows to enforce per-task cost limits. If the metrics plugin fails silently — whether due to a missing result field, a pricing error, or a DB failure — no metric rows are written, and delegation will behave as if zero cost has been incurred. Cost caps will not trigger. This is a silent correctness failure, not a crash.

---

## No aggregation

The plugin writes raw event records. There is no rollup, no summary, no deduplication. If a thread runs 100 invocations, there will be 400 `Metric` rows for that thread. Aggregation is left to query time.
