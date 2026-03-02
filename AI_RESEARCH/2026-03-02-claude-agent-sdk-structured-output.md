# Research: @anthropic-ai/claude-agent-sdk Structured Output / Schema Return
Date: 2026-03-02

## Summary

The `@anthropic-ai/claude-agent-sdk` (v0.2.63 as of Feb 28, 2026) supports structured output
via the `outputFormat` option on `query()`. You pass a JSON Schema via
`{ type: "json_schema", schema: <JSONSchema> }` and the result message includes a
`structured_output` field containing validated data matching that schema. The SDK
retries schema validation internally; if retries are exhausted the result subtype is
`error_max_structured_output_retries`.

## Prior Research

No prior research on this specific topic in AI_RESEARCH/.

## Current Findings

---

### 1. The `outputFormat` Parameter — Full Type

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

The `outputFormat` option lives inside the `Options` type passed to `query()`:

```typescript
// From the Options type table:
outputFormat?: { type: 'json_schema'; schema: JSONSchema }
```

- `type` must be the string literal `"json_schema"` (the only supported value)
- `schema` is a standard JSON Schema object (draft version unspecified, but standard
  keywords like `type`, `properties`, `required`, `enum`, `$ref` are supported)
- The field is optional — omitting it gives you free-form text in `result.result`

---

### 2. Full `query()` Function Signature

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

The `Options` type (relevant subset — full type has ~40 fields):

```typescript
type Options = {
  // --- Schema / structured output ---
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };

  // --- Model / execution ---
  model?: string;
  maxTurns?: number;
  effort?: 'low' | 'medium' | 'high' | 'max';
  thinking?: ThinkingConfig;
  maxBudgetUsd?: number;

  // --- Session ---
  resume?: string;              // session ID to resume
  sessionId?: string;           // force a specific UUID
  forkSession?: boolean;
  persistSession?: boolean;     // default true
  continue?: boolean;

  // --- Permissions ---
  permissionMode?: PermissionMode;
  allowDangerouslySkipPermissions?: boolean;
  canUseTool?: CanUseTool;

  // --- Tools / MCP ---
  allowedTools?: string[];
  disallowedTools?: string[];
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
  mcpServers?: Record<string, McpServerConfig>;

  // --- Environment ---
  cwd?: string;
  env?: Record<string, string | undefined>;
  abortController?: AbortController;

  // --- Settings ---
  settingSources?: SettingSource[];   // default [] = no filesystem settings loaded
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };

  // --- Output ---
  includePartialMessages?: boolean;
  promptSuggestions?: boolean;

  // ... (sandbox, hooks, agents, plugins, etc.)
};
```

The `Query` return type is:

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  close(): void;
  // ... (rewindFiles, setPermissionMode, setModel, etc.)
}
```

---

### 3. How Structured Output Works — Mechanism

Source: https://platform.claude.com/docs/en/agent-sdk/structured-outputs

1. Caller passes `outputFormat: { type: "json_schema", schema: mySchema }` in `query()` options.
2. The agent runs normally — it can use any tools during execution (Grep, Bash, web search, etc.).
3. At the end of the agentic loop, the SDK instructs the model to produce output matching the schema.
4. The SDK validates the output against the schema.
5. If validation fails, the SDK retries internally (number of retries is not documented).
6. On success: the `SDKResultMessage` has `subtype: "success"` and `structured_output` populated.
7. On retry exhaustion: `subtype: "error_max_structured_output_retries"` (no `structured_output`).

The `result` field (plain text string) is ALSO still populated alongside `structured_output`
when the output is structured. The two are not mutually exclusive.

---

### 4. The `SDKResultMessage` Type — With and Without Schema

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

**Success (with or without schema):**
```typescript
{
  type: "result";
  subtype: "success";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;                   // Always present: plain-text output
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;      // Only present when outputFormat was used AND succeeded
}
```

**Structured output failure:**
```typescript
{
  type: "result";
  subtype: "error_max_structured_output_retries";
  // ... same base fields ...
  errors: string[];                 // No structured_output field
  // No result field (only present on success subtype)
}
```

**Other error subtypes** (not schema-specific):
- `error_max_turns`
- `error_during_execution`
- `error_max_budget_usd`

---

### 5. Code Examples — Official Documentation

**Basic JSON Schema (plain object):**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const schema = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    founded_year: { type: "number" },
    headquarters: { type: "string" }
  },
  required: ["company_name"]
};

for await (const message of query({
  prompt: "Research Anthropic and provide key company information",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: schema
    }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    console.log(message.structured_output);
    // { company_name: "Anthropic", founded_year: 2021, headquarters: "San Francisco, CA" }
  }
}
```

**Type-safe with Zod:**
```typescript
import { z } from "zod";
import { query } from "@anthropic-ai/claude-agent-sdk";

const FeaturePlan = z.object({
  feature_name: z.string(),
  summary: z.string(),
  steps: z.array(z.object({
    step_number: z.number(),
    description: z.string(),
    estimated_complexity: z.enum(["low", "medium", "high"])
  })),
  risks: z.array(z.string())
});

type FeaturePlan = z.infer<typeof FeaturePlan>;

const schema = z.toJSONSchema(FeaturePlan);

for await (const message of query({
  prompt: "Plan how to add dark mode support to a React app",
  options: {
    outputFormat: { type: "json_schema", schema }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    const parsed = FeaturePlan.safeParse(message.structured_output);
    if (parsed.success) {
      const plan: FeaturePlan = parsed.data;
      console.log(plan.feature_name);
    }
  }
}
```

