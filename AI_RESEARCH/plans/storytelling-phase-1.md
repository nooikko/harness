# Storytelling Plugin — Phase 1 Implementation Plan

**Parent plan:** `AI_RESEARCH/2026-03-17-storytelling-plugin-plan.md`
**Goal:** Narrative formatting + OOC `//` support + plugin skeleton. Immediate visual value, no schema migration.

## Requirements

1. Assistant responses in storytelling threads render with visual structure (dialogue badges, action styling, thought bubbles, scene breaks)
2. `//` prefixed user messages render as "director's note" and are wrapped in OOC tags for Claude
3. A thread can be marked as storytelling mode via `Thread.kind = 'storytelling'`
4. The storytelling plugin injects formatting instructions into the prompt for storytelling threads
5. Speaker colors are deterministic from character names (no manual assignment)

## Approach: `Thread.kind = 'storytelling'` (zero migration)

`Thread.kind` already exists as a string field with values like `'general'`, `'cron'`, `'task'`. Adding `'storytelling'` requires:
- One entry in `KIND_INSTRUCTIONS` in prompt-assembler.ts
- One condition in message-item.tsx
- No Prisma migration

## File-by-File Work Breakdown

### Step 1: Plugin Package Skeleton

**Create `packages/plugins/storytelling/package.json`**
- Copy from `packages/plugins/time/package.json`
- Change name to `@harness/plugin-storytelling`
- Dependencies: `@harness/plugin-contract: workspace:*`, `database: workspace:*`

**Create `packages/plugins/storytelling/tsconfig.json`**
- Copy from time plugin

**Create `packages/plugins/storytelling/vitest.config.ts`**
- Copy from time plugin

**Create `packages/plugins/storytelling/src/index.ts`**
```typescript
// Exports: plugin (PluginDefinition)
// Hooks: onBeforeInvoke (inject formatting instructions + OOC wrapping)
// No tools in Phase 1
// No lifecycle (start/stop) in Phase 1
```

The plugin's `onBeforeInvoke`:
1. Query DB for the thread's `kind` field (1 query, lightweight)
2. If `kind !== 'storytelling'`, return prompt unchanged
3. Detect if the user message starts with `//` — query latest user message from DB
4. If OOC: wrap content in `[OUT OF CHARACTER]...[END OOC]` tags
5. Append formatting instructions to the prompt

**Register in `apps/orchestrator/src/plugin-registry/index.ts`**
- Import: `import { plugin as storytellingPlugin } from '@harness/plugin-storytelling';`
- Position in ALL_PLUGINS: after identity, after activity, **after context** (storytelling appends formatting instructions after context has added history — the formatting instructions should be the last thing before Claude reads the message, not buried under conversation history)
- Actually: `onBeforeInvoke` is a chain. Each plugin gets the previous output. The prompt flows: identity (soul) → context (history + files) → storytelling (formatting instructions + OOC). So storytelling should be AFTER context in the array.

```
identityPlugin,       // soul injection
activityPlugin,       // onPipelineStart/Complete (no onBeforeInvoke)
contextPlugin,        // history + files
storytellingPlugin,   // formatting instructions + OOC wrapping  ← HERE
discordPlugin,
...
```

**Add to `apps/orchestrator/package.json`**
- Add `@harness/plugin-storytelling: workspace:*` to dependencies

**Add to `pnpm-workspace.yaml`**
- Verify `packages/plugins/*` glob already covers it (it should)

### Step 2: Plugin Helpers

**Create `packages/plugins/storytelling/src/_helpers/detect-ooc-message.ts`**
```typescript
// Exports: detectOocMessage
// Input: latest user message content (string)
// Output: { isOoc: boolean; content: string }
// Logic: check if content starts with '//' (trimmed)
// If OOC, strip the '//' prefix and return the cleaned content
```

**Create `packages/plugins/storytelling/src/_helpers/wrap-ooc-content.ts`**
```typescript
// Exports: wrapOocContent
// Input: ooc content string
// Output: string wrapped in [OUT OF CHARACTER]...[END OOC] tags
```

