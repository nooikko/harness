# Rich Activity Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `kind` and `source` fields to the Message model so the database captures everything the agent does (thinking, tool calls, pipeline steps) — not just text — and render each kind with appropriate UI.

**Architecture:** Extend the Message schema with `kind` and `source`. The orchestrator collects pipeline steps in `HandleMessageResult` and SDK stream events via `onMessage` callback — all persistence happens in `sendToThread` (never in `handleMessage`). The frontend routes rendering through `MessageItem` based on `kind` using dedicated components per type that share a `CollapsibleBlock` abstraction.

**Tech Stack:** Prisma 6 (PostgreSQL), Node.js orchestrator, Anthropic Claude Agent SDK (streaming events), Next.js 16 App Router (React Server Components), Tailwind CSS 4, Vitest

---

## Design Decisions (from discussion with user)

| Field | Purpose | Values |
|-------|---------|--------|
| `kind` | Structural type — what it is | `"text"`, `"thinking"`, `"tool_call"`, `"tool_result"`, `"pipeline_step"`, `"status"` |
| `source` | Origin — who made it (queryable, indexed) | `"builtin"` (core/Claude tools), `"pipeline"` (orchestrator steps), or plugin name (`"time"`, `"delegation"`, etc.) |
| `content` | Always plain text — the universal fallback renderer | Text content, thinking text, tool description, tool output, step label, status description |
| `metadata` | Kind-specific structured data | `{ toolName, toolUseId, input }` for tool_call; `{ toolUseId, success, durationMs }` for tool_result; `{ step, detail }` for pipeline_step; `{ event, durationMs, inputTokens, outputTokens }` for status |

**Renderer lookup:** `metadata.toolName` determines specific renderers. Core tools (Read, Bash, Write) get built-in renderers. Plugin tools (`timePlugin__getTime`) get plugin-registered renderers. Unknown tools fall back to the default renderer for that `kind`. Plugin disabled? Query `WHERE source = 'x'`, skip custom renderer, fall back to default.

**Persistence ownership:** ALL `db.message.create` calls live in `sendToThread`. `handleMessage` is side-effect-free w.r.t. the database — it returns data for `sendToThread` to persist.

---

### Task 1: Add `kind` and `source` fields to Message schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma:58-69`

**Step 1: Write the schema change**

Update the Message model in `packages/database/prisma/schema.prisma`:

```prisma
model Message {
  id        String   @id @default(cuid())
  threadId  String
  thread    Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String
  kind      String   @default("text")
  source    String   @default("builtin")
  content   String   @db.Text
  model     String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([threadId, createdAt])
  @@index([threadId, kind])
  @@index([threadId, source])
}
```

**Step 2: Generate the migration**

Run: `pnpm --filter database db:migrate -- --name add-message-kind-source`

Expected: Creates a migration file in `packages/database/prisma/migrations/` that ALTERs the Message table to add `kind` and `source` columns with defaults.

**Step 3: Regenerate Prisma client**

Run: `pnpm db:generate`

Expected: Prisma client regenerated with new `kind` and `source` fields on Message type.

**Step 4: Verify types compile**

Run: `pnpm typecheck`

Expected: PASS — existing code uses `kind` and `source` with defaults, no breaking changes.

**Step 5: Commit**

```
feat(database): add kind and source fields to Message model

kind: structural type (text, thinking, tool_call, tool_result, pipeline_step, status)
source: origin (builtin, pipeline, or plugin name)
Both have defaults for backward compatibility with existing rows.
```

---

### Task 2: Extend `mapStreamEvent` to emit per-block events

**Context:** `mapStreamEvent` currently maps one SDK message to one `InvokeStreamEvent`, ignoring thinking blocks and only capturing the first tool name. Instead of creating a parallel `collectStreamEvents` helper that re-parses the same `raw` data, we extend `mapStreamEvent` to return `InvokeStreamEvent[]` — one event per content block — and update `InvokeStreamEvent` to carry `toolUseId` and `toolInput`.

**Files:**
- Modify: `packages/plugin-contract/src/index.ts` (extend `InvokeStreamEvent` type)
- Modify: `apps/orchestrator/src/invoker-sdk/_helpers/map-stream-event.ts`
- Modify: `apps/orchestrator/src/invoker-sdk/index.ts` (iterate array from mapStreamEvent)
- Test: `apps/orchestrator/src/invoker-sdk/_helpers/__tests__/map-stream-event.test.ts`

**Step 1: Extend `InvokeStreamEvent` in plugin-contract**

In `packages/plugin-contract/src/index.ts`, add optional fields to `InvokeStreamEvent`:

```ts
export type InvokeStreamEvent = {
  type: string;
  content?: string;
  toolName?: string;
  toolUseId?: string;   // new: id from tool_use block
  toolInput?: unknown;  // new: input from tool_use block
  timestamp: number;
  raw?: unknown;
};
```

