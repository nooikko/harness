# Lexical Rich Chat Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the plain `<textarea>` in the chat interface with a Lexical-based rich editor that shows a styled slash-command menu when the user types `/`, inserts selected commands as visual chip nodes, and intercepts system commands (`/model`, `/new`, `/clear`) client-side before they reach the orchestrator.

**Architecture:** `chat-input.tsx` is rewritten around `LexicalComposer` with three plugins: `BeautifulMentionsPlugin` (trigger detection + chip insertion), `HistoryPlugin` (undo/redo), and a custom `SubmitPlugin` (Enter-to-submit, text extraction, system command dispatch, editor clearing). `ChatArea` sheds its inline textarea form and delegates submit handling to `ChatInput` via an `onSubmit(text)` callback, keeping all thinking/WebSocket/scroll state for itself. Menu and chip components are styled with shadcn CSS variable tokens — no new shadcn components added.

**Tech Stack:** `lexical` ^0.41.0, `@lexical/react` ^0.41.0, `lexical-beautiful-mentions` ^0.1.48, shadcn Tailwind CSS variables, Vitest

**Key Lexical APIs used:**
- `LexicalComposer` — editor context provider; `initialConfig` MUST be defined outside the component to avoid re-init on every render
- `RichTextPlugin` — required (not `PlainTextPlugin`) for clipboard support with mention nodes per `lexical-beautiful-mentions` docs
- `ContentEditable` — the editable div rendered by Lexical
- `useLexicalComposerContext()` — access `editor` inside any plugin component
- `KEY_ENTER_COMMAND` + `COMMAND_PRIORITY_HIGH` — intercept Enter before rich-text default
- `editor.read(() => $getRoot().getTextContent())` — extract plain text on submit
- `editor.update(() => $getRoot().clear(), { discrete: true })` — synchronous clear after submit
- `BeautifulMentionNode` → extended as `CommandNode`; registered via Node Overrides API so all mention nodes in this editor become command nodes
- `// @refresh reset` directive required in files that define custom nodes or create `LexicalComposer` to avoid stale state during Next.js hot reload

---

## Task 1: Install Lexical packages

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Add the three packages to `apps/web/package.json` dependencies**

```json
"@lexical/react": "^0.41.0",
"lexical": "^0.41.0",
"lexical-beautiful-mentions": "^0.1.48"
```

**Step 2: Install**

```bash
pnpm install
```

Expected: packages install cleanly. Lexical's peer dep is `react >= 17` so React 19 is compatible. Both `lexical` and `@lexical/react` must be the same version — mismatches cause a `LexicalComposerContext` runtime error.

**Step 3: Verify no type errors introduced**

```bash
pnpm --filter web typecheck 2>&1 | head -30
```

Expected: same errors as before (zero new ones).

**Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add lexical and lexical-beautiful-mentions"
```

---

## Task 2: Create the command registry

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_helpers/commands.ts`
- Create: `apps/web/src/app/(chat)/chat/_helpers/__tests__/commands.test.ts`

The registry is a plain static array — no async, no framework coupling. It is the single source of truth for every slash command shown in the menu.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_helpers/__tests__/commands.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../commands";