**Create `packages/plugins/storytelling/src/_helpers/format-storytelling-instructions.ts`**
```typescript
// Exports: formatStorytellingInstructions
// Input: none (static instructions for Phase 1)
// Output: the formatting instructions string (dialogue, action, thought, scene break conventions)
// In Phase 2 this will accept cast data and produce the full injection
```

### Step 3: Web — Narrative Renderer

**No custom parser needed.** `react-markdown` already parses markdown into an AST. We provide custom `components` that detect narrative patterns in the existing AST nodes and style them differently.

How it maps:
- `**NAME**: "dialogue"` → react-markdown produces `<p>` containing `<strong>NAME</strong>: "dialogue"`. Custom `p` component detects when first child is `<strong>` followed by `: "` → renders as dialogue block with speaker badge.
- `*italic paragraph*` → renders as `<p><em>text</em></p>`. Custom `em` component applies action/description styling (muted color, slight indent).
- `> blockquote` → renders as `<blockquote>`. Custom component applies thought-bubble styling.
- `---` → renders as `<hr>`. Custom component renders decorative scene break divider.
- Everything else → standard prose styling (narration).

This is the same pattern `markdown-content.tsx` already uses for custom `<a>`, `<code>`, and `<pre>` components.

**Create `apps/web/src/app/(chat)/chat/_components/_helpers/character-color-map.ts`**
```typescript
// Exports: getCharacterColor
// Input: character name (string), optional override color (string | null)
// Output: hex color string
//
// 8-color palette (selected for contrast on dark backgrounds):
// const PALETTE = [
//   '#F59E0B', // amber
//   '#3B82F6', // blue
//   '#10B981', // emerald
//   '#EF4444', // red
//   '#8B5CF6', // violet
//   '#EC4899', // pink
//   '#06B6D4', // cyan
//   '#F97316', // orange
// ];
//
// Deterministic assignment:
// 1. If override color is provided and valid hex, return it
// 2. Normalize name: lowercase, trim
// 3. Simple hash: sum of char codes
// 4. Index: hash % PALETTE.length
// 5. Return PALETTE[index]
```

**Create `apps/web/src/app/(chat)/chat/_components/_helpers/detect-dialogue-block.ts`**
```typescript
// Exports: detectDialogueBlock
// Input: React children of a <p> element (ReactNode)
// Output: { isDialogue: false } | { isDialogue: true, speaker: string, emotion?: string, content: ReactNode }
//
// Detection logic (operates on React element tree, not raw text):
// 1. Check if first child is a <strong> element
// 2. Extract text content of the <strong> → that's the speaker name
// 3. Check if the next text sibling contains ': "' (colon + quote)
// 4. Optionally check for <em> between strong and colon → that's the emotion/stage direction
// 5. If all conditions met → return dialogue info
// 6. Otherwise → return { isDialogue: false }
```

**Create `apps/web/src/app/(chat)/chat/_components/narrative-content.tsx`**
```typescript
// Exports: NarrativeContent (React component)
// Props: { content: string }
//
// 'use client';
//
// Approach: render with <Markdown> (react-markdown) using custom components object.
// Uses the same remark-gfm plugin and base styling as MarkdownContent.
// Adds narrative-aware component overrides:
//
// Custom components:
//
// p: (props) => {
//   const dialogue = detectDialogueBlock(props.children);
//   if (dialogue.isDialogue) {
//     const color = getCharacterColor(dialogue.speaker);
//     return (
//       <div className="pl-3 border-l-3 mb-4" style={{ borderColor: color }}>
//         <div className="flex items-center gap-2 mb-1">
//           <span className="text-sm font-semibold" style={{ color }}>{dialogue.speaker}</span>
//           {dialogue.emotion && <span className="text-xs text-muted-foreground italic">({dialogue.emotion})</span>}
//         </div>
//         <div>{dialogue.content}</div>
//       </div>
//     );
//   }
//   return <p {...props} />;  // narration — default rendering
// }
//
// em: (props) => {
//   // Check if this <em> is the ENTIRE paragraph content (action block)
//   // vs inline emphasis within a sentence (normal italic)
//   // Heuristic: if parent is <p> and <em> is the only child → action block
//   // Otherwise → normal inline italic
//   // This is tricky — may need to handle at the <p> level instead
//   return <em className="text-muted-foreground" {...props} />;
// }
//
// blockquote: (props) => (
//   <div className="pl-4 border-l-2 border-muted text-muted-foreground/80 italic mb-4">
//     {props.children}
//   </div>
// )
//
// hr: () => (
//   <div className="flex items-center gap-4 py-4">
//     <div className="flex-1 h-px bg-border" />
//     <span className="text-xs text-muted-foreground/50">✦</span>
//     <div className="flex-1 h-px bg-border" />
//   </div>
// )
//
// Also inherits: custom <a> (safe href), custom <code> (syntax highlight) from MarkdownContent
```

