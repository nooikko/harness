---
id: haiku-zod-structured-output-validation
trigger: when calling Haiku to produce structured JSON output (scoring, summarization, synthesis, classification)
confidence: 0.75
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Haiku + Zod Structured Output Validation

## Action
When invoking Haiku for structured outputs, define a Zod schema alongside the invocation, parse responses with `extractJson()` helper, and validate using the schema before processing results.

## Evidence
- Observed 3 instances in single session (2026-03-18)
- Pattern: Every Haiku call that expects JSON is paired with `z.object()` schema definition
  - `score-and-write-memory.ts`: ImportanceSchema for 1-10 rating + SummarySchema for summarization
  - `run-reflection.ts`: InsightsSchema for insight extraction
- Consistent error handling: catch JSON parsing failures, log warnings, fallback gracefully
- Last observed: 2026-03-18

## Implementation Details

For each Haiku JSON output:
1. Define Zod schema at module level (e.g., `const ImportanceSchema = z.object(...)`)
2. Craft prompt to explicitly request JSON output
3. Use `extractJson()` helper to isolate JSON from potential prose/fences
4. Parse with schema: `SchemaType.parse(JSON.parse(extractJson(result.output)))`
5. Catch and log any parse failures; never throw to caller
6. Provide sensible fallback when validation fails

## Why
Haiku sometimes includes explanatory prose around JSON or wraps responses in code fences. This pattern ensures reliable, validated extraction regardless of format variations. Zod provides both runtime validation and type safety for downstream consumption.