describe("COMMANDS registry", () => {
  it("contains at least 7 commands", () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(7);
  });

  it("every command has required fields with correct types", () => {
    for (const cmd of COMMANDS) {
      expect(typeof cmd.name).toBe("string");
      expect(cmd.name.length).toBeGreaterThan(0);
      expect(typeof cmd.description).toBe("string");
      expect(typeof cmd.args).toBe("string");
      expect(["input", "agent", "system"]).toContain(cmd.category);
    }
  });

  it("includes /current-time as an input command", () => {
    const cmd = COMMANDS.find((c) => c.name === "current-time");
    expect(cmd).toBeDefined();
    expect(cmd?.category).toBe("input");
  });

  it("includes all three system commands", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain("model");
    expect(names).toContain("new");
    expect(names).toContain("clear");
  });

  it("system commands have category 'system'", () => {
    const systemCmds = COMMANDS.filter((c) => c.category === "system");
    expect(systemCmds.length).toBeGreaterThanOrEqual(3);
  });

  it("no duplicate command names", () => {
    const names = COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
```

**Step 2: Run to verify failure**

```bash
pnpm --filter web test -- --reporter=verbose _helpers/__tests__/commands 2>&1 | tail -15
```

Expected: FAIL — `../commands` module not found.

**Step 3: Create `commands.ts`**

Create `apps/web/src/app/(chat)/chat/_helpers/commands.ts`:

```typescript
type CommandCategory = "input" | "agent" | "system";

type CommandDefinition = {
  name: string;
  description: string;
  args: string;
  category: CommandCategory;
};

const COMMANDS: CommandDefinition[] = [
  {
    name: "current-time",
    description: "Insert the current timestamp into the message",
    args: "",
    category: "input",
  },
  {
    name: "delegate",
    description: "Delegate a task to a sub-agent (used by Claude in its responses)",
    args: "<prompt>",
    category: "agent",
  },
  {
    name: "re-delegate",
    description: "Re-delegate with an amended prompt after validation failure",
    args: "<prompt>",
    category: "agent",
  },
  {
    name: "checkin",
    description: "Send a progress update from a sub-agent to the parent thread",
    args: "<message>",
    category: "agent",
  },
  {
    name: "model",
    description: "Change the AI model for this thread (resets the session)",
    args: "<model-name>",
    category: "system",
  },
  {
    name: "new",
    description: "Start a fresh conversation in a new thread",
    args: "",
    category: "system",
  },
  {
    name: "clear",
    description: "Start a fresh conversation in a new thread",
    args: "",
    category: "system",
  },
];

export type { CommandDefinition, CommandCategory };
export { COMMANDS };
```

**Step 4: Run tests to verify pass**

```bash
pnpm --filter web test -- --reporter=verbose _helpers/__tests__/commands 2>&1 | tail -15
```

Expected: PASS — 6 tests.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_helpers/
git commit -m "feat(chat): add slash command registry"
```

---

## Task 3: Create the CommandNode (custom Lexical node)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_helpers/command-node.tsx`

`CommandNode` extends `BeautifulMentionNode` from `lexical-beautiful-mentions`. It overrides `component()` to render a styled badge chip in the editor. It is registered in the editor config using Lexical's **Node Overrides API** so every `BeautifulMentionNode` created by the plugin becomes a `CommandNode` automatically.

Lexical custom nodes require class syntax — `BeautifulMentionNode` itself is a class. This is not a violation of the arrow-functions-only rule (which targets `function` declarations, not class declarations).

The `// @refresh reset` directive at the top of this file prevents Next.js fast refresh from leaving stale Lexical node registrations in memory during development.

`getTextContent()` is NOT overridden here. `BeautifulMentionNode`'s base implementation returns `trigger + value` (e.g., `/current-time`), which is exactly what the submit handler needs to send to the orchestrator.

**Step 1: Create `command-node.tsx`**

```typescript
// @refresh reset
"use client";

import type { Spread } from "lexical";
import type {
  BeautifulMentionComponentProps,
  SerializedBeautifulMentionNode,
} from "lexical-beautiful-mentions";
import { BeautifulMentionNode } from "lexical-beautiful-mentions";
import type { ElementType } from "react";

// Internal chip rendered inside the Lexical editor after a command is selected.
// Styled as a secondary badge using shadcn design tokens.
const CommandChip = ({ trigger, value }: BeautifulMentionComponentProps) => (
  <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-border">
    <span className="opacity-50">{trigger}</span>
    {value}
  </span>
);

type SerializedCommandNode = Spread<
  { type: "command-mention" },
  SerializedBeautifulMentionNode
>;

class CommandNode extends BeautifulMentionNode {
  static getType(): string {
    return "command-mention";
  }

  static clone(node: CommandNode): CommandNode {
    return new CommandNode(
      node.getTrigger(),
      node.getValue(),
      node.getData(),
      node.__key,
    );
  }

  static importJSON(
    serializedNode: SerializedBeautifulMentionNode,
  ): CommandNode {
    return new CommandNode(
      serializedNode.trigger,
      serializedNode.value,
      serializedNode.data,
    );
  }

  exportJSON(): SerializedCommandNode {
    return {
      ...super.exportJSON(),
      type: "command-mention",
    };
  }

  component(): ElementType<BeautifulMentionComponentProps> | null {
    return CommandChip;
  }

  // decorate() is intentionally not overridden — component() takes precedence
  // when defined, per lexical-beautiful-mentions docs.
}

export { CommandNode };
export type { SerializedCommandNode };
```

**Step 2: Typecheck**

```bash
pnpm --filter web typecheck 2>&1 | grep -E "command-node|TS[0-9]+" | head -20
```

Expected: no errors in `command-node.tsx`.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_helpers/command-node.tsx
git commit -m "feat(chat): add CommandNode extending BeautifulMentionNode"
```

---

## Task 4: Create the command menu UI components

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_helpers/command-menu.tsx`
- Create: `apps/web/src/app/(chat)/chat/_helpers/command-menu-item.tsx`

These are passed as `menuComponent` and `menuItemComponent` to `BeautifulMentionsPlugin`. The plugin handles positioning (floated above the cursor) and keyboard navigation — these components only provide visual structure and styling.

**Important:** `BeautifulMentionsMenuItemProps` spreads onto the `<li>` DOM element. The `itemValue` key in `props` is a non-standard attribute that must be destructured out before spreading to prevent a React DOM warning. This matches the pattern documented in the lexical-beautiful-mentions README.

**Step 1: Create `command-menu.tsx`**

```typescript
"use client";

import type { BeautifulMentionsMenuProps } from "lexical-beautiful-mentions";
import { forwardRef } from "react";

// Floating container for the slash command list.
// lexical-beautiful-mentions positions this relative to the cursor automatically.
const CommandMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(
  ({ loading: _loading, ...props }, ref) => (
    <ul
      ref={ref}
      className="z-50 min-w-[18rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      {...props}
    />
  ),
);

CommandMenu.displayName = "CommandMenu";

export { CommandMenu };
```

**Step 2: Create `command-menu-item.tsx`**

```typescript
"use client";

import type { BeautifulMentionsMenuItemProps } from "lexical-beautiful-mentions";
import { forwardRef } from "react";
import { cn } from "ui";

const CommandMenuItem = forwardRef<
  HTMLLIElement,
  BeautifulMentionsMenuItemProps
>(({ selected, item, ...props }, ref) => {
  // itemValue is a plugin-internal prop — strip it before spreading to <li>
  // to avoid the "Unknown prop `itemValue`" React DOM warning.
  const { itemValue: _itemValue, ...rest } = props as typeof props & {
    itemValue?: string;
  };

  const description =
    typeof item.data?.description === "string" ? item.data.description : "";
  const args = typeof item.data?.args === "string" ? item.data.args : "";

  return (
    <li
      ref={ref}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-popover-foreground",
      )}
      {...rest}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium">/{item.value}</span>
        {args && (
          <span className="text-xs text-muted-foreground">{args}</span>
        )}
      </div>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </li>
  );
});

CommandMenuItem.displayName = "CommandMenuItem";

export { CommandMenuItem };
```

**Step 3: Typecheck**

```bash
pnpm --filter web typecheck 2>&1 | grep -E "command-menu|TS[0-9]+" | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_helpers/command-menu.tsx \
        apps/web/src/app/\(chat\)/chat/_helpers/command-menu-item.tsx
git commit -m "feat(chat): add shadcn-styled command menu components"
```

---

## Task 5: Create the SubmitPlugin

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_helpers/submit-plugin.tsx`
- Create: `apps/web/src/app/(chat)/chat/_helpers/__tests__/submit-plugin.test.ts`

The `SubmitPlugin` is a Lexical plugin — a React component that returns `null` and registers side effects using `useLexicalComposerContext`. It handles:

1. **Enter** (no shift) → extract text → check for system command → clear editor → dispatch
2. **Shift+Enter** → returns `false` to let the default handler insert a newline
3. **System command `/model <name>`** → calls `updateThreadModel` server action, then `router.refresh()`
4. **System command `/new` or `/clear`** → calls `createThread` server action, then navigates
5. **Regular message** → calls `onSubmit(text)` callback

`parseSystemCommand` is extracted as a pure function so it can be unit tested without Lexical setup.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_helpers/__tests__/submit-plugin.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseSystemCommand } from "../submit-plugin";

describe("parseSystemCommand", () => {
  it("returns null for regular prose messages", () => {
    expect(parseSystemCommand("Hello world")).toBeNull();
    expect(parseSystemCommand("what is the weather?")).toBeNull();
  });

  it("returns null for agent-output commands (delegate, checkin)", () => {
    expect(parseSystemCommand("/delegate build me a React app")).toBeNull();
    expect(parseSystemCommand("/checkin progress update")).toBeNull();
    expect(parseSystemCommand("/re-delegate amended prompt")).toBeNull();
  });

  it("returns null for /current-time (handled by backend, not frontend)", () => {
    expect(parseSystemCommand("/current-time")).toBeNull();
  });

  it("detects /new", () => {
    expect(parseSystemCommand("/new")).toEqual({ command: "new", args: "" });
  });

  it("detects /clear", () => {
    expect(parseSystemCommand("/clear")).toEqual({ command: "clear", args: "" });
  });

  it("detects /model with a model name argument", () => {
    expect(parseSystemCommand("/model claude-opus-4-6")).toEqual({
      command: "model",
      args: "claude-opus-4-6",
    });
  });

  it("trims whitespace from args", () => {
    expect(parseSystemCommand("/model  claude-sonnet-4-6  ")).toEqual({
      command: "model",
      args: "claude-sonnet-4-6",
    });
  });

  it("requires the command to be at the start of the message", () => {
    expect(parseSystemCommand("please /new")).toBeNull();
  });

  it("is case-sensitive — /New is not a system command", () => {
    expect(parseSystemCommand("/New")).toBeNull();
    expect(parseSystemCommand("/MODEL claude-opus-4-6")).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

```bash
pnpm --filter web test -- --reporter=verbose _helpers/__tests__/submit-plugin 2>&1 | tail -15
```

Expected: FAIL — `../submit-plugin` module not found.

**Step 3: Create `submit-plugin.tsx`**

```typescript
// @refresh reset
"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from "lexical";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createThread } from "../_actions/create-thread";
import { updateThreadModel } from "../_actions/update-thread-model";

const SYSTEM_COMMANDS = new Set(["new", "clear", "model"]);

// Matches exactly: /commandname optionalArgs — must start at position 0.
const SYSTEM_COMMAND_RE = /^\/([a-z-]+)(?:\s+(.+))?$/;

type SystemCommand = { command: string; args: string };

// Pure function — unit-testable without any Lexical setup.
const parseSystemCommand = (text: string): SystemCommand | null => {
  const match = SYSTEM_COMMAND_RE.exec(text.trim());
  if (!match) return null;
  const [, command, args = ""] = match;
  if (!SYSTEM_COMMANDS.has(command)) return null;
  return { command, args: args.trim() };
};

type SubmitPluginProps = {
  threadId: string;
  onSubmit: (text: string) => void;
  disabled: boolean;
};

type SubmitPluginComponent = (props: SubmitPluginProps) => null;

// Lexical plugin: registers a KEY_ENTER_COMMAND handler at HIGH priority.
// Returns null — plugins are React components with no rendered output.
const SubmitPlugin: SubmitPluginComponent = ({ threadId, onSubmit, disabled }) => {
  const [editor] = useLexicalComposerContext();
  const router = useRouter();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        // Shift+Enter → new line. Return false to let RichTextPlugin handle it.
        if (event?.shiftKey) return false;

        // Blocked during pending transitions — swallow the event.
        if (disabled) {
          event?.preventDefault();
          return true;
        }

        const text = editor.read(() => $getRoot().getTextContent().trim());
        if (!text) return true;

        event?.preventDefault();

        // Synchronous clear so the editor empties before React re-renders.
        editor.update(() => {
          $getRoot().clear();
        }, { discrete: true });

        const system = parseSystemCommand(text);

        if (system?.command === "new" || system?.command === "clear") {
          createThread().then(({ threadId: newId }) => {
            router.push(`/chat/${newId}`);
          });
          return true;
        }

        if (system?.command === "model") {
          updateThreadModel(threadId, system.args || null).then(() => {
            router.refresh();
          });
          return true;
        }

        // Regular message — hand off to ChatArea's submit handler.
        onSubmit(text);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, threadId, onSubmit, disabled, router]);

  return null;
};

