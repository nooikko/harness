# MCP Tool Schema + Session Pool Fix

**Date:** 2026-02-27
**Status:** Approved

## Problem

Two bugs were identified via RCA after `harness__time__current_time` tool calls failed silently in Claude's subprocess.

### Bug 1: MCP Tool `inputSchema` Crashes on Tool Call

**File:** `apps/orchestrator/src/tool-server/index.ts:41`

The `createToolServer` function passes the plugin's `PluginTool.schema` (a plain JSON Schema object) directly as the `inputSchema` for `SdkMcpToolDefinition`. The SDK type expects a Zod raw shape (`AnyZodRawShape`), and at tool call time it attempts to call `.safeParseAsync()` on the plain object — which throws a `TypeError`. The error is caught internally by the SDK's `McpServer` and returned to Claude as an `isError: true` tool response. Claude sees a tool error; nothing appears in orchestrator logs.

The comment in the file states "plain JSON Schema objects work correctly at runtime" — this is true only for tool *listing* (the SDK falls back to an empty schema `lR` for display). It is false for tool *execution* (the validation path tries Zod methods on the object).

The original `plugin-tool-registration-design.md` correctly specified JSON Schema in the plugin contract as the public API. The fix belongs at the adapter boundary, not in the contract.

### Bug 2: Session Pool Key Mismatch — Pool Never Hits

**File:** `apps/orchestrator/src/invoker-sdk/index.ts:55`

```typescript
const threadId = options?.sessionId ?? 'default';  // uses Claude session ID
```

The pool is keyed by `options.sessionId`, which is the **Claude session ID** stored in `thread.sessionId` (e.g. `"c631e231-15d9-418c-b0c6-a8a0bf95a946"`). After every invocation the SDK returns a new session ID; the orchestrator updates the DB; the next message arrives with the new ID as pool key → cache miss → new subprocess.

Meanwhile, `POST /api/prewarm` in `packages/plugins/web/src/_helpers/routes.ts:84` calls `prewarm({ sessionId: body.threadId })` — using the **harness thread ID** (e.g. `"cmlzx4p9900009yoab67f3l4i"`). The variable in invoker-sdk is even named `threadId` but reads `options.sessionId` — a clear wiring mistake.

**Combined effect:**
- Pre-warm creates pool entry under harness thread ID.
- Invoke looks up by Claude session ID. Always misses.
- Every message gets a cold subprocess.
- Context plugin skips history injection when `thread.sessionId` is non-null (assumes session is warm). Because the subprocess is always fresh, Claude has no conversation history from message 2 onwards.

**Adversarial validation:** Confirmed by reading all three files. `prewarm` in `routes.ts:84` passes `body.threadId`; `invoke` in `invoker-sdk/index.ts:55` reads `options.sessionId`. They are different values and can never match.

---

## Design

### Fix 1: JSON Schema → Zod Shape Conversion

Add a `jsonSchemaToZodShape` helper to `tool-server/index.ts`. Replace the type cast with a proper conversion at the adapter boundary. The plugin contract (`PluginTool.schema: Record<string, unknown>`) remains unchanged.

**Mapping rules:**

| JSON Schema `type` | Zod type |
|--------------------|----------|
| `"string"` | `z.string()` |
| `"number"` | `z.number()` |
| `"integer"` | `z.number().int()` |
| `"boolean"` | `z.boolean()` |
| anything else / absent | `z.unknown()` |

Optional fields (not in `schema.required[]`) get `.optional()`. An empty or absent `properties` object produces `{}` (empty Zod shape → SDK creates `z.object({})` → validation accepts `{}` → handler receives `{}`).

This covers all current plugin tools and is safe for future plugins. Full JSON Schema (nested objects, arrays, enums) is out of scope for this fix but can be added to the same function later.

**Files changed:** `apps/orchestrator/src/tool-server/index.ts` only.

### Fix 2: Session Pool Key

Add `threadId?: string` to `InvokeOptions` in the plugin contract. Pass it from `handleMessage`. Use it as the pool key with a fallback chain.

**`InvokeOptions` change (additive, non-breaking):**
```typescript
type InvokeOptions = {
  model?: string;
  sessionId?: string;
  threadId?: string;   // NEW — harness thread ID, used as session pool key
  timeout?: number;
  onMessage?: ...;
};
```

**`handleMessage` change:**
```typescript
deps.invoker.invoke(prompt, { model, sessionId, threadId, onMessage: ... })
```
`threadId` is the harness thread ID already in scope at that call site.

**`invoker-sdk/index.ts` change:**
```typescript
const poolKey = options?.threadId ?? options?.sessionId ?? 'default';
const session = pool.get(poolKey, model);
// ...
pool.evict(poolKey);  // on error
```

**Effect:** Pool key is now `"cmlzx4p9900009yoab67f3l4i"` (stable across all messages). Pre-warm creates a session under the same key. Every message in the thread hits the warm session (within the 8-minute TTL). Context plugin's history-skip is now correct.

**No change needed** in `packages/plugins/web/src/_helpers/routes.ts` — it already passes `body.threadId` to `prewarm`, which is now the correct key.

---

## Testing

### `tool-server` unit tests
- `jsonSchemaToZodShape` with each primitive type
- Required vs optional field handling
- Empty `properties` → empty Zod shape
- Missing `properties` → empty Zod shape
- Unknown type → `z.unknown()`

### `invoker-sdk` unit tests
- Pool uses `options.threadId` when provided
- Pool falls back to `options.sessionId` when `threadId` absent
- Pool falls back to `'default'` when both absent
- `pool.evict` called with correct key on error

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plugin-contract/src/index.ts` | Add `threadId?: string` to `InvokeOptions` |
| `apps/orchestrator/src/orchestrator/index.ts` | Pass `threadId` in invoke call |
| `apps/orchestrator/src/invoker-sdk/index.ts` | Use `threadId` as pool key |
| `apps/orchestrator/src/tool-server/index.ts` | Add `jsonSchemaToZodShape`, replace type cast |
| `apps/orchestrator/src/tool-server/__tests__/index.test.ts` | New tests for schema conversion |
| `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts` | New/updated tests for pool key logic |

---

## Out of Scope

- Full JSON Schema conversion (nested objects, arrays, enums, `$ref`) — noted as future work
- SDK session resumption via `resume` option in `query()` — separate concern
- Context plugin history-injection correctness on TTL eviction — pre-existing edge case, unchanged