**Step 2: Write the failing tests**

In `apps/orchestrator/src/invoker-sdk/_helpers/__tests__/map-stream-event.test.ts`, add:

```ts
it("emits a thinking event for thinking blocks", () => {
  const sdkMessage = {
    type: "assistant",
    message: {
      content: [{ type: "thinking", thinking: "Let me analyze this" }],
    },
  };

  const events = mapStreamEvent(sdkMessage);

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "thinking",
    content: "Let me analyze this",
  });
});

it("emits a tool_call event with id and input for tool_use blocks", () => {
  const sdkMessage = {
    type: "assistant",
    message: {
      content: [
        { type: "tool_use", name: "Read", id: "tu_1", input: { file_path: "/etc/hosts" } },
      ],
    },
  };

  const events = mapStreamEvent(sdkMessage);

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "tool_call",
    content: "Read",
    toolName: "Read",
    toolUseId: "tu_1",
    toolInput: { file_path: "/etc/hosts" },
  });
});

it("emits one event per content block for mixed assistant messages", () => {
  const sdkMessage = {
    type: "assistant",
    message: {
      content: [
        { type: "thinking", thinking: "Analyzing..." },
        { type: "tool_use", name: "Bash", id: "tu_2", input: { command: "ls" } },
        { type: "text", text: "Done" },
      ],
    },
  };

  const events = mapStreamEvent(sdkMessage);

  expect(events).toHaveLength(3);
  expect(events[0]!.type).toBe("thinking");
  expect(events[1]!.type).toBe("tool_call");
  expect(events[2]!.type).toBe("assistant");
});

it("returns empty array for unrecognized message types", () => {
  const events = mapStreamEvent({ type: "unknown_future_type" });
  expect(events).toEqual([]);
});
```

Run: `pnpm --filter orchestrator test -- --run map-stream-event`

Expected: FAIL (return type mismatch + missing event types)

**Step 3: Update `mapStreamEvent` implementation**

Rewrite `apps/orchestrator/src/invoker-sdk/_helpers/map-stream-event.ts` to return `InvokeStreamEvent[]`:

```ts
import type { InvokeStreamEvent } from "@harness/plugin-contract";

type ContentBlock = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: unknown;
};

type RawAssistant = {
  type: "assistant";
  message?: { content?: ContentBlock[] };
};

type RawToolSummary = {
  type: "tool_use_summary";
  summary?: string;
  preceding_tool_use_ids?: string[];
};

type MapStreamEvent = (message: unknown) => InvokeStreamEvent[];

export const mapStreamEvent: MapStreamEvent = (message) => {
  const msg = message as { type?: string };
  const timestamp = Date.now();

  if (msg.type === "assistant") {
    const raw = msg as RawAssistant;
    const blocks = raw.message?.content ?? [];
    const events: InvokeStreamEvent[] = [];

    for (const block of blocks) {
      if (block.type === "thinking" && block.thinking) {
        events.push({ type: "thinking", content: block.thinking, timestamp, raw: message });
      } else if (block.type === "tool_use" && block.name) {
        events.push({
          type: "tool_call",
          content: block.name,
          toolName: block.name,
          toolUseId: block.id,
          toolInput: block.input,
          timestamp,
          raw: message,
        });
      } else if (block.type === "text" && block.text) {
        events.push({ type: "assistant", content: block.text, timestamp, raw: message });
      }
    }

    return events;
  }

  if (msg.type === "tool_progress") {
    return [{ type: "tool_progress", content: (msg as { content?: string }).content, timestamp, raw: message }];
  }

  if (msg.type === "tool_use_summary") {
    const raw = msg as RawToolSummary;
    const toolUseId = raw.preceding_tool_use_ids?.[0];
    return [{
      type: "tool_use_summary",
      content: raw.summary,
      toolUseId,
      timestamp,
      raw: message,
    }];
  }

  return [];
};
```

**Step 4: Update invoker-sdk to iterate array**

In `apps/orchestrator/src/invoker-sdk/index.ts`, update the `onMessage` wiring:

```ts
const sendOptions = options?.onMessage
  ? {
      onMessage: (sdkMessage: Parameters<typeof mapStreamEvent>[0]) => {
        for (const event of mapStreamEvent(sdkMessage)) {
          options.onMessage!(event);
        }
      },
    }
  : undefined;
```

**Step 5: Run tests — PASS**

Run: `pnpm --filter orchestrator test -- --run map-stream-event`

Expected: PASS

**Step 6: Commit**

```
feat(orchestrator): extend mapStreamEvent to emit per-block events with thinking and tool_use details
```

---