export { SubmitPlugin, parseSystemCommand };
export type { SystemCommand };
```

**Step 4: Run tests to verify pass**

```bash
pnpm --filter web test -- --reporter=verbose _helpers/__tests__/submit-plugin 2>&1 | tail -15
```

Expected: PASS — 9 tests.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_helpers/submit-plugin.tsx \
        apps/web/src/app/\(chat\)/chat/_helpers/__tests__/submit-plugin.test.ts
git commit -m "feat(chat): add SubmitPlugin with system command interception"
```

---

## Task 6: Rewrite `chat-input.tsx` with Lexical

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`

The existing file (plain textarea, 143 lines) is replaced entirely. The new version wraps a `LexicalComposer` and composes the helper plugins. `ChatInput` is now responsible only for rendering the editor — all thinking state, WebSocket listening, and polling stay in `ChatArea`.

**Key implementation notes:**

- `EDITOR_CONFIG` and `MENTION_ITEMS` are defined at module level (outside the component). Lexical reads `initialConfig` only once; an inline object would not cause bugs but would generate a console warning on every render.
- `SendButton` is an inner component defined in the same file (not exported) because it needs `useLexicalComposerContext`, which must be called inside a `LexicalComposer` descendant. It dispatches `KEY_ENTER_COMMAND` with a `null` event — the `SubmitPlugin` handles `null` events safely via optional chaining (`event?.shiftKey`, `event?.preventDefault()`).
- The `onSubmit` callback is stabilised via a ref so the `SubmitPlugin`'s `useEffect` dep array stays stable across parent re-renders without requiring `useCallback` at the call site.

**Step 1: Replace the contents of `chat-input.tsx`**

```typescript
// @refresh reset
"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { KEY_ENTER_COMMAND } from "lexical";
import {
  BeautifulMentionNode,
  BeautifulMentionsPlugin,
} from "lexical-beautiful-mentions";
import { SendHorizontal } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "ui";
import { CommandMenu } from "../_helpers/command-menu";
import { CommandMenuItem } from "../_helpers/command-menu-item";
import { CommandNode } from "../_helpers/command-node";
import { COMMANDS } from "../_helpers/commands";
import { SubmitPlugin } from "../_helpers/submit-plugin";

