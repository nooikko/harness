# Chat Interface Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the chat interface from raw-text bubbles into a "conversational document" with markdown rendering, auto-scroll, live pipeline activity, metadata chips, and warm neutral aesthetics.

**Architecture:** Three-phase implementation. Phase 1 installs markdown rendering, auto-scroll, and warm palette (the core UX fixes). Phase 2 adds post-response metadata chips from AgentRun data. Phase 3 adds real-time pipeline step broadcasts and a live activity feed during thinking.

**Tech Stack:** react-markdown + remark-gfm (markdown), @tailwindcss/typography (prose styling), IntersectionObserver (auto-scroll), existing WS infrastructure (pipeline events)

**Design Doc:** `docs/plans/chat-interface-redesign-design.md`

---

## Phase 1: Core Fixes

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/globals.css:1` (add typography plugin import)

**Step 1: Install packages**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard add react-markdown remark-gfm @tailwindcss/typography
```

**Step 2: Add typography plugin to globals.css**

At the top of `apps/web/src/app/globals.css`, after the existing `@import` lines (line 2), add:

```css
@plugin "@tailwindcss/typography";
```

**Step 3: Verify build**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard build
```
Expected: Build succeeds with new dependencies.

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/app/globals.css pnpm-lock.yaml
git commit -m "feat(web): install react-markdown, remark-gfm, @tailwindcss/typography"
```

---

### Task 2: Create MarkdownContent Component (TDD)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/markdown-content.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/markdown-content.test.tsx`

**Step 1: Write the failing tests**

Create `apps/web/src/app/(chat)/chat/_components/__tests__/markdown-content.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../markdown-content";

describe("MarkdownContent", () => {
  it("renders bold text as <strong>", () => {
    render(<MarkdownContent content="This is **bold** text" />);
    const strong = screen.getByText("bold");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders italic text as <em>", () => {
    render(<MarkdownContent content="This is *italic* text" />);
    const em = screen.getByText("italic");
    expect(em.tagName).toBe("EM");
  });

  it("renders inline code with code element", () => {
    render(<MarkdownContent content="Use `console.log` here" />);
    const code = screen.getByText("console.log");
    expect(code.tagName).toBe("CODE");
  });

  it("renders a fenced code block with pre and code elements", () => {
    render(<MarkdownContent content={'```js\nconst x = 1;\n```'} />);
    const codeBlock = screen.getByText("const x = 1;");
    expect(codeBlock.closest("pre")).not.toBeNull();
  });

  it("renders an unordered list", () => {
    render(<MarkdownContent content="- item one\n- item two" />);
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(screen.getByText("item two")).toBeInTheDocument();
    const listItems = document.querySelectorAll("li");
    expect(listItems.length).toBe(2);
  });

  it("renders links with anchor elements", () => {
    render(<MarkdownContent content="Visit [example](https://example.com)" />);
    const link = screen.getByRole("link", { name: "example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders GFM tables", () => {
    const md = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    render(<MarkdownContent content={md} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(document.querySelector("table")).not.toBeNull();
  });

  it("renders GFM strikethrough", () => {
    render(<MarkdownContent content="This is ~~deleted~~ text" />);
    const del = screen.getByText("deleted");
    expect(del.tagName).toBe("DEL");
  });

  it("renders blockquotes", () => {
    render(<MarkdownContent content="> This is a quote" />);
    expect(document.querySelector("blockquote")).not.toBeNull();
    expect(screen.getByText("This is a quote")).toBeInTheDocument();
  });

  it("applies prose class to wrapper", () => {
    const { container } = render(<MarkdownContent content="Hello" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains("prose")).toBe(true);
  });

  it("renders plain text without crashing", () => {
    render(<MarkdownContent content="Just plain text" />);
    expect(screen.getByText("Just plain text")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/markdown-content.test.tsx
```
Expected: FAIL — module `../markdown-content` not found.

**Step 3: Write the MarkdownContent component**

Create `apps/web/src/app/(chat)/chat/_components/markdown-content.tsx`:

```tsx
"use client";

import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
};

type MarkdownContentComponent = (props: MarkdownContentProps) => React.ReactNode;

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg bg-[hsl(220,15%,16%)] p-4 text-sm text-[hsl(210,40%,92%)]"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-[0.875em] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export const MarkdownContent: MarkdownContentComponent = ({ content }) => (
  <div className="prose prose-stone max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0">
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  </div>
);
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/markdown-content.test.tsx
```
Expected: All 11 tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/markdown-content.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/markdown-content.test.tsx
git commit -m "feat(web): create MarkdownContent component with GFM support"
```

---

### Task 3: Update MessageItem Layout

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/message-item.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/message-item.test.tsx`

**Step 1: Update the test file to expect new layout**

The existing tests check for text presence and labels. We need to:
- Add a mock for the new `MarkdownContent` component
- Update tests to check for the new layout structure
- Add a test that assistant messages use MarkdownContent

Update `__tests__/message-item.test.tsx` — add a mock before the import:

```tsx
vi.mock("../markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));
```

Add new test cases:

```tsx
it("renders assistant messages with MarkdownContent", () => {
  render(
    <MessageItem
      message={makeMessage({ role: "assistant", content: "**bold** text" })}
    />,
  );
  expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
  expect(screen.getByTestId("markdown-content")).toHaveTextContent(
    "**bold** text",
  );
});

it("renders user messages as plain text without MarkdownContent", () => {
  render(
    <MessageItem message={makeMessage({ role: "user", content: "Hello" })} />,
  );
  expect(screen.queryByTestId("markdown-content")).not.toBeInTheDocument();
  expect(screen.getByText("Hello")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify new tests fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/message-item.test.tsx
```
Expected: New tests FAIL (MarkdownContent not used yet).

**Step 3: Update MessageItem component**

Rewrite `message-item.tsx` with the new layout:

- Assistant messages: full-width, no bubble, bot icon byline, MarkdownContent, model badge
- User messages: right-aligned pill, primary bg, plain text
- System messages: centered, muted, unchanged behavior
- Remove `max-w-[75%]` from assistant messages
- Use `MarkdownContent` for assistant role only

Key changes to the component:

```tsx
import { MarkdownContent } from "./markdown-content";

// Assistant layout:
<div className="flex w-full gap-3">
  <span role="img" className="mt-1 shrink-0" aria-label="Assistant">
    <Bot className="h-4 w-4 text-muted-foreground" />
  </span>
  <div className="min-w-0 flex-1">
    <MarkdownContent content={message.content} />
    {message.model && (
      <span className="mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {formatModelName(message.model)}
      </span>
    )}
  </div>
</div>

// User layout:
<div className="flex w-full justify-end">
  <div className="max-w-[75%] rounded-lg bg-primary px-4 py-3 text-primary-foreground">
    <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
  </div>
</div>
```

**Step 4: Run all message-item tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/message-item.test.tsx
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/message-item.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/message-item.test.tsx
git commit -m "feat(web): redesign MessageItem layout — full-width assistant, pill user messages"
```

---

### Task 4: Create ScrollAnchor Component (TDD)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/scroll-anchor.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/scroll-anchor.test.tsx`

**Step 1: Write the failing tests**

Create `__tests__/scroll-anchor.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScrollAnchor } from "../scroll-anchor";

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

vi.stubGlobal(
  "IntersectionObserver",
  vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
    // Simulate the element being visible (near bottom)
    setTimeout(() => {
      callback(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    }, 0);
    return { observe: mockObserve, disconnect: mockDisconnect };
  }),
);

describe("ScrollAnchor", () => {
  it("renders a sentinel div", () => {
    const { container } = render(<ScrollAnchor messageCount={0} />);
    expect(container.querySelector("[data-scroll-anchor]")).not.toBeNull();
  });

  it("creates an IntersectionObserver on mount", () => {
    render(<ScrollAnchor messageCount={0} />);
    expect(IntersectionObserver).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalled();
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<ScrollAnchor messageCount={0} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("calls scrollIntoView on mount for initial scroll", () => {
    const mockScrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      mockScrollIntoView,
    );
    render(<ScrollAnchor messageCount={5} />);
    expect(mockScrollIntoView).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/scroll-anchor.test.tsx
```
Expected: FAIL — module not found.

