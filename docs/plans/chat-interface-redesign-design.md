# Chat Interface Redesign — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Approach:** Conversational Document

## Problem Statement

The chat interface has three critical issues:

1. **No markdown rendering** — Bot responses show raw asterisks and formatting characters. `message-item.tsx:50` renders `{message.content}` as plain text with `whitespace-pre-wrap`.
2. **No auto-scroll** — When new messages arrive via `router.refresh()`, the user must manually scroll down.
3. **Mundane aesthetics** — Stock shadcn defaults, cold blue-gray palette, lifeless bubble layout.

## Design Direction

**"Conversational Document"** — Messages flow like a clean document, not a chat widget. Assistant messages are full-width with rich markdown typography. User messages are compact right-aligned pills. Metadata lives as subtle inline chips. The thinking state shows live pipeline activity.

**Visual tone:** Light mode with warm neutrals (stone/cream instead of cold gray). Inter font retained, markdown typography enhanced.

## Architecture

### New Dependencies

| Package | Purpose | Where |
|---------|---------|-------|
| `react-markdown` | Markdown-to-React rendering | `apps/web` |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) | `apps/web` |
| `@tailwindcss/typography` | Prose styling for rendered markdown | `apps/web` |

### New Components

| Component | Type | Location |
|-----------|------|----------|
| `markdown-content.tsx` | Client | `apps/web/src/app/(chat)/chat/_components/` |
| `scroll-anchor.tsx` | Client | `apps/web/src/app/(chat)/chat/_components/` |
| `scroll-to-bottom-button.tsx` | Client | `apps/web/src/app/(chat)/chat/_components/` |
| `activity-chips.tsx` | Server | `apps/web/src/app/(chat)/chat/_components/` |
| `pipeline-activity.tsx` | Client | `apps/web/src/app/(chat)/chat/_components/` |

### Modified Components

| Component | Changes |
|-----------|---------|
| `message-item.tsx` | New layout: full-width assistant, right-aligned user pills. Use `MarkdownContent` for assistant messages. Add activity chips. |
| `message-list.tsx` | Add `ScrollAnchor` at bottom. Fetch associated `AgentRun` data for metadata chips. |
| `chat-input.tsx` | Replace "Thinking..." with `PipelineActivity` component. Add textarea auto-grow. Style refinements. |
| `globals.css` | Warm palette update. Prose/typography plugin styles. Code block dark panel. |

### Orchestrator Changes (Pipeline Events)

Add `context.broadcast()` calls at each pipeline step in `apps/orchestrator/src/orchestrator/index.ts`:

```
pipeline:step -> { threadId, step: 'onMessage' | 'onBeforeInvoke' | 'invoking' | 'onAfterInvoke' | 'commands' | 'complete', detail?: string }
```

Broadcast points (5 additions to `handleMessage`):
1. After onMessage hooks: `{ step: 'onMessage' }`
2. After prompt assembly: `{ step: 'onBeforeInvoke', detail: 'Context injected' }`
3. Before invoke: `{ step: 'invoking', detail: model }`
4. After invoke: `{ step: 'onAfterInvoke', detail: `${tokens} tokens, ${durationMs}ms` }`
5. After commands: `{ step: 'commands', detail: commandsHandled.join(', ') }`

The existing `pipeline:complete` event remains unchanged.

## Detailed Design

### 1. Message Layout

**Assistant messages:**
- Full content width (no `max-w-[75%]` constraint)
- No background bubble — content sits directly on the page background
- Tiny bot icon + model badge as a byline header
- Content rendered via `react-markdown` with `remark-gfm`
- Wrapped in `prose` classes from `@tailwindcss/typography`
- Below content: row of metadata chips (model, tokens, duration, plugins)

**User messages:**
- Right-aligned, compact pill shape
- Warm primary color fill, white text
- Subtle border-radius (not massive — `rounded-lg` not `rounded-full`)
- Plain text, no markdown rendering
- Max width 75%

**System messages:**
- Centered, muted, small italic text
- No layout changes from current

**Spacing:**
- `gap-6` between messages (up from `gap-4`)

### 2. Markdown Rendering

`MarkdownContent` client component:
- Wraps `react-markdown` with `remarkGfm` plugin
- Custom component overrides for:
  - **Code blocks:** Dark panel (charcoal bg), language label top-left, copy button top-right, monospace font, horizontal scroll for long lines
  - **Inline code:** Warm subtle background highlight, slightly smaller font
  - **Links:** Primary color, underline on hover
  - **Tables:** Clean borders, alternating row shading
  - **Blockquotes:** Left border accent, muted italic
- Wrapped in `prose prose-stone` for typography defaults
- XSS safe — `react-markdown` does not use `dangerouslySetInnerHTML`

### 3. Auto-Scroll

**ScrollAnchor** client component:
- Placed at the bottom of the message list inside `ScrollArea`
- Uses `IntersectionObserver` to detect if the bottom sentinel is visible
- Tracks `isNearBottom` state
- On mount: scroll to bottom (initial load)
- On message count change: scroll to bottom if `isNearBottom` was true
- After sending a message: always scroll to bottom

**ScrollToBottomButton** client component:
- Floating pill above the input area
- Shows when `isNearBottom` is false
- Down-arrow icon
- Click scrolls to bottom smoothly
- Optional: badge with count of unseen messages

