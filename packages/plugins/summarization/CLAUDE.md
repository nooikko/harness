# Summarization Plugin — Developer Notes

## Overview

Single-hook plugin. Implements `onAfterInvoke`. Read `src/index.ts`, `src/_helpers/count-thread-messages.ts`, and `src/_helpers/generate-summary.ts` before editing.

---

## Trigger logic

```typescript
if (count > 0 && count % SUMMARY_TRIGGER_COUNT === 0) {
  void summarizeInBackground(ctx, threadId, count);
}
```

`SUMMARY_TRIGGER_COUNT = 50`. The modulo check means the trigger fires at exactly 50, 100, 150, … messages. It does NOT fire on every invocation — only at those thresholds.

The `count` passed to `summarizeInBackground` is the total message count at trigger time, used as `coverageMessageCount` in metadata. It is a snapshot — the actual summary may cover more or fewer messages if messages arrive concurrently.

---

## Duplicate guard

Before invoking Claude, the plugin checks:
```typescript
const recentSummary = await ctx.db.message.findFirst({
  where: { threadId, kind: 'summary' },
  orderBy: { createdAt: 'desc' },
});
if (recentSummary && Date.now() - recentSummary.createdAt.getTime() < DUPLICATE_GUARD_MS) {
  return;
}
```

`DUPLICATE_GUARD_MS = 60_000`. This prevents double-summarization if two pipeline runs both hit a threshold count near-simultaneously (e.g., rapid consecutive messages). If the guard is too short and summaries are duplicated, increase `DUPLICATE_GUARD_MS`.

---

## Error handling

The entire background task is wrapped in try/catch. Errors are logged at `warn` level and swallowed. A failed summary does not affect the pipeline.

If summaries stop appearing in long threads, check:
1. Whether `onAfterInvoke` is firing (look for other plugin onAfterInvoke logs)
2. Whether `countThreadMessages` is returning the expected count
3. Whether `generateSummary` is throwing (check logs for `'summarization failed'`)

---

## Interaction with the context plugin

The context plugin (`@harness/plugin-context`) checks for existing summaries when building prompts. The summarization plugin writes the records; the context plugin decides whether to use them. These plugins are deliberately decoupled — summarization does not know about context, and context does not trigger summarization.

---

## Model

`generate-summary.ts` hardcodes `claude-haiku-4-5-20251001`. Summarization is a low-complexity task that does not benefit from larger models. Do not change this to Sonnet or Opus without a clear reason — it will meaningfully increase costs for every long-running thread.