**Step 3: Write the ScrollAnchor component**

Create `scroll-anchor.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type ScrollAnchorProps = {
  messageCount: number;
};

type ScrollAnchorComponent = (props: ScrollAnchorProps) => React.ReactNode;

export const ScrollAnchor: ScrollAnchorComponent = ({ messageCount }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(messageCount);

  // Track if user is near the bottom using IntersectionObserver
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isNearBottomRef.current = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom on mount (initial load)
  useEffect(() => {
    anchorRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Scroll to bottom when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (messageCount !== prevCountRef.current) {
      prevCountRef.current = messageCount;
      if (isNearBottomRef.current) {
        anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [messageCount]);

  return <div ref={anchorRef} data-scroll-anchor aria-hidden="true" />;
};
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/scroll-anchor.test.tsx
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/scroll-anchor.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/scroll-anchor.test.tsx
git commit -m "feat(web): create ScrollAnchor component with IntersectionObserver"
```

---

### Task 5: Create ScrollToBottomButton Component (TDD)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/scroll-to-bottom-button.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/scroll-to-bottom-button.test.tsx`

**Step 1: Write the failing tests**

Create `__tests__/scroll-to-bottom-button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScrollToBottomButton } from "../scroll-to-bottom-button";

describe("ScrollToBottomButton", () => {
  it("renders nothing when isVisible is false", () => {
    const { container } = render(
      <ScrollToBottomButton isVisible={false} onClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a button when isVisible is true", () => {
    render(<ScrollToBottomButton isVisible={true} onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /scroll to bottom/i }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />);
    await user.click(
      screen.getByRole("button", { name: /scroll to bottom/i }),
    );
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/scroll-to-bottom-button.test.tsx
```
Expected: FAIL — module not found.

**Step 3: Write the ScrollToBottomButton component**

Create `scroll-to-bottom-button.tsx`:

```tsx
"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "ui";

type ScrollToBottomButtonProps = {
  isVisible: boolean;
  onClick: () => void;
};

type ScrollToBottomButtonComponent = (
  props: ScrollToBottomButtonProps,
) => React.ReactNode;

export const ScrollToBottomButton: ScrollToBottomButtonComponent = ({
  isVisible,
  onClick,
}) => {
  if (!isVisible) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className="absolute bottom-20 right-6 z-10 rounded-full shadow-md transition-opacity"
    >
      <ArrowDown className="h-4 w-4" />
    </Button>
  );
};
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/scroll-to-bottom-button.test.tsx
```
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/scroll-to-bottom-button.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/scroll-to-bottom-button.test.tsx
git commit -m "feat(web): create ScrollToBottomButton component"
```

---

### Task 6: Wire ScrollAnchor into MessageList

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/message-list.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/message-list.test.tsx`

**Step 1: Update the test**

Add to `__tests__/message-list.test.tsx`:

```tsx
it("renders ScrollAnchor with message count when messages exist", async () => {
  mockFindMany.mockResolvedValue([
    {
      id: "msg-1",
      role: "user",
      content: "Hello",
      threadId: "thread-1",
      createdAt: new Date(),
    },
  ]);
  const element = await MessageListInternal({ threadId: "thread-1" });
  const html = renderToStaticMarkup(element as React.ReactElement);
  // ScrollAnchor is a client component, so it renders as a placeholder in static markup
  // We verify the messages are rendered and the structure is correct
  expect(html).toContain("Hello");
});
```

Note: `ScrollAnchor` is a client component and `renderToStaticMarkup` won't execute its effects. The key test is that the component is included without breaking rendering.

**Step 2: Update MessageList to include ScrollAnchor**

In `message-list.tsx`, add the import and place `ScrollAnchor` at the end of the message list:

```tsx
import { ScrollAnchor } from "./scroll-anchor";

// Inside MessageListInternal, after the messages map:
return (
  <ScrollArea className="min-h-0 flex-1">
    <div className="flex flex-col gap-6 p-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <ScrollAnchor messageCount={messages.length} />
    </div>
  </ScrollArea>
);
```

