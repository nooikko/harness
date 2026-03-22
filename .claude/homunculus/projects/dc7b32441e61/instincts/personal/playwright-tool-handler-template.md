---
id: playwright-tool-handler-template
trigger: when implementing new Playwright plugin tool handlers in src/_helpers/
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Playwright Tool Handler Template Pattern

## Action
When creating new Playwright tool handler files, follow the established template structure: type definition → handler function with (ctx, input, meta) signature → getPage(meta.threadId) retrieval → try-catch wrapping Playwright operations → return error string on exception.

## Evidence
- Observed 8 times in session 361dcce6-c30d-4ae6-be23-6355b02f2a0f (2026-03-17T15:51:26Z onwards)
- Files created: navigate.ts, snapshot.ts, click.ts, fill.ts, select-option.ts, check.ts, screenshot.ts, press-key.ts
- Consistent structure across all handlers:
  1. Type alias `type HandlerName = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;`
  2. Export async handler implementing the type
  3. Early getPage(meta.threadId) call
  4. Try-catch block wrapping all Playwright operations
  5. Returns descriptive success or error string (never throws)
- Pattern never deviated across 8 implementations
- Last observed: 2026-03-17T15:51:49Z

## Template
```typescript
import type { PluginContext, PluginToolMeta } from "@harness/plugin-contract";
import { getPage } from "./browser-manager";

type HandlerName = (
  ctx: PluginContext,
  input: Record<string, unknown>,
  meta: PluginToolMeta,
) => Promise<string>;

export const handlerName: HandlerName = async (_ctx, input, meta) => {
  // 1. Validate required inputs here
  const requiredParam = input.requiredParam as string | undefined;
  if (!requiredParam || typeof requiredParam !== "string") {
    return "Error: requiredParam is required.";
  }

  // 2. Get page for this thread
  const page = await getPage(meta.threadId);

  // 3. Wrap Playwright operations in try-catch
  try {
    // Your Playwright operations here
    return "Success message describing what was done";
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
};
```

## Why
All Playwright handlers need consistent error handling (never throw, always return string), thread isolation (meta.threadId), and proper page lifecycle management. The template ensures handlers are composable and testable.