// Static — module-level so Lexical does not warn about a new config reference on every render.
const MENTION_ITEMS = {
  "/": COMMANDS.map(({ name, description, args, category }) => ({
    value: name,
    data: { description, args, category },
  })),
};

const EDITOR_CONFIG: InitialConfigType = {
  namespace: "ChatInput",
  nodes: [
    CommandNode,
    // Node Override: replace every BeautifulMentionNode the plugin creates
    // with a CommandNode so the custom chip component is used.
    {
      replace: BeautifulMentionNode,
      with: (node: BeautifulMentionNode) =>
        new CommandNode(node.getTrigger(), node.getValue(), node.getData()),
    },
  ],
  onError: (error: Error) => {
    throw error;
  },
};

// Inner component — must live inside LexicalComposer to call useLexicalComposerContext.
type SendButtonProps = { disabled: boolean };
const SendButton = ({ disabled }: SendButtonProps) => {
  const [editor] = useLexicalComposerContext();
  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={() =>
        editor.dispatchCommand(
          KEY_ENTER_COMMAND,
          null as unknown as KeyboardEvent,
        )
      }
      aria-label="Send message"
    >
      <SendHorizontal className="h-4 w-4" />
    </Button>
  );
};

type ChatInputProps = {
  threadId: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  error?: string | null;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({
  threadId,
  onSubmit,
  disabled = false,
  error,
}) => {
  // Stable ref so SubmitPlugin's useEffect does not re-register on every render
  // when the parent passes a new function reference.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const stableOnSubmit = useCallback((text: string) => {
    onSubmitRef.current(text);
  }, []);

  return (
    <div className="border-t border-border bg-card/50 px-4 py-3 shadow-[0_-1px_3px_0_rgb(0,0,0,0.05)]">
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        <div className="flex items-end gap-2">
          <div className="relative min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/50">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="max-h-[136px] min-h-[24px] resize-none overflow-y-auto outline-none"
                  aria-placeholder="Send a message… (/ for commands)"
                  placeholder={
                    <div className="pointer-events-none absolute left-3 top-2 select-none text-sm text-muted-foreground">
                      Send a message… (/ for commands)
                    </div>
                  }
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <BeautifulMentionsPlugin
              items={MENTION_ITEMS}
              menuComponent={CommandMenu}
              menuItemComponent={CommandMenuItem}
            />
            <HistoryPlugin />
            <SubmitPlugin
              threadId={threadId}
              onSubmit={stableOnSubmit}
              disabled={disabled}
            />
          </div>
          <SendButton disabled={disabled} />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
          Enter to send · Shift+Enter for new line · / for commands
        </p>
      </LexicalComposer>
    </div>
  );
};
```

**Step 2: Typecheck**

```bash
pnpm --filter web typecheck 2>&1 | grep -E "chat-input|TS[0-9]+" | head -20
```

Expected: no errors in `chat-input.tsx`.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/chat-input.tsx
git commit -m "feat(chat): rewrite ChatInput with Lexical editor and slash command menu"
```