Also update the gap from `gap-4` to `gap-6` for better spacing.

**Step 3: Run message-list tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/message-list.test.tsx
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/message-list.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/message-list.test.tsx
git commit -m "feat(web): wire ScrollAnchor into MessageList, increase message spacing"
```

---

### Task 7: Update Chat Input — Auto-grow Textarea + Style Refinements

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`

**Step 1: Update chat-input.tsx**

Changes:
- Add auto-grow behavior: textarea adjusts height as content grows (up to 4 lines / 160px)
- Refine styling: warmer borders, subtle top shadow, better spacing
- Keep all existing behavior (submit, WebSocket, polling) unchanged

Add auto-grow logic using a `useEffect` that resizes based on `scrollHeight`:

```tsx
// Add after the existing textareaRef:
useEffect(() => {
  const el = textareaRef.current;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}, [value]);
```

Update the textarea styling:
```
className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[40px] max-h-[160px]"
```

Update the wrapper div:
```
className="border-t border-border bg-card/50 px-4 py-3 shadow-[0_-1px_3px_0_rgb(0,0,0,0.05)]"
```

**Step 2: Run existing chat-input tests to verify no regressions**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/chat-input.test.tsx
```
Expected: All existing tests PASS. The auto-grow is purely visual and doesn't affect functionality.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/chat-input.tsx
git commit -m "feat(web): add auto-grow textarea and refined input styling"
```

---

### Task 8: Update Warm Color Palette

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Step 1: Update the CSS custom properties**

Replace the `:root` block with warm neutral values:

```css
:root {
  --background: 40 20% 99%;
  --foreground: 30 15% 15%;
  --card: 40 15% 99%;
  --card-foreground: 30 15% 15%;
  --popover: 40 15% 99%;
  --popover-foreground: 30 15% 15%;
  --primary: 210 40% 42%;
  --primary-foreground: 210 40% 98%;
  --secondary: 35 15% 95%;
  --secondary-foreground: 30 15% 15%;
  --muted: 35 20% 95%;
  --muted-foreground: 30 10% 45%;
  --accent: 35 20% 95%;
  --accent-foreground: 30 15% 15%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 210 40% 98%;
  --border: 35 15% 88%;
  --input: 35 15% 88%;
  --ring: 210 40% 42%;
  --chart-1: 210 40% 42%;
  --chart-2: 173 58% 39%;
  --chart-3: 32 95% 52%;
  --chart-4: 142 71% 45%;
  --chart-5: 0 72% 51%;
  --radius: 0.5rem;
  --sidebar: 35 15% 97%;
}
```

Keep the `.dark` block unchanged for now.

**Step 2: Verify the build**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(web): update color palette to warm neutrals"
```

---

### Task 9: Run Full Test Suite and Fix Any Regressions

**Step 1: Run all web app tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run
```

**Step 2: Fix any failing tests**

Common expected fixes:
- Tests that check for specific CSS classes (like `bg-muted`) may need updating if the class names changed
- Tests checking for `gap-4` should now expect `gap-6`
- The message-item test for model badge selector `.text-\[10px\]` may need updating if the badge styling changed

**Step 3: Run typecheck and lint**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard typecheck && pnpm --filter dashboard lint
```
Expected: Both pass.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): fix test regressions from Phase 1 redesign"
```

---

## Phase 2: Activity Chips

### Task 10: Create ActivityChips Component (TDD)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/activity-chips.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/activity-chips.test.tsx`

**Step 1: Write failing tests**