### Task 3: Add pipeline steps to HandleMessageResult and persist everything in sendToThread

**Context:** The plan previously put `db.message.create` calls inside `handleMessage` for pipeline steps, violating the rule that `handleMessage` is side-effect-free w.r.t. the DB. Instead: `handleMessage` records which steps were executed in its return value, and `sendToThread` persists them along with everything else.

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/index.ts`
- Test: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

**Step 1: Write the failing tests**

Add to the `handleMessage` describe block:

```ts
it("returns pipelineSteps in result with step labels and timestamps", async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);

  const result = await orchestrator.handleMessage("thread-1", "user", "hello");

  expect(result).toHaveProperty("pipelineSteps");
  expect(Array.isArray(result.pipelineSteps)).toBe(true);
  expect(result.pipelineSteps.length).toBeGreaterThanOrEqual(4);
  expect(result.pipelineSteps[0]).toMatchObject({
    step: "onMessage",
    content: "Processing message",
  });
  expect(typeof result.pipelineSteps[0]!.timestamp).toBe("number");
});

it("does not call db.message.create inside handleMessage", async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);

  await orchestrator.handleMessage("thread-1", "user", "hello");

  expect(deps.db.message.create).not.toHaveBeenCalled();
});
```

Add to the `sendToThread` describe block:

```ts
it("persists pipeline_step messages using steps from handleMessage result", async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);
  const context = orchestrator.getContext();

  await context.sendToThread("thread-1", "hello");

  const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
  const pipelineSteps = createCalls.filter(
    (c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === "pipeline_step"
  );

  expect(pipelineSteps.length).toBeGreaterThanOrEqual(4);
  expect(pipelineSteps[0]![0]).toMatchObject({
    data: {
      threadId: "thread-1",
      role: "system",
      kind: "pipeline_step",
      source: "pipeline",
      metadata: { step: "onMessage" },
    },
  });
});