### Step 4: Web — Message Routing

**Modify `apps/web/src/app/(chat)/chat/_components/message-item.tsx`**
- After the `switch(kind)` block, in the `role === 'assistant'` branch:
- Need access to thread kind — this is the question. The message-item component currently receives a `message` prop. It needs to know if the thread is in storytelling mode.

Options:
1. Pass `threadKind` as a prop from the parent (message-list.tsx)
2. Check `message.metadata?.storytelling` (but messages don't carry thread kind)
3. Use React context for thread metadata

**Recommended: prop from parent.** message-list.tsx already has access to the thread. Pass `threadKind` down:

```typescript
// In message-list.tsx, where messages are mapped:
<MessageItem message={msg} threadKind={thread.kind} />

// In message-item.tsx, in the assistant rendering:
if (message.role === 'assistant') {
  if (threadKind === 'storytelling') {
    return (
      <article>
        <NarrativeContent content={message.content} />
      </article>
    );
  }
  return (
    <article>
      <MarkdownContent content={message.content} />
    </article>
  );
}
```

For user messages with `//` prefix:
```typescript
if (message.role === 'user' && threadKind === 'storytelling' && message.content.startsWith('//')) {
  return (
    <div className="text-xs text-muted-foreground italic px-3 py-1 bg-muted/30 rounded">
      <span className="font-medium">Director's note:</span> {message.content.slice(2).trim()}
    </div>
  );
}
```

### Step 5: Prompt Assembler Update

**Modify `apps/orchestrator/src/orchestrator/_helpers/prompt-assembler.ts`**
- Add to `KIND_INSTRUCTIONS`:
```typescript
storytelling: 'You are collaborating on an interactive story. Stay in character, maintain narrative consistency, and follow the formatting conventions provided. When the author sends an out-of-character message (marked with [OUT OF CHARACTER]), acknowledge the direction and continue the story.',
```

### Step 6: Thread Creation UI

**Need a way to create storytelling threads.** For Phase 1, the simplest approach:

**Modify `apps/web/src/app/(chat)/chat/_actions/create-thread.ts`**
- Accept optional `kind` parameter (default 'general')
- Pass through to `prisma.thread.create({ data: { ..., kind } })`

**UI trigger:** Add a small option when creating a new thread. Could be:
- A dropdown/toggle in the new chat area
- A `/storytelling` command that creates a thread with kind='storytelling'
- For Phase 1, the simplest: a button or toggle next to the "New Chat" button

Exact UI TBD based on what feels right — the backend just needs `kind: 'storytelling'` set on creation.

## Test Plan (Phase 1)

### `packages/plugins/storytelling/src/__tests__/index.test.ts`
1. Plugin has correct name ('storytelling') and version
2. Register returns hooks with onBeforeInvoke defined
3. onBeforeInvoke: returns prompt unchanged for non-storytelling threads
4. onBeforeInvoke: appends formatting instructions for storytelling threads
5. onBeforeInvoke: wraps `//` user message in OOC tags for storytelling threads
6. onBeforeInvoke: passes `//` through without OOC wrapping for non-storytelling threads

### `packages/plugins/storytelling/src/_helpers/__tests__/detect-ooc-message.test.ts`
1. Detects `// some text` as OOC, returns cleaned content
2. Detects `//some text` (no space) as OOC
3. Returns isOoc=false for normal messages
4. Returns isOoc=false for messages containing // mid-text
5. Handles empty string after //
6. Trims whitespace from cleaned content

### `packages/plugins/storytelling/src/_helpers/__tests__/wrap-ooc-content.test.ts`
1. Wraps content in [OUT OF CHARACTER]...[END OOC] tags
2. Preserves content exactly (no trimming, no modification)
3. Handles multi-line content

### `packages/plugins/storytelling/src/_helpers/__tests__/format-storytelling-instructions.test.ts`
1. Returns non-empty string
2. Contains key formatting conventions (dialogue, action, thought, scene break)
3. Contains example markup

### `apps/web/src/app/(chat)/chat/_components/_helpers/__tests__/detect-dialogue-block.test.ts`
1. Detects `<strong>NAME</strong>: "dialogue"` children → returns isDialogue with speaker
2. Detects `<strong>NAME</strong> <em>(emotion)</em>: "dialogue"` → returns speaker + emotion
3. Detects hyphenated names: `<strong>MARY-JANE</strong>: "text"` → speaker is "MARY-JANE"
4. Returns isDialogue=false for `<strong>bold text</strong> without colon-quote pattern`
5. Returns isDialogue=false for empty children
6. Returns isDialogue=false for plain text children (no strong element)

### `apps/web/src/app/(chat)/chat/_components/_helpers/__tests__/character-color-map.test.ts`
1. Same name returns same color (deterministic)
2. Case insensitive: 'SAM', 'Sam', 'sam' → same color
3. Different names return colors (at least 5 distinct names → at least 3 distinct colors)
4. Returns valid hex format (#RRGGBB)
5. Override color is used when provided
6. Invalid override color (not hex) falls back to hash
7. Null override falls back to hash
8. Palette wraps: many names don't error

### `apps/web/src/app/(chat)/chat/_components/__tests__/narrative-content.test.tsx`
1. Renders `**SAM**: "hello"` with colored left border and speaker badge
2. Speaker badge color matches getCharacterColor("SAM")
3. Renders `**SAM** *(hesitant)*: "hello"` with emotion tag showing "(hesitant)"
4. Renders `*She paused.*` with muted/italic styling (em component)
5. Renders `> I can't do this` with thought-bubble blockquote styling
6. Renders `---` as decorative scene break divider (not plain hr)
7. Renders plain paragraph as standard prose (no special styling)
8. Renders full mixed response (dialogue + action + thought + break + narration) in correct order
9. Content with no narrative patterns renders same as MarkdownContent
10. Preserves inline markdown within dialogue text (links, code, etc.)

## Dependencies

- No new npm packages needed
- `react-markdown` and `remark-gfm` already available
- Plugin follows existing package structure exactly
- Vitest already configured across the monorepo

## Risks

| Risk | Mitigation |
|------|-----------|
| Parser regex is too strict/loose | Extensive test coverage with real examples; falls back to narration on no match |
| Claude doesn't follow formatting conventions | Good instructions + examples; renderer degrades gracefully to plain markdown |
| `threadKind` prop threading gets messy | Simple string prop, one level of passing |
| Performance of parsing on long responses | Regex per paragraph is O(n) — fast even for 100 paragraphs |

## Implementation Order

1. Plugin package skeleton (package.json, tsconfig, vitest config)
2. Plugin helpers (detect-ooc, wrap-ooc, format-instructions) + tests
3. Plugin index.ts (onBeforeInvoke) + tests
4. Register plugin in orchestrator
5. Web: character-color-map + tests
6. Web: detect-dialogue-block + tests
7. Web: narrative-content.tsx (custom components for react-markdown) + tests
8. Web: modify message-item.tsx + message-list.tsx for storytelling routing
9. Prompt assembler: add KIND_INSTRUCTIONS entry
10. Thread creation: accept kind parameter
11. Integration test: create storytelling thread → send message → verify formatting instructions injected

Steps 1-4 are the backend. Steps 5-8 are the frontend. Steps 9-11 are wiring. Each step is independently testable.

**WAITING FOR CONFIRMATION**: Ready to start implementation?