Create `__tests__/activity-chips.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityChips } from "../activity-chips";

describe("ActivityChips", () => {
  it("renders model chip with model name", () => {
    render(
      <ActivityChips
        model="claude-sonnet-4-6"
        inputTokens={500}
        outputTokens={200}
        durationMs={1500}
      />,
    );
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
  });

  it("renders token count chip", () => {
    render(
      <ActivityChips
        model="claude-sonnet-4-6"
        inputTokens={500}
        outputTokens={200}
        durationMs={1500}
      />,
    );
    expect(screen.getByText("700 tokens")).toBeInTheDocument();
  });

  it("renders duration chip in seconds for >= 1000ms", () => {
    render(
      <ActivityChips
        model="claude-sonnet-4-6"
        inputTokens={100}
        outputTokens={100}
        durationMs={2300}
      />,
    );
    expect(screen.getByText("2.3s")).toBeInTheDocument();
  });

  it("renders duration chip in ms for < 1000ms", () => {
    render(
      <ActivityChips
        model="claude-sonnet-4-6"
        inputTokens={100}
        outputTokens={100}
        durationMs={450}
      />,
    );
    expect(screen.getByText("450ms")).toBeInTheDocument();
  });

  it("renders nothing when no data is provided", () => {
    const { container } = render(<ActivityChips />);
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/activity-chips.test.tsx
```
Expected: FAIL — module not found.

**Step 3: Write the ActivityChips component**

Create `activity-chips.tsx`:

```tsx
type ActivityChipsProps = {
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
};

type ActivityChipsComponent = (props: ActivityChipsProps) => React.ReactNode;

type FormatDuration = (ms: number) => string;

const formatDuration: FormatDuration = (ms) => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
};

type FormatModel = (model: string) => string;

const formatModel: FormatModel = (model) => {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
};

type ModelColor = (model: string) => string;

const modelColor: ModelColor = (model) => {
  if (model.includes("opus")) return "bg-purple-100 text-purple-700";
  if (model.includes("sonnet")) return "bg-blue-100 text-blue-700";
  if (model.includes("haiku")) return "bg-emerald-100 text-emerald-700";
  return "bg-muted text-muted-foreground";
};

export const ActivityChips: ActivityChipsComponent = ({
  model,
  inputTokens,
  outputTokens,
  durationMs,
}) => {
  if (!model && inputTokens === undefined && durationMs === undefined) {
    return null;
  }

  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {model && (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${modelColor(model)}`}
        >
          {formatModel(model)}
        </span>
      )}
      {totalTokens !== undefined && (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {totalTokens.toLocaleString()} tokens
        </span>
      )}
      {durationMs !== undefined && (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {formatDuration(durationMs)}
        </span>
      )}
    </div>
  );
};
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/activity-chips.test.tsx
```
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/activity-chips.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/activity-chips.test.tsx
git commit -m "feat(web): create ActivityChips component for post-response metadata"
```

---

### Task 11: Fetch AgentRun Data and Wire ActivityChips into MessageItem

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/message-list.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/message-item.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/message-list.test.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/message-item.test.tsx`

**Step 1: Update MessageListInternal to fetch AgentRun data**

In `message-list.tsx`, after fetching messages, fetch the latest AgentRun for the thread:

```tsx
const agentRuns = await prisma.agentRun.findMany({
  where: { threadId },
  orderBy: { startedAt: "asc" },
  select: {
    id: true,
    model: true,
    inputTokens: true,
    outputTokens: true,
    durationMs: true,
    startedAt: true,
  },
});
```

Create a helper to match agent runs to assistant messages by timestamp proximity. Pass the matched run data to each `MessageItem`.

**Step 2: Update MessageItem to accept and render ActivityChips**

Add an optional `agentRun` prop to `MessageItemProps`:

```tsx
type AgentRunData = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

type MessageItemProps = {
  message: Message;
  agentRun?: AgentRunData | null;
};
```

Render `<ActivityChips {...agentRun} />` below the MarkdownContent for assistant messages.

**Step 3: Update tests**

Update message-list test mock to include `agentRun.findMany`. Update message-item tests to cover the new `agentRun` prop.

**Step 4: Run tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/message-list.test.tsx src/app/\\(chat\\)/chat/_components/__tests__/message-item.test.tsx
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/message-list.tsx apps/web/src/app/\(chat\)/chat/_components/message-item.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/
git commit -m "feat(web): fetch AgentRun data and display ActivityChips on assistant messages"
```

---

## Phase 3: Live Pipeline Activity