**Communication:** ScrollAnchor and ChatInput need shared state. Use a lightweight context or callback prop passed through the message list wrapper.

### 4. Activity Chips (Post-Response Metadata)

**ActivityChips** server component:
- Receives `AgentRun` data associated with the message (fetched in `MessageListInternal` via a join or separate query)
- Renders a row of small chips:
  - Model chip: color-coded (blue=Sonnet, purple=Opus, green=Haiku)
  - Token chip: `{input + output} tokens`
  - Duration chip: `{durationMs}ms` or `{seconds}s`
  - Plugin chips: which plugins participated (from metadata or hooks)

**Data source:** `AgentRun` records linked to threads. The message list query joins or separately fetches the latest `AgentRun` for the thread that completed just before each assistant message's timestamp.

### 5. Pipeline Activity (Live Thinking State)

**PipelineActivity** client component:
- Subscribes to `pipeline:step` WS events for the current thread
- Renders an animated tree/list of steps as they arrive:
  ```
  Thinking...
   |-- Running pipeline hooks
   |-- Context plugin: injected 3 files
   |-- Invoking Sonnet 4...
   +-- (active -- 1.2s elapsed)
  ```
- Each step appears with a subtle fade-in animation
- Active step has a pulsing dot indicator
- Elapsed time counter on the active step
- When `pipeline:complete` arrives: fade out the entire activity feed
- Positioned at the bottom of the message list (before the input area)

### 6. Color Palette (Warm Neutrals)

Updated CSS custom properties in `globals.css`:

| Token | Current (cold) | New (warm) |
|-------|---------------|------------|
| `--background` | `0 0% 100%` (white) | `40 20% 99%` (warm off-white) |
| `--foreground` | `220 20% 14%` | `30 15% 15%` (warm near-black) |
| `--muted` | `214 32% 96%` (blue-gray) | `35 20% 95%` (warm stone) |
| `--muted-foreground` | `215 16% 47%` | `30 10% 45%` (warm gray) |
| `--border` | `214 20% 90%` (blue-gray) | `35 15% 88%` (warm gray) |
| `--primary` | `215 50% 40%` (cold blue) | `210 40% 42%` (slate-blue, warmer) |
| `--accent` | `214 32% 96%` | `35 20% 95%` (warm stone) |
| `--card` | `0 0% 100%` | `40 15% 99%` (warm) |

### 7. Input Area Refinements

- Subtle top shadow or lighter background strip to separate from messages
- Textarea auto-grows up to 4 lines (`min-h-[40px] max-h-[160px]`)
- Warmer border color, slightly more rounded
- Send button: filled primary, smooth hover/active transitions
- Placeholder text: warm muted color

### 8. WebSocket Events (Orchestrator Side)

New event type alongside existing `pipeline:complete`:

```typescript
// New: granular pipeline step events
await context.broadcast('pipeline:step', {
  threadId,
  step: 'onMessage' | 'onBeforeInvoke' | 'invoking' | 'onAfterInvoke' | 'commands',
  detail?: string,
  timestamp: Date.now(),
});
```

The `ws-provider.tsx` already supports subscribing to arbitrary event names, so no changes needed there. `PipelineActivity` subscribes to `pipeline:step`.

## Implementation Phases

### Phase 1: Core Fixes (markdown + auto-scroll + warm palette)
- Install `react-markdown`, `remark-gfm`, `@tailwindcss/typography`
- Create `MarkdownContent` component
- Update `MessageItem` layout (full-width assistant, right-aligned user)
- Create `ScrollAnchor` + `ScrollToBottomButton`
- Update `globals.css` with warm palette
- Refine input area styling + auto-grow textarea

### Phase 2: Activity Chips (post-response metadata)
- Update `MessageListInternal` to fetch `AgentRun` data
- Create `ActivityChips` component
- Wire chips into the new `MessageItem` layout

### Phase 3: Live Pipeline Activity
- Add `pipeline:step` broadcasts to orchestrator
- Create `PipelineActivity` client component
- Subscribe to WS events and render live feed
- Handle fade-out on `pipeline:complete`

## Testing Strategy

- `MarkdownContent`: Unit test rendering of various markdown inputs (bold, code, tables, lists)
- `ScrollAnchor`: Test intersection observer setup and scroll behavior
- `ActivityChips`: Test rendering with various AgentRun data shapes
- `PipelineActivity`: Test WS event handling and step accumulation
- `MessageItem`: Update existing tests for new layout
- `MessageListInternal`: Update existing tests for AgentRun data fetching

## Files Changed

### New Files
- `apps/web/src/app/(chat)/chat/_components/markdown-content.tsx`
- `apps/web/src/app/(chat)/chat/_components/scroll-anchor.tsx`
- `apps/web/src/app/(chat)/chat/_components/scroll-to-bottom-button.tsx`
- `apps/web/src/app/(chat)/chat/_components/activity-chips.tsx`
- `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`
- Tests for each new component

### Modified Files
- `apps/web/src/app/(chat)/chat/_components/message-item.tsx`
- `apps/web/src/app/(chat)/chat/_components/message-list.tsx`
- `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/package.json` (new dependencies)
- `apps/orchestrator/src/orchestrator/index.ts` (pipeline step broadcasts)
