---
id: playwright-operation-error-handling
trigger: when wrapping Playwright browser operations in error handlers
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Playwright Operations Use Consistent Error Handling

## Action
All Playwright browser operations must be wrapped in try-catch blocks that return error messages as strings, never throw exceptions. Use the pattern `err instanceof Error ? err.message : String(err)` for error message extraction.

## Evidence
- Observed 8 times across handlers in session 361dcce6-c30d-4ae6-be23-6355b02f2a0f
- Files: navigate.ts, snapshot.ts, click.ts, fill.ts, select-option.ts, check.ts, screenshot.ts, press-key.ts
- All handlers wrap Playwright calls (page.goto, page.click, page.fill, etc.) in identical try-catch pattern
- Error message format consistent: `` Error <operation> ${param}: ${err instanceof Error ? err.message : String(err)} ``
- All handlers return error string immediately without rethrowing
- Pattern never deviated across 8 implementations
- Last observed: 2026-03-17T15:51:49Z

## Implementation Pattern

### Standard Try-Catch
```typescript
try {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  // Process response...
  return `Success: ${result}`;
} catch (err) {
  return `Error navigating to ${url}: ${err instanceof Error ? err.message : String(err)}`;
}
```

### With Timeout Handling
```typescript
try {
  await page.click(selector, { timeout: 10_000 });
  return `Clicked: ${selector}`;
} catch (err) {
  return `Error clicking "${selector}": ${err instanceof Error ? err.message : String(err)}`;
}
```

### Complex Operations
```typescript
try {
  const tree = await page.accessibility.snapshot();
  if (!tree) {
    return "(empty accessibility tree — page may not have loaded)";
  }
  return formatAccessibilityTree(tree, 0);
} catch (err) {
  return `Error taking snapshot: ${err instanceof Error ? err.message : String(err)}`;
}
```

## Why
Playwright operations are async and network-dependent. Try-catch ensures exceptions don't crash the handler. Returning error strings allows callers (orchestrator/agent) to handle failures gracefully without promise rejection. The `err instanceof Error` check handles both Error objects and non-Error exceptions.