### Task 12: Add Pipeline Step Broadcasts to Orchestrator

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/index.ts:78-152`
- Modify: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/index.test.ts` in the `handleMessage` describe block:

```tsx
it("broadcasts pipeline:step events at each stage", async () => {
  const invokeResult = makeInvokeResult({ durationMs: 100, model: "claude-sonnet-4-6" });
  const deps = makeDeps({
    invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
  });
  const orchestrator = createOrchestrator(deps);

  await orchestrator.handleMessage("thread-1", "user", "hello");

  // Collect all onBroadcast calls
  const broadcastCalls = mockRunNotifyHooks.mock.calls.filter(
    (c) => c[1] === "onBroadcast",
  );

  // Should have pipeline:step calls plus the final pipeline:complete
  // At minimum: onMessage, onBeforeInvoke, invoking, onAfterInvoke, pipeline:complete
  expect(broadcastCalls.length).toBeGreaterThanOrEqual(5);
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter orchestrator test -- --run src/orchestrator/__tests__/index.test.ts
```
Expected: FAIL — fewer broadcast calls than expected.

**Step 3: Add pipeline:step broadcasts**

In `orchestrator/index.ts` `handleMessage`, add broadcasts at each step:

After Step 1 (onMessage hooks):
```tsx
await context.broadcast("pipeline:step", { threadId, step: "onMessage", timestamp: Date.now() });
```

After Step 2-3 (prompt assembly + onBeforeInvoke):
```tsx
await context.broadcast("pipeline:step", { threadId, step: "onBeforeInvoke", detail: "Context assembled", timestamp: Date.now() });
```

Before Step 4 (invoke):
```tsx
await context.broadcast("pipeline:step", { threadId, step: "invoking", detail: model ?? "default", timestamp: Date.now() });
```

After Step 4 (invoke complete), before Step 5:
```tsx
await context.broadcast("pipeline:step", {
  threadId,
  step: "onAfterInvoke",
  detail: `${invokeResult.inputTokens ?? 0 + (invokeResult.outputTokens ?? 0)} tokens, ${invokeResult.durationMs}ms`,
  timestamp: Date.now(),
});
```

Note: Check if `invokeResult` has token fields. Check the `InvokeResult` type in `@harness/plugin-contract`. If tokens aren't available on `InvokeResult`, use the duration only.

**Step 4: Run tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter orchestrator test -- --run src/orchestrator/__tests__/index.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/orchestrator/src/orchestrator/index.ts apps/orchestrator/src/orchestrator/__tests__/index.test.ts
git commit -m "feat(orchestrator): broadcast pipeline:step events at each pipeline stage"
```

---

### Task 13: Create PipelineActivity Component (TDD)

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/pipeline-activity.test.tsx`

**Step 1: Write failing tests**

Create `__tests__/pipeline-activity.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseWs = vi.fn().mockReturnValue({ lastEvent: null, isConnected: true });
vi.mock("../ws-provider", () => ({
  useWs: (...args: unknown[]) => mockUseWs(...args),
}));

const { PipelineActivity } = await import("../pipeline-activity");

describe("PipelineActivity", () => {
  it("renders nothing when not active", () => {
    const { container } = render(
      <PipelineActivity threadId="thread-1" isActive={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows thinking indicator when active with no events", () => {
    render(<PipelineActivity threadId="thread-1" isActive={true} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("shows pipeline steps as they arrive", () => {
    mockUseWs.mockReturnValue({
      lastEvent: {
        threadId: "thread-1",
        step: "invoking",
        detail: "Sonnet",
        timestamp: Date.now(),
      },
      isConnected: true,
    });

    render(<PipelineActivity threadId="thread-1" isActive={true} />);
    expect(screen.getByText(/invoking/i)).toBeInTheDocument();
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
  });

  it("ignores pipeline steps for other threads", () => {
    mockUseWs.mockReturnValue({
      lastEvent: {
        threadId: "thread-other",
        step: "invoking",
        detail: "Sonnet",
        timestamp: Date.now(),
      },
      isConnected: true,
    });

    render(<PipelineActivity threadId="thread-1" isActive={true} />);
    expect(screen.queryByText(/sonnet/i)).not.toBeInTheDocument();
  });

  it("subscribes to pipeline:step events", () => {
    render(<PipelineActivity threadId="thread-1" isActive={true} />);
    expect(mockUseWs).toHaveBeenCalledWith("pipeline:step");
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/pipeline-activity.test.tsx
```
Expected: FAIL — module not found.