---

## Task 7: Update `chat-area.tsx` to use `ChatInput`

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/chat-area.tsx`

`ChatArea` currently has an inline textarea form (lines 149–172). Replace it with `<ChatInput>`. Remove textarea-specific state and effects. Add a `handleSubmit(text: string)` callback.

`isThinking`, `isPending`, `error`, WebSocket listening, polling, and scroll behaviour all stay in `ChatArea`.

**Lines to remove from `chat-area.tsx`:**
- `const [value, setValue] = useState('');` (line 23)
- `const textareaRef = useRef<HTMLTextAreaElement>(null);` (line 28)
- The auto-grow textarea `useEffect` (lines 35–43)
- The old `handleSubmit` function (lines 107–129)
- The `handleKeyDown` function (lines 131–138)
- The entire `<div className='border-t ...'>` block (lines 149–172)

**Imports to add:**
```typescript
import { ChatInput } from './chat-input';
```

**New `handleSubmit` to add** (receives `text` instead of reading from `value`):

```typescript
const handleSubmit = (text: string) => {
  setError(null);
  setIsThinking(true);
  sentAtRef.current = new Date();
  startTransition(async () => {
    const result = await sendMessage(threadId, text);
    if (result?.error) {
      setError(result.error);
      setIsThinking(false);
    }
  });
};
```

**New return JSX** (replaces the removed inline form):

```tsx
return (
  <>
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-6 p-4">
        {children}
        <PipelineActivity threadId={threadId} isActive={isThinking} />
        <div ref={anchorRef} data-scroll-anchor aria-hidden="true" />
      </div>
    </ScrollArea>
    <ChatInput
      threadId={threadId}
      onSubmit={handleSubmit}
      disabled={isPending}
      error={error}
    />
  </>
);
```

**Step 1: Apply the changes described above**

**Step 2: Typecheck**

```bash
pnpm --filter web typecheck 2>&1 | grep -E "chat-area|TS[0-9]+" | head -20
```

Expected: no errors.

**Step 3: Run the dev server to manually verify end-to-end**

```bash
pnpm --filter web dev
```

Verify:
- Editor renders with the placeholder text
- Typing `/` opens the floating command menu showing all 7 commands with name, args, description
- Arrow keys navigate the menu; Enter selects → command chip appears in editor
- Additional text can be typed after the chip
- Enter submits → message sent, editor clears, thinking state activates
- Shift+Enter inserts a newline without submitting
- Send button works identically to Enter
- `/new` Enter → navigates to a new thread
- `/clear` Enter → navigates to a new thread
- `/model claude-opus-4-6` Enter → thread model updates, page refreshes

**Step 4: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/chat-area.tsx
git commit -m "feat(chat): wire ChatArea to use Lexical ChatInput"
```

