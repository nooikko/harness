# Plan: Search Bar (Semantic + Fuzzy)

## Summary

Implement a global search bar with fuzzy text matching and semantic search across threads, messages, files, and agents. Supports filter syntax (`agent:primary has:file`) for scoped queries. Uses a self-hosted vector search service (Qdrant) for semantic encoding, with PostgreSQL full-text search as the baseline.

## Design Decisions

- **Two-tier search**: PostgreSQL `tsvector` full-text search for instant keyword results + Qdrant for semantic similarity (when the query doesn't match exact keywords)
- **Qdrant for vector search** — aligns with the existing decision for Phase 3 vector search (memory system). One service, multiple use cases.
- **Embedding model**: Use a local model via Ollama (`nomic-embed-text` or `all-minilm`) for zero-cost embeddings. Alternatively, use Anthropic's embedding API if available, or OpenAI `text-embedding-3-small` as fallback.
- **Filter syntax** — parsed client-side into structured query, sent to API. Simple prefix-colon parsing, not a full query language.
- **Cmd+K trigger** — uses the existing `CommandDialog` component from `@harness/ui` (cmdk `^1.1.1` already installed, component at `packages/ui/src/components/command.tsx` with `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`, `CommandFooter`). No new UI scaffolding needed — just wire the existing component to a search API.

## Search Scope

| Entity | Searchable Fields | Filter Prefix |
|--------|------------------|---------------|
| Thread | name | `thread:` |
| Message | content (text kind only) | `in:` (thread name) |
| File | name, extractedText | `has:file`, `file:` |
| Agent | name, slug, soul, identity | `agent:` |
| Project | name, description, instructions | `project:` |
| UserTask | title, description | `task:` |

## Filter Syntax

```
agent:primary has:file quarterly report
└─ filter ─┘ └filter┘ └─ search terms ─┘
```

### Supported Filters

| Filter | Meaning |
|--------|---------|
| `agent:<name>` | Scope to threads owned by this agent |
| `project:<name>` | Scope to threads/files in this project |
| `in:<thread-name>` | Scope to messages in this thread |
| `has:file` | Only results that have file attachments |
| `file:<name>` | Search within file names/content |
| `task:<status>` | Search tasks by status |
| `from:user` / `from:assistant` | Filter messages by role |
| `before:<date>` / `after:<date>` | Date range filter |

Filters are extracted first, remaining text becomes the search query.

## Architecture

```
┌──────────────────┐
│  Cmd+K Palette   │  Client component (cmdk)
│  Input + Results  │
└────────┬─────────┘
         │ POST /api/search
         v
┌──────────────────┐
│  Search API      │  Next.js API route
│  Parse filters   │
│  Fan-out queries │
└───┬────┬────┬────┘
    │    │    │
    v    v    v
   PG   PG  Qdrant
  FTS  Like  ANN
```

### PostgreSQL Full-Text Search (Tier 1 — always available)

Add `tsvector` columns to searchable tables:

```sql
-- Migration: add search vectors
ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;
CREATE INDEX idx_message_search ON "Message" USING GIN ("searchVector");

ALTER TABLE "Thread" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("name", ''))) STORED;
CREATE INDEX idx_thread_search ON "Thread" USING GIN ("searchVector");

ALTER TABLE "File" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("extractedText", ''))) STORED;
CREATE INDEX idx_file_search ON "File" USING GIN ("searchVector");
```

Use `ts_query` with `plainto_tsquery` for keyword search. Rank with `ts_rank_cd`.

### Qdrant Semantic Search (Tier 2 — optional, enhances results)

- **Collection per entity type**: `threads`, `messages`, `files`, `agents`
- **Embedding on write**: When a message/file/thread is created, compute embedding and upsert to Qdrant
- **Search**: Embed the query, search across collections, merge results with FTS results
- **Payload**: Each Qdrant point stores `{ id, type, threadId, preview }` for fast result rendering

### Background Indexing

New plugin: `@harness/plugin-search` with:
- `onMessage` hook — index new messages into Qdrant
- `onPipelineComplete` hook — index assistant responses
- `start` lifecycle — backfill existing content on first boot

## API: Search Route

### `POST /api/search`

```typescript
type SearchRequest = {
  query: string;           // Raw query including filters
  limit?: number;          // Default 20
  offset?: number;         // For pagination
  types?: string[];        // Filter result types: ["thread", "message", "file", "agent"]
};

type SearchResult = {
  type: "thread" | "message" | "file" | "agent" | "project" | "task";
  id: string;
  title: string;           // Display title
  preview: string;         // Text snippet with highlights
  score: number;           // Relevance score (0-1)
  meta: {
    threadId?: string;
    threadName?: string;
    projectName?: string;
    agentName?: string;
    createdAt: string;
  };
};
```

## UI: Cmd+K Command Palette

### Existing Infrastructure (already built)

`@harness/ui` exports a full `CommandDialog` component (cmdk `^1.1.1`):
- `CommandDialog` — modal with Radix animations, upper-center, 520px wide
- `CommandInput` — search field with magnifying glass icon
- `CommandList` — scrollable results (max 300px)
- `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`
- `CommandFooter` — keyboard hints (↵ Select, ↑↓ Navigate, Esc Close)

Import: `import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty, CommandFooter } from "ui"`

**Note:** There's also a separate Lexical-based command/mentions system in `chat/_helpers/command-menu.tsx` for `/slash` commands in the chat input. That's unrelated to global search — don't confuse the two.

### What Needs to Be Built

1. **`search-palette.tsx`** (client component)
   - Wraps existing `CommandDialog` from `@harness/ui`
   - Global keyboard listener for Cmd+K
   - Debounced search (300ms) calls `POST /api/search`
   - Results grouped by type using `CommandGroup` (Threads, Messages, Files, Agents)
   - Filter chip display for active filters

2. **`search-result-item.tsx`** (client component)
   - Type icon, title, preview snippet with match highlights
   - Metadata line (thread name, date, agent)

### Behavior

1. `Cmd+K` (or click search icon in sidebar) opens `CommandDialog`
2. Type to search — debounced 300ms
3. Results grouped by type
4. Keyboard navigation (built into cmdk)
5. Selecting a result:
   - Thread → navigates to `/chat/[thread-id]`
   - Message → navigates to thread, scrolls to message
   - File → opens file preview
   - Agent → navigates to `/agents/[agent-id]`
   - Project → navigates to `/chat/projects/[project-id]`

### Placement

Add the search palette as a global component in the root layout. Add a search icon/button in the sidebar header area.

## Implementation Steps

### Step 1: PostgreSQL Full-Text Search
- Add `searchVector` columns via Prisma migration (raw SQL migration)
- Create search API route with FTS-only implementation
- Parse filter syntax in the API

### Step 2: Cmd+K UI
- Create search palette component using `Command` from `@harness/ui`
- Wire to search API
- Add keyboard shortcut listener
- Add search icon to sidebar
- Result navigation

### Step 3: Qdrant Setup (parallel with Step 2)
- Add Qdrant to `docker-compose.yml` (or instructions for local install)
- Create Qdrant client wrapper package or utility
- Choose and configure embedding model (Ollama `nomic-embed-text`)

### Step 4: Search Plugin
- Create `@harness/plugin-search` with indexing hooks
- `onMessage` → index user messages
- `onPipelineComplete` → index assistant responses
- Backfill script for existing content

### Step 5: Hybrid Search
- Merge FTS + Qdrant results with score normalization
- Dedup across sources
- Rank by combined score

### Step 6: Polish
- Search result highlighting (match terms bolded)
- Recent searches
- Filter chip UI (visual chips for active filters)
- Empty state and loading states

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/database/prisma/migrations/xxx_add_search_vectors.sql` | Create | FTS column + GIN indexes |
| `apps/web/src/app/api/search/route.ts` | Create | Search API endpoint |
| `apps/web/src/app/_components/search-palette.tsx` | Create | Cmd+K command palette |
| `apps/web/src/app/_components/search-result-item.tsx` | Create | Individual result rendering |
| `apps/web/src/app/layout.tsx` | Modify | Add SearchPalette globally |
| `apps/web/src/app/(chat)/chat/_components/thread-sidebar.tsx` | Modify | Add search icon/button |
| `packages/plugins/search/src/index.ts` | Create | Search indexing plugin |
| `docker-compose.yml` | Modify | Add Qdrant service |

## Dependencies

```json
{
  "@qdrant/js-client-rest": "^1.0.0"
}
```

Embedding model: Ollama `nomic-embed-text` (768 dimensions, runs locally, free).

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Qdrant not running → search broken | FTS is tier 1, always works. Qdrant enhances but isn't required. |
| Embedding model quality | Start with nomic-embed-text, benchmark against OpenAI embeddings |
| Large message content exceeding embedding limits | Chunk long messages (512 token windows with overlap) |
| Search latency with fan-out | FTS results return first (fast), Qdrant results merge in async |
| Index drift (content changes but vector stale) | Re-index on message edit (rare), periodic backfill job |