it("persists status bookend messages in sendToThread", async () => {
  const invokeResult = makeInvokeResult({ durationMs: 200, inputTokens: 100, outputTokens: 50 });
  const deps = makeDeps({
    invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
  });
  const orchestrator = createOrchestrator(deps);
  const context = orchestrator.getContext();

  await context.sendToThread("thread-1", "hello");

  const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
  const statusMessages = createCalls.filter(
    (c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === "status"
  );

  expect(statusMessages).toHaveLength(2);
  expect(statusMessages[0]![0]).toMatchObject({
    data: { kind: "status", source: "pipeline", metadata: { event: "pipeline_start" } },
  });
  expect(statusMessages[1]![0]).toMatchObject({
    data: {
      kind: "status",
      source: "pipeline",
      metadata: expect.objectContaining({ event: "pipeline_complete", durationMs: 200 }),
    },
  });
});
```

Run: `pnpm --filter orchestrator test -- --run orchestrator`

Expected: FAIL

**Step 2: Update `HandleMessageResult` type**

In `apps/orchestrator/src/orchestrator/index.ts`, add `pipelineSteps` to the return type:

```ts
type PipelineStep = {
  step: string;
  content: string;
  timestamp: number;
};

export type HandleMessageResult = {
  invokeResult: InvokeResult;
  prompt: string;
  commandsHandled: string[];
  streamEvents: InvokeStreamEvent[];
  pipelineSteps: PipelineStep[];
};
```

**Step 3: Collect pipeline steps inside `handleMessage`**

At the top of `handleMessage` (after thread lookup), add:

```ts
const pipelineSteps: PipelineStep[] = [];
```

At each existing broadcast point, push to the array **before** the broadcast:

```ts
pipelineSteps.push({ step: "onMessage", content: "Processing message", timestamp: Date.now() });
await context.broadcast("pipeline:step", { threadId, step: "onMessage", timestamp: Date.now() });
```

Step labels for each broadcast point:
- `onMessage` → `"Processing message"`
- `onBeforeInvoke` → `"Assembling context"`
- `invoking` → `"Calling Claude"`
- `onAfterInvoke` → `"Processing response"`

Add `pipelineSteps` to the return:

```ts
return { invokeResult, prompt, commandsHandled, streamEvents, pipelineSteps };
```

**Step 4: Persist everything in `sendToThread`**

In `sendToThread`, after `handleMessage` returns:

```ts
const startedAt = Date.now();

// Persist pipeline start status
await deps.db.message.create({
  data: { threadId, role: "system", kind: "status", source: "pipeline", content: "Pipeline started", metadata: { event: "pipeline_start" } },
});

const result = await pipeline.handleMessage(threadId, "user", content);

// Persist pipeline steps
for (const ps of result.pipelineSteps) {
  await deps.db.message.create({
    data: {
      threadId,
      role: "system",
      kind: "pipeline_step",
      source: "pipeline",
      content: ps.content,
      metadata: { step: ps.step },
    },
  });
}

// Persist SDK stream events (thinking, tool calls, tool results)
for (const event of result.streamEvents) {
  if (event.type === "thinking" && event.content) {
    await deps.db.message.create({
      data: { threadId, role: "assistant", kind: "thinking", source: "builtin", content: event.content },
    });
  } else if (event.type === "tool_call" && event.toolName) {
    const source = parsePluginSource(event.toolName);
    await deps.db.message.create({
      data: {
        threadId, role: "assistant", kind: "tool_call", source,
        content: event.toolName,
        metadata: { toolName: event.toolName, toolUseId: event.toolUseId, ...(event.toolInput ? { input: event.toolInput } : {}) },
      },
    });
  } else if (event.type === "tool_use_summary" && event.content) {
    await deps.db.message.create({
      data: {
        threadId, role: "assistant", kind: "tool_result", source: "builtin",
        content: event.content,
        metadata: { ...(event.toolUseId ? { toolUseId: event.toolUseId } : {}) },
      },
    });
  }
}

// Persist assistant text reply
if (result.invokeResult.output) {
  await deps.db.message.create({
    data: {
      threadId, role: "assistant", kind: "text", source: "builtin",
      content: result.invokeResult.output,
      model: result.invokeResult.model,
    },
  });
  await deps.db.thread.update({ where: { id: threadId }, data: { lastActivityAt: new Date() } });
}

// Persist pipeline complete status
await deps.db.message.create({
  data: {
    threadId, role: "system", kind: "status", source: "pipeline",
    content: "Pipeline completed",
    metadata: {
      event: "pipeline_complete",
      durationMs: result.invokeResult.durationMs,
      inputTokens: result.invokeResult.inputTokens ?? 0,
      outputTokens: result.invokeResult.outputTokens ?? 0,
    },
  },
});
```

Add `parsePluginSource` helper to `_helpers/parse-plugin-source.ts`:

```ts
type ParsePluginSource = (qualifiedName: string) => string;

export const parsePluginSource: ParsePluginSource = (qualifiedName) => {
  const separatorIndex = qualifiedName.indexOf("__");
  if (separatorIndex === -1) return "builtin";
  return qualifiedName.slice(0, separatorIndex).replace(/Plugin$/i, "").toLowerCase();
};
```

**Step 5: Run tests — PASS**

Run: `pnpm --filter orchestrator test -- --run orchestrator`

Expected: PASS

**Step 6: Commit**

```
feat(orchestrator): collect pipeline steps in HandleMessageResult, persist all in sendToThread
```

---

### Task 4: Update existing orchestrator tests broken by new fields

**Context:** Three existing tests will fail because they assert on `message.create` args that now include `kind` and `source`, assert that `invoke` is called without `onMessage`, and assert the "does not persist" behavior. Fix them explicitly.

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

**Step 1: Find the three affected assertions**

1. The existing `sendToThread` test that asserts `message.create` was called with exact `role`, `content`, `model` — now needs `kind: "text"` and `source: "builtin"` added to the matcher
2. The test asserting `invoke` was called without `onMessage` — now `onMessage` is always passed; update to assert it IS present
3. The `sendToThread` "does not persist assistant message when output is empty" test — still valid, but ensure it accounts for the new status/pipeline messages that ARE persisted

**Step 2: Update the text message assertion**

Find the existing test asserting the assistant message shape:
```ts
// Before:
expect(deps.db.message.create).toHaveBeenCalledWith({
  data: { threadId: "thread-1", role: "assistant", content: "response", model: "claude-opus-4-5" },
});

// After — add kind and source:
expect(deps.db.message.create).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({ role: "assistant", kind: "text", source: "builtin", content: "response" }),
  })
);
```

**Step 3: Update the invoke args assertion**

Find the test checking invoke call args. Update to verify `onMessage` is now passed:
```ts
// Before (if it asserted no onMessage):
expect(mockInvoke).toHaveBeenCalledWith(prompt, expect.not.objectContaining({ onMessage: expect.anything() }));

