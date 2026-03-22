# Story Import Workspace — Implementation Plan

**Created:** 2026-03-22
**Status:** Draft — ready for next session
**Depends on:** Story Import Onboarding (Batches 1-5, all complete)
**Replaces:** The CRUD pages from Batches 4-5 (the backend tools and schema stay)

## What This Is

A two-panel IDE-like workspace for importing, reviewing, annotating, and curating story content. Not a set of list pages — a real application.

## Architecture

### Layout: Two-panel workspace

```
┌──────────────────────────────────┬─────────────────────┐
│                                  │                     │
│  Document Viewer (2/3)           │  AI Chat (1/3)      │
│                                  │                     │
│  ┌────────────────────────────┐  │  Context-aware      │
│  │ [Tab: Chat 1] [Chat 2]    │  │  conversation with  │
│  │ [Summary 1] [Summary 2]   │  │  access to all      │
│  │                            │  │  import tools.      │
│  │ Virtualized message scroll │  │                     │
│  │ with selection support     │  │  Knows what you     │
│  │                            │  │  have selected.     │
│  │ ┌──────────────────────┐   │  │                     │
│  │ │ [You] message text   │   │  │  Can run long ops   │
│  │ │                      │   │  │  with progress.     │
│  │ │ [Claude] response... │   │  │                     │
│  │ │  ┌─ annotation ────┐ │   │  │  "Scan all docs     │
│  │ │  │ Your note here  │ │   │  │   for characters"   │
│  │ │  └─────────────────┘ │   │  │                     │
│  │ │                      │   │  │  Progress: 3/5 docs  │
│  │ │ [You] next message   │   │  │  Found: 23 names    │
│  │ └──────────────────────┘   │  │                     │
│  │                            │  │                     │
│  └────────────────────────────┘  │                     │
│                                  │                     │
│  [Import Dashboard: 25 chars,    │  ┌───────────────┐  │
│   340 moments, 5 transcripts]    │  │ Type here...  │  │
│                                  │  └───────────────┘  │
└──────────────────────────────────┴─────────────────────┘
```

### Left Panel: Document Viewer

- **Tab bar** at top: one tab per uploaded transcript/document, ordered by sortOrder
- **Virtualized scroll** (react-virtuoso or @tanstack/virtual) for thousands of messages
- **Message-level selection**: click a message to select it (highlighted), selection state shared with chat
- **Text-range selection**: select specific words within a message, selection shared with chat
- **Inline annotations**: notes, flags, drift markers visible inline below their message
- **Quick actions on hover**: annotate, flag as important, mark as drift
- **Import dashboard** docked at the bottom or as a collapsible section

### Right Panel: AI Chat

- **A story thread** rendered in a sidebar panel — connected to the orchestrator
- **Context injection**: the chat knows:
  - Which transcript/document tab is active
  - Which message is selected (full content)
  - Which text is highlighted within a message
  - Current import stats (characters loaded, moments extracted, etc.)
- **All 16 import tools available** via the storytelling plugin (the agent can call import_characters, detect_duplicates, discover_arc_moments, etc.)
- **Long-running operations**: when the agent kicks off a scan (e.g., "find all character names across all documents"), show a progress indicator in the chat
- **The agent can push back**: "We don't have a field for that" or "That would require a new tool"

### Upload Flow

1. Create story (name + premise)
2. Go to workspace → Upload tab
3. Drag-drop or paste multiple files at once
4. Label each one + set sort order (drag to reorder)
5. Separate sections: "Transcripts" (raw chats) vs "Documents" (curated summaries)
6. All stored as StoryTranscript records with sourceType and sortOrder

### The Curation Cycle

1. Upload everything
2. Tell the AI: "scan all the summary documents and identify every character name"
3. AI loops through documents, extracts names, presents a list
4. You review: confirm, merge duplicates, rename, add missing
5. Tell the AI: "now process all transcripts in order"
6. AI processes each transcript (with character list as context), shows progress
7. You scroll through the viewer, find issues, select messages, tell the AI what to fix
8. Repeat until the canonical timeline is clean

## Technical Requirements

### Virtualization
- react-virtuoso for the message list (handles variable-height items)
- Messages loaded in chunks from the parsed transcript
- Smooth scrolling across 2000+ messages

### Selection State
- `useContext` or Zustand store for workspace state:
  - `activeTranscriptId: string`
  - `selectedMessageIndex: number | null`
  - `selectedText: string | null`
  - `selectedTextRange: { start: number, end: number } | null`
- Shared between document viewer and chat panel
- Chat input can reference: "the selected message says..." or "you highlighted..."

### Chat Panel
- Renders a story thread's messages (the import thread)
- Send message → calls the orchestrator's POST /api/chat endpoint
- The thread is associated with the story (thread.storyId set)
- The storytelling plugin's tools are available because it's a story thread
- Additional context injection via onBeforeInvoke: current selection state

### Progress for Long Operations
- The orchestrator already broadcasts pipeline events via WebSocket
- The chat panel listens for WebSocket events on the import thread
- For multi-step operations (scanning 5 documents), each step broadcasts progress
- UI shows: "Processing document 3/5 — found 47 names so far"

### Schema Addition
```prisma
// Add to StoryTranscript:
sortOrder Int @default(0)
```

## What We Keep From Today

### Backend (all stays)
- 16 MCP tools on the storytelling plugin
- StoryArc, MomentInArc, StoryTranscript, TranscriptAnnotation models
- Soft-delete, provenance tracking, resume support
- All extraction prompts (character, document, transcript, duplicate detection, arc discovery)

### Server Actions (all stay, some need enhancement)
- list-story-moments, list-story-arcs, list-story-transcripts
- get-story-transcript, get-import-stats
- store-story-transcript (needs file upload support)
- save-transcript-annotation, delete-transcript-annotation
- update-story-moment, export-story

### What Gets Replaced
- The current `/stories/[id]/moments` page → becomes a view mode in the left panel
- The current `/stories/[id]/arcs` page → becomes a view mode in the left panel
- The current `/stories/[id]/transcripts` page → becomes the workspace
- The current `/stories/[id]/transcripts/[tid]` page → absorbed into the workspace's tab view

## Route Structure

```
/stories/[id]/workspace    — the main workspace (replaces transcripts/moments/arcs pages)
/stories/[id]              — story detail (keeps import dashboard, links to workspace)
```

## Dependencies

- `react-virtuoso` or `@tanstack/virtual` (need to add to web app)
- WebSocket connection for progress events (already exists via the web plugin)
- Possibly Zustand for workspace state management (or React context)

## Implementation Order (for next session)

1. Schema: add sortOrder to StoryTranscript
2. Workspace layout shell (two-panel, responsive)
3. Document viewer with tab bar + virtualized message list
4. Upload/file management (drag-drop, reorder, label)
5. Selection state (message + text range)
6. Chat panel (render story thread messages, send to orchestrator)
7. Context injection (selection → chat context)
8. Progress indicators for long operations
9. Polish: keyboard shortcuts, scroll-to-message, annotation quick actions