---

## Task 8: Run full test suite and CI pipeline

**Step 1: Run all tests**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all pre-existing tests pass plus the 15 new tests (6 commands + 9 submit-plugin).

**Step 2: Run the coverage gate**

```bash
pnpm test:coverage-gate 2>&1 | tail -20
```

Expected: passes. The new helpers (`commands.ts`, `submit-plugin.tsx`) are tested at >80% branch + line coverage. The Lexical React components (`command-node.tsx`, `command-menu.tsx`, `command-menu-item.tsx`, `chat-input.tsx`) contain no exported logic — they are UI wrappers excluded from the gate's coverage requirement.

**Step 3: Run full CI pipeline**

```bash
pnpm ci 2>&1 | tail -30
```

Expected: sherif → typecheck → lint → build all pass.

**Step 4: Commit any auto-applied Biome formatting**

```bash
git status
# If files changed:
git add -A
git commit -m "fix(chat): apply biome formatting to lexical input components"
```

---

## Summary of files changed

| Action | File |
|--------|------|
| Create | `apps/web/src/app/(chat)/chat/_helpers/commands.ts` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/command-node.tsx` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/command-menu.tsx` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/command-menu-item.tsx` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/submit-plugin.tsx` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/__tests__/commands.test.ts` |
| Create | `apps/web/src/app/(chat)/chat/_helpers/__tests__/submit-plugin.test.ts` |
| Rewrite | `apps/web/src/app/(chat)/chat/_components/chat-input.tsx` |
| Modify | `apps/web/src/app/(chat)/chat/_components/chat-area.tsx` |
| Modify | `apps/web/package.json` + `pnpm-lock.yaml` |