// After:
expect(mockInvoke).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({ onMessage: expect.any(Function) })
);
```

**Step 4: Update the "does not persist assistant message when output is empty" test**

This test verifies no assistant text is persisted when output is empty. The assertion should be specific about what's NOT there:
```ts
// After: message.create IS called (for status/pipeline), but NOT for role=assistant, kind=text
const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
const textMessages = createCalls.filter(
  (c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === "text"
);
expect(textMessages).toHaveLength(0);
```

**Step 5: Run all orchestrator tests — PASS**

Run: `pnpm --filter orchestrator test`

Expected: PASS

**Step 6: Commit**

```
fix(orchestrator): update existing tests for new kind/source fields and onMessage callback
```

---

### Task 5: Extract `PipelineStep` from `PipelineActivity`, reuse in MessageItem

**Context:** The adversarial review flagged that creating `PipelineStepItem` would duplicate `PipelineActivity`'s step rendering. Instead, extract the single-step rendering from `PipelineActivity` into a shared `PipelineStep` component. `PipelineActivity` uses it for live steps; `MessageItem` uses it for persisted steps. No new architecture — just extract existing code.

**Files:**
- Read: `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/pipeline-step.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/pipeline-step.test.tsx`

**Step 1: Read PipelineActivity to identify step rendering**

Read the file to find how individual steps are rendered. The extraction should lift that exact JSX into `PipelineStep`.

**Step 2: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineStep } from "../pipeline-step";

describe("PipelineStep", () => {
  it("renders the step label", () => {
    render(<PipelineStep content="Processing message" metadata={{ step: "onMessage" }} />);
    expect(screen.getByText("Processing message")).toBeInTheDocument();
  });

  it("renders detail when present in metadata", () => {
    render(<PipelineStep content="Assembling context" metadata={{ step: "onBeforeInvoke", detail: "3 hooks" }} />);
    expect(screen.getByText("3 hooks")).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- --run pipeline-step`

Expected: FAIL

**Step 3: Extract `PipelineStep` from `PipelineActivity`**

Create `apps/web/src/app/(chat)/chat/_components/pipeline-step.tsx` with the extracted step rendering from `PipelineActivity`. Use the exact same visual treatment already in `PipelineActivity`.

```tsx
export type ActivityMessageProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type PipelineStepComponent = (props: ActivityMessageProps) => React.ReactNode;

export const PipelineStep: PipelineStepComponent = ({ content, metadata }) => {
  // Lift exact JSX from PipelineActivity's step rendering
};
```

**Note:** `ActivityMessageProps` is defined here and imported by all kind-specific components (ThinkingBlock, ToolCallBlock, ToolResultBlock, StatusLine) — this resolves the "five components with identical prop shapes but no shared type" issue.

**Step 4: Update `PipelineActivity` to use `PipelineStep`**

In `pipeline-activity.tsx`, import `PipelineStep` and replace the inline step JSX with `<PipelineStep content={...} metadata={...} />`.

**Step 5: Run tests — PASS**

Run: `pnpm --filter web test -- --run pipeline-step`
Run: `pnpm --filter web test -- --run pipeline-activity`

Expected: Both PASS

**Step 6: Commit**

```
refactor(web): extract PipelineStep from PipelineActivity for reuse in MessageItem
```

---

### Task 6: Extract `CollapsibleBlock` from `PipelineActivity`

**Context:** `ThinkingBlock` and `ToolResultBlock` will both need expand/collapse behavior. `PipelineActivity` may already have this pattern. Extract it into a shared `CollapsibleBlock` client component rather than copy-pasting the expand/collapse JSX three times.

**Files:**
- Read: `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/collapsible-block.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/collapsible-block.test.tsx`

**Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapsibleBlock } from "../collapsible-block";