**Error handling pattern:**
```typescript
for await (const msg of query({
  prompt: "Extract contact info",
  options: { outputFormat: { type: "json_schema", schema: contactSchema } }
})) {
  if (msg.type === "result") {
    if (msg.subtype === "success" && msg.structured_output) {
      console.log(msg.structured_output);
    } else if (msg.subtype === "error_max_structured_output_retries") {
      console.error("Could not produce valid output:", msg.errors);
    }
  }
}
```

---

### 6. When to Use Schema vs. Not

Source: https://platform.claude.com/docs/en/agent-sdk/structured-outputs

**Use structured output when:**
- You need to use the agent's output programmatically (pass to DB, UI, other code)
- You need typed data you can iterate over (arrays of objects)
- You want to avoid parsing free-form text
- The agent needs to do multi-step tool use (web search, code analysis) before returning
  structured data — unlike the Messages API, the agent can USE tools AND return structured output

**Do NOT use structured output (or expect failures) when:**
- Schema is deeply nested with many required fields — harder for the model to satisfy
- Task is ambiguous or may not yield all required data (use optional fields instead)
- Prompt is unclear about what output format is expected
- You only need conversational/narrative output

**Practical tips from docs:**
- Start with simple schemas, add complexity incrementally
- Make fields optional if the task might not surface all data
- Clear, specific prompts reduce validation retry rates

---

### 7. JSON Schema Feature Support

Source: https://platform.claude.com/docs/en/agent-sdk/structured-outputs

Supported:
- All basic types: `object`, `array`, `string`, `number`, `boolean`, `null`
- `enum`
- `const`
- `required` arrays
- Nested objects
- `$ref` definitions

For the full list of supported features and limitations, the docs reference:
https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations

---

### 8. Harness Project — Current Usage

File: `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`

The current session pool implementation calls `query()` with:

```typescript
const q = query({
  prompt: messageStream(),   // AsyncIterable<SDKUserMessage> for session keep-alive
  options: {
    model,
    cwd: os.tmpdir(),
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    env,
    ...(config?.mcpServerFactory ? { mcpServers: config.mcpServerFactory() } : {}),
  },
});
```

**Key observation:** `outputFormat` is NOT currently passed to `query()`. The invoker
uses the streaming async-iterable pattern (multi-turn warm sessions). This is important:

- Structured output (`outputFormat`) is a **per-query option** on `query()`
- The harness session model uses one long-lived `query()` call with many messages
  yielded into it via `messageStream()`
- To use `outputFormat`, you would need to pass it at session creation time, making
  the ENTIRE session produce structured output for every turn — which is not the
  intended use case

**Implication:** To support structured output in harness, you would need either:
1. A separate one-shot `query()` call (not using the warm session pool) with
   `outputFormat` specified
2. Or a new session pool variant that creates sessions with `outputFormat` configured
   (binding schema to the entire session lifetime)

Option 1 is simpler and matches how the official docs show structured output being used.

---

### 9. V2 API (Unstable Preview)

Source: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview

A V2 interface exists as `unstable_v2_createSession()`, `unstable_v2_resumeSession()`,
and `unstable_v2_prompt()`. The V2 API uses `send()` + `stream()` instead of async
generator iteration.

The V2 docs do NOT show `outputFormat` support. V2 is explicitly `unstable` (APIs may
change). The docs warn that some V1 features (session forking) are not yet in V2.

**Recommendation:** Use V1 `query()` with `outputFormat` for structured output. V2 is
not suitable for production use.

---

## Key Takeaways

1. **The option name is `outputFormat`** (camelCase in TypeScript), not `output_schema`
   or `schema`. Python uses `output_format` (snake_case).

2. **Type is always `"json_schema"`** — there is only one supported type value.

3. **`structured_output` is typed as `unknown`** in the SDK — you must narrow/validate
   it yourself (Zod `safeParse` is the recommended approach).

4. **The agent still uses tools before outputting structure** — this is the key
   differentiator from the Anthropic Messages API structured outputs, which are
   single-turn only.

5. **Failure is a distinct result subtype** (`error_max_structured_output_retries`),
   not a thrown error. Always check `msg.subtype` before accessing `structured_output`.

6. **Harness's warm session pool is NOT compatible** with per-invocation structured
   output because `outputFormat` is set at `query()` creation time, not per `send()`.
   Structured output would require a separate one-shot `query()` call.

## Sources

- TypeScript SDK Reference: https://platform.claude.com/docs/en/agent-sdk/typescript
- Structured Outputs Guide: https://platform.claude.com/docs/en/agent-sdk/structured-outputs
- TypeScript V2 Preview: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
- SDK npm package: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- GitHub: https://github.com/anthropics/claude-agent-sdk-typescript (v0.2.63, Feb 28 2026)
- Local implementation:
  - `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/index.ts`
  - `/Users/quinn/dev/harness/apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`