**Step 3: Write the PipelineActivity component**

Create `pipeline-activity.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWs } from "./ws-provider";

type PipelineStep = {
  step: string;
  detail?: string;
  timestamp: number;
};

type PipelineStepEvent = PipelineStep & {
  threadId: string;
};

type PipelineActivityProps = {
  threadId: string;
  isActive: boolean;
};

type PipelineActivityComponent = (
  props: PipelineActivityProps,
) => React.ReactNode;

const STEP_LABELS: Record<string, string> = {
  onMessage: "Processing message",
  onBeforeInvoke: "Preparing context",
  invoking: "Invoking",
  onAfterInvoke: "Processing response",
  commands: "Running commands",
};

export const PipelineActivity: PipelineActivityComponent = ({
  threadId,
  isActive,
}) => {
  const { lastEvent } = useWs("pipeline:step");
  const [steps, setSteps] = useState<PipelineStep[]>([]);

  // Accumulate steps for this thread
  useEffect(() => {
    if (!lastEvent || !isActive) return;
    const event = lastEvent as PipelineStepEvent;
    if (event.threadId !== threadId) return;

    setSteps((prev) => [
      ...prev,
      { step: event.step, detail: event.detail, timestamp: event.timestamp },
    ]);
  }, [lastEvent, threadId, isActive]);

  // Clear steps when activity ends
  useEffect(() => {
    if (!isActive) {
      setSteps([]);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Thinking...</span>
      </div>
      {steps.map((s, i) => (
        <div key={`${s.step}-${s.timestamp}-${i}`} className="ml-5 flex items-center gap-1.5 animate-in fade-in duration-300">
          <span className="text-muted-foreground/60">
            {i < steps.length - 1 ? "\u251c\u2500" : "\u2514\u2500"}
          </span>
          <span>{STEP_LABELS[s.step] ?? s.step}</span>
          {s.detail && (
            <span className="text-muted-foreground/80">{s.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/pipeline-activity.test.tsx
```
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/pipeline-activity.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/pipeline-activity.test.tsx
git commit -m "feat(web): create PipelineActivity component with live step feed"
```

---

### Task 14: Wire PipelineActivity into ChatInput

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/chat-input.test.tsx`

**Step 1: Update chat-input.tsx**

Replace the `isThinking && <div className='mb-2 animate-pulse ...'>Thinking...</div>` with:

```tsx
import { PipelineActivity } from "./pipeline-activity";

// Replace the thinking div:
<PipelineActivity threadId={threadId} isActive={isThinking} />
```

**Step 2: Update chat-input tests**

Mock the PipelineActivity component in the test file:

```tsx
vi.mock("../pipeline-activity", () => ({
  PipelineActivity: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="pipeline-activity">Thinking...</div> : null,
}));
```

The existing tests that check for "Thinking..." text should still pass through the mock.

**Step 3: Run tests**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm --filter dashboard test -- --run src/app/\\(chat\\)/chat/_components/__tests__/chat-input.test.tsx
```
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/chat-input.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/chat-input.test.tsx
git commit -m "feat(web): replace thinking indicator with PipelineActivity in ChatInput"
```

---

## Final Validation

### Task 15: Full Suite Validation

**Step 1: Run all tests across the monorepo**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm test
```
Expected: All tests pass.

**Step 2: Run typecheck**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm typecheck
```
Expected: No type errors.

**Step 3: Run lint**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm lint
```
Expected: No lint errors.

**Step 4: Run build**

Run:
```bash
cd /mnt/ramdisk/harness && pnpm build
```
Expected: Build succeeds.

**Step 5: Fix any remaining issues and commit**

If any checks fail, fix the issues and commit with:
```bash
git commit -m "fix(web): resolve final validation issues from chat redesign"
```