describe("CollapsibleBlock", () => {
  it("renders collapsed by default with header label", () => {
    render(<CollapsibleBlock label="Thinking" icon={<span>🧠</span>}><p>content</p></CollapsibleBlock>);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("expands on click to show children", () => {
    render(<CollapsibleBlock label="Thinking" icon={<span>🧠</span>}><p>content</p></CollapsibleBlock>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("collapses again on second click", () => {
    render(<CollapsibleBlock label="Thinking" icon={<span>🧠</span>}><p>content</p></CollapsibleBlock>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByText("content")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders a chevron indicator", () => {
    render(<CollapsibleBlock label="Result" icon={<span>✓</span>}><p>x</p></CollapsibleBlock>);
    // chevron should be present in the button
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- --run collapsible-block`

Expected: FAIL

**Step 2: Implement `CollapsibleBlock`**

Lift the expand/collapse pattern from `PipelineActivity` (read the file first to match its exact visual):

```tsx
"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type CollapsibleBlockProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

type CollapsibleBlockComponent = (props: CollapsibleBlockProps) => ReactNode;

export const CollapsibleBlock: CollapsibleBlockComponent = ({ label, icon, children, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`w-full max-w-[80%] rounded-lg border border-border/60 bg-muted/30 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {icon}
        <span className="flex-1 font-medium">{label}</span>
      </button>
      {isExpanded && (
        <div className="border-t border-border/40 px-3 py-2">
          {children}
        </div>
      )}
    </div>
  );
};
```

**Step 3: Update `PipelineActivity` to use `CollapsibleBlock` if it has the same pattern**

If `PipelineActivity` has its own expand/collapse state, replace it with `CollapsibleBlock`.

**Step 4: Run tests — PASS**

Run: `pnpm --filter web test -- --run collapsible-block`
Run: `pnpm --filter web test -- --run pipeline-activity`

Expected: Both PASS

**Step 5: Commit**

```
refactor(web): extract CollapsibleBlock from PipelineActivity expand/collapse pattern
```

---

### Task 7: Create `ThinkingBlock`, `ToolCallBlock`, `ToolResultBlock` using shared abstractions

**Context:** All three use `ActivityMessageProps` (from Task 5). `ThinkingBlock` and `ToolResultBlock` use `CollapsibleBlock` (from Task 6). No copy-pasted expand/collapse logic.

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/thinking-block.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/tool-call-block.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/tool-result-block.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/thinking-block.test.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/tool-call-block.test.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/tool-result-block.test.tsx`

**Step 1: Write failing tests for ThinkingBlock**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThinkingBlock } from "../thinking-block";

describe("ThinkingBlock", () => {
  it("renders collapsed by default with Thinking header", () => {
    render(<ThinkingBlock content="Deep reasoning here" />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    expect(screen.queryByText("Deep reasoning here")).not.toBeInTheDocument();
  });

  it("expands to show content on click", () => {
    render(<ThinkingBlock content="Deep reasoning here" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Deep reasoning here")).toBeInTheDocument();
  });

  it("collapses again on second click", () => {
    render(<ThinkingBlock content="Deep reasoning here" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByText("Deep reasoning here")).not.toBeInTheDocument();
  });
});
```

**Step 2: Write failing tests for ToolCallBlock**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolCallBlock } from "../tool-call-block";

describe("ToolCallBlock", () => {
  it("renders the tool name", () => {
    render(<ToolCallBlock content="Read" metadata={{ toolName: "Read" }} />);
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("shows input preview when provided", () => {
    render(<ToolCallBlock content="Bash" metadata={{ toolName: "Bash", input: { command: "ls -la" } }} />);
    expect(screen.getByText(/ls -la/)).toBeInTheDocument();
  });

  it("strips plugin prefix from display name", () => {
    render(<ToolCallBlock content="delegationPlugin__delegate" metadata={{ toolName: "delegationPlugin__delegate" }} />);
    expect(screen.getByText("delegate")).toBeInTheDocument();
  });
});
```

**Step 3: Write failing tests for ToolResultBlock**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolResultBlock } from "../tool-result-block";

describe("ToolResultBlock", () => {
  it("renders collapsed by default", () => {
    render(<ToolResultBlock content="output text here" />);
    expect(screen.queryByText("output text here")).not.toBeInTheDocument();
  });

  it("expands to show output on click", () => {
    render(<ToolResultBlock content="output text here" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("output text here")).toBeInTheDocument();
  });

  it("shows a Result header", () => {
    render(<ToolResultBlock content="done" />);
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });
});
```

Run all three: `pnpm --filter web test -- --run thinking-block --run tool-call-block --run tool-result-block`

Expected: FAIL

**Step 4: Implement ThinkingBlock** (uses CollapsibleBlock and ActivityMessageProps)

```tsx
import { Brain } from "lucide-react";
import type { ActivityMessageProps } from "./pipeline-step";
import { CollapsibleBlock } from "./collapsible-block";

type ThinkingBlockComponent = (props: Pick<ActivityMessageProps, "content">) => React.ReactNode;

export const ThinkingBlock: ThinkingBlockComponent = ({ content }) => (
  <CollapsibleBlock label="Thinking" icon={<Brain className="h-3 w-3 shrink-0" />}>
    <p className="whitespace-pre-wrap text-xs text-muted-foreground/80 leading-relaxed">{content}</p>
  </CollapsibleBlock>
);
```

**Step 5: Implement ToolCallBlock** (inline, no collapsible needed)

```tsx
import { Terminal } from "lucide-react";
import type { ActivityMessageProps } from "./pipeline-step";

type GetDisplayName = (toolName: string) => string;

const getDisplayName: GetDisplayName = (toolName) => {
  const sep = toolName.indexOf("__");
  return sep === -1 ? toolName : toolName.slice(sep + 2);
};

export const ToolCallBlock: (props: ActivityMessageProps) => React.ReactNode = ({ content, metadata }) => {
  const toolName = (metadata?.toolName as string) ?? content;
  const displayName = getDisplayName(toolName);
  const input = metadata?.input as Record<string, unknown> | undefined;
  const inputPreview = input ? Object.values(input)[0] : undefined;

  return (
    <div className="flex w-full items-start gap-2 py-0.5 text-xs text-muted-foreground">
      <Terminal className="mt-0.5 h-3 w-3 shrink-0" />
      <div className="min-w-0">
        <span className="font-medium text-foreground/70">{displayName}</span>
        {inputPreview && (
          <span className="ml-1.5 truncate text-muted-foreground/50">
            {String(inputPreview).slice(0, 100)}
          </span>
        )}
      </div>
    </div>
  );
};
```

**Step 6: Implement ToolResultBlock** (uses CollapsibleBlock)

```tsx
import type { ActivityMessageProps } from "./pipeline-step";
import { CollapsibleBlock } from "./collapsible-block";

export const ToolResultBlock: (props: ActivityMessageProps) => React.ReactNode = ({ content, metadata }) => {
  const durationMs = metadata?.durationMs as number | undefined;
  const label = `Result${durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : ""}`;

  return (
    <CollapsibleBlock label={label}>
      <pre className="whitespace-pre-wrap text-xs text-muted-foreground/70 leading-relaxed max-h-64 overflow-y-auto">
        {content}
      </pre>
    </CollapsibleBlock>
  );
};
```

**Step 7: Run tests — PASS**

Run all three tests. Expected: PASS

**Step 8: Commit**

```
feat(web): add ThinkingBlock, ToolCallBlock, ToolResultBlock using CollapsibleBlock and ActivityMessageProps
```

---

### Task 8: Create `StatusLine` component

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/status-line.tsx`
- Test: `apps/web/src/app/(chat)/chat/_components/__tests__/status-line.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusLine } from "../status-line";

describe("StatusLine", () => {
  it("renders pipeline_start content", () => {
    render(<StatusLine content="Pipeline started" metadata={{ event: "pipeline_start" }} />);
    expect(screen.getByText("Pipeline started")).toBeInTheDocument();
  });

  it("renders pipeline_complete with duration and token metrics", () => {
    render(
      <StatusLine
        content="Pipeline completed"
        metadata={{ event: "pipeline_complete", durationMs: 3200, inputTokens: 500, outputTokens: 200 }}
      />
    );
    expect(screen.getByText(/Pipeline completed/)).toBeInTheDocument();
    expect(screen.getByText(/3\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/700 tokens/)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter web test -- --run status-line`

Expected: FAIL

**Step 2: Implement**

```tsx
import type { ActivityMessageProps } from "./pipeline-step";

export const StatusLine: (props: ActivityMessageProps) => React.ReactNode = ({ content, metadata }) => {
  const durationMs = metadata?.durationMs as number | undefined;
  const inputTokens = metadata?.inputTokens as number | undefined;
  const outputTokens = metadata?.outputTokens as number | undefined;
  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : undefined;
  const tokens =
    inputTokens != null && outputTokens != null ? `${inputTokens + outputTokens} tokens` : undefined;

  return (
    <div className="flex w-full items-center justify-center gap-2 py-1">
      <div className="h-px flex-1 bg-border/30" />
      <span className="text-[10px] text-muted-foreground/40">
        {content}
        {duration && ` · ${duration}`}
        {tokens && ` · ${tokens}`}
      </span>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  );
};
```

**Step 3: Run test — PASS**

**Step 4: Commit**

```
feat(web): add StatusLine component for pipeline status messages
```

---

### Task 9: Update MessageItem to route by `kind` — additive changes only

**Context:** The adversarial review flagged that the original plan replaced `MessageItem` wholesale, dropping existing aria-labels (`role="article"`, `aria-label`) and the model badge. This task makes the change **additive**: insert kind-based routing at the top, fall through to existing role-based rendering for `kind === "text"`. Existing tests must still pass.

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/message-item.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/message-item.test.tsx`

**Step 1: Read the current MessageItem and its tests first**

Read both files to understand what aria-labels, model badges, and test assertions currently exist. The implementation in Step 3 must preserve all of them.

**Step 2: Update `makeMessage` in tests to include kind and source**

```ts
const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "msg-1",
  threadId: "thread-1",
  role: "user",
  kind: "text",
  source: "builtin",
  content: "Hello",
  model: null,
  metadata: null,
  createdAt: new Date("2026-02-23T10:00:00Z"),
  ...overrides,
});
```

**Step 3: Add mocks for new components**

```tsx
vi.mock("../thinking-block", () => ({
  ThinkingBlock: ({ content }: { content: string }) => <div data-testid="thinking-block">{content}</div>,
}));

vi.mock("../tool-call-block", () => ({
  ToolCallBlock: ({ content }: { content: string }) => <div data-testid="tool-call-block">{content}</div>,
}));

vi.mock("../tool-result-block", () => ({
  ToolResultBlock: ({ content }: { content: string }) => <div data-testid="tool-result-block">{content}</div>,
}));

vi.mock("../pipeline-step", () => ({
  PipelineStep: ({ content }: { content: string }) => <div data-testid="pipeline-step">{content}</div>,
}));

vi.mock("../status-line", () => ({
  StatusLine: ({ content }: { content: string }) => <div data-testid="status-line">{content}</div>,
}));
```

**Step 4: Add new test cases for each kind**

```tsx
it("renders ThinkingBlock for kind=thinking", () => {
  render(<MessageItem message={makeMessage({ role: "assistant", kind: "thinking", content: "Analyzing..." })} />);
  expect(screen.getByTestId("thinking-block")).toBeInTheDocument();
});

it("renders ToolCallBlock for kind=tool_call", () => {
  render(<MessageItem message={makeMessage({ role: "assistant", kind: "tool_call", content: "Read", metadata: { toolName: "Read" } })} />);
  expect(screen.getByTestId("tool-call-block")).toBeInTheDocument();
});

it("renders ToolResultBlock for kind=tool_result", () => {
  render(<MessageItem message={makeMessage({ role: "assistant", kind: "tool_result", content: "file contents" })} />);
  expect(screen.getByTestId("tool-result-block")).toBeInTheDocument();
});

it("renders PipelineStep for kind=pipeline_step", () => {
  render(<MessageItem message={makeMessage({ role: "system", kind: "pipeline_step", content: "Processing message", metadata: { step: "onMessage" } })} />);
  expect(screen.getByTestId("pipeline-step")).toBeInTheDocument();
});

it("renders StatusLine for kind=status", () => {
  render(<MessageItem message={makeMessage({ role: "system", kind: "status", content: "Pipeline completed" })} />);
  expect(screen.getByTestId("status-line")).toBeInTheDocument();
});

it("falls back to existing text rendering for kind=text", () => {
  render(<MessageItem message={makeMessage({ role: "assistant", kind: "text", content: "response" })} />);
  expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
});

it("preserves aria-label for assistant text messages", () => {
  render(<MessageItem message={makeMessage({ role: "assistant", kind: "text" })} />);
  // Assert the existing aria-label is still present (use the actual label from the current test file)
  expect(screen.getByRole("article")).toBeInTheDocument();
});
```

Run: `pnpm --filter web test -- --run message-item`

Expected: FAIL (kind routing missing; existing tests may fail due to makeMessage missing fields)

**Step 5: Implement — additive kind routing**

Modify `apps/web/src/app/(chat)/chat/_components/message-item.tsx`. Add a kind-based switch **at the top**, before existing rendering logic. Do NOT remove or replace any existing code — only prepend:

```tsx
import { PipelineStep } from "./pipeline-step";
import { StatusLine } from "./status-line";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallBlock } from "./tool-call-block";
import { ToolResultBlock } from "./tool-result-block";

// (existing imports unchanged)

export const MessageItem: MessageItemComponent = ({ message, agentRun }) => {
  // NEW: kind-based routing — handled before role-based rendering
  const kind = (message as Message & { kind?: string }).kind ?? "text";
  const metadata = message.metadata as Record<string, unknown> | null;

  switch (kind) {
    case "thinking":
      return <ThinkingBlock content={message.content} />;
    case "tool_call":
      return <ToolCallBlock content={message.content} metadata={metadata} />;
    case "tool_result":
      return <ToolResultBlock content={message.content} metadata={metadata} />;
    case "pipeline_step":
      return <PipelineStep content={message.content} metadata={metadata} />;
    case "status":
      return <StatusLine content={message.content} metadata={metadata} />;
    // "text" and unknown kinds fall through to existing role-based rendering
  }

  // EXISTING role-based rendering unchanged below this line
  // ... (preserve all existing code including aria-labels and model badge)
};
```

**Step 6: Run tests — PASS**

Run: `pnpm --filter web test -- --run message-item`

Expected: All existing + new tests PASS

**Step 7: Commit**

```
feat(web): add kind-based routing to MessageItem, preserve existing role rendering
```

---

### Task 10: Full verification

**Step 1:** `pnpm --filter orchestrator test` → PASS

**Step 2:** `pnpm --filter web test` → PASS

**Step 3:** `pnpm typecheck` → PASS

**Step 4:** `pnpm lint` → PASS

**Step 5:** `pnpm build` → PASS

**Step 6: Final commit if any fixes needed**

```
fix: address verification issues from rich activity model
```

---

## What this enables (not in this plan)

1. **Real-time SDK event persistence** — change onMessage from collect-and-batch to persist-immediately for mid-invoke refresh support
2. **Plugin renderer registry** — frontend registry mapping `(kind, toolName)` to custom React components with fallback chain
3. **File viewer renderer** — custom renderer for `toolName: "Read"` with line numbers and syntax highlighting
4. **Terminal renderer** — custom renderer for `toolName: "Bash"` with terminal styling
5. **Plugin disable support** — query `WHERE source = 'x'`, skip custom renderers for disabled plugins
