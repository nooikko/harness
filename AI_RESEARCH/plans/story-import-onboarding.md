# Story Import Onboarding — Implementation Plan

**Created:** 2026-03-22
**Status:** Draft — awaiting user confirmation
**Depends on:** Storytelling Phase 2 (complete)

## Why This Exists

The storytelling plugin exists because **Claude drifts**. After hundreds of messages, it re-invents scenes that already happened, adds phantom characters, forgets relationship milestones, and changes established details. The entire system is a canonical memory — the authoritative record of what actually happened in the story.

The import process establishes this ground truth. But the source transcripts themselves ALREADY contain drift — the same event told twice with different details, wrong character counts, details that shifted between tellings. The import must not only extract events but also **deduplicate, correct, and canonicalize** them. Once imported, the moment timeline is THE truth that prevents future drift.

## Context

Import an existing collaborative story into Harness from Claude.ai chat transcripts and day-by-day summary documents. The story is deeply personal therapeutic work — six core volleyball characters represent parts of the user's inner self. Fidelity is the top priority. Losing texture, emotional nuance, or relationship dynamics is unacceptable.

### Source Material
- **4-5 Claude.ai chat transcripts** — sequential continuations of the same story (split because Claude gets slow after ~400 messages). Human/Assistant alternating format, but within Assistant messages, multiple characters are voiced in narrative prose.
- **Day-by-day summary documents** — structured markdown, ~10 sections each with 20-30 bullet points + sub-bullets. Cover story events but miss nuanced character development.
- **Character profiles** — existing personality profiles for all characters.

### Scale
- ~25 distinct characters (6 core + ~19 supporting)
- ~15 locations
- Multi-day timeline
- Scenes with up to 10 simultaneous characters
- Summaries: 10-15 documents
- Transcripts: 4-5 chats × 400+ messages each = 2000+ total messages

### Key Requirement: Story Arcs
Moments don't just exist in isolation — they form narrative threads that span days and involve multiple characters. Example: "discovering mom's grave" is an arc involving 7+ characters across multiple scenes, with a private moment at the gravestone and then the group breaking through her isolation. The system must support grouping moments into named arcs, and AI-assisted discovery of related moments across all transcripts.

---

## Architecture

### Conversation-driven import via storytelling MCP tools

All LLM processing goes through the orchestrator's `ctx.invoker`. No direct Anthropic SDK calls. The import happens in a story thread — the user pastes content, the agent processes it via MCP tools, reports findings, and the user corrects.

### Web UI for annotation and review

The conversational flow handles ingestion. The web UI handles the days-long review process — browsing moments, building arcs, correcting attributions, linking related events. This is the primary work interface, not a quick confirmation step.

---

## Phase 1: Schema Additions

### 1a. StoryArc model (NEW)

A named narrative thread connecting related moments across time and characters.

```prisma
model StoryArc {
  id          String        @id @default(cuid())
  storyId     String
  story       Story         @relation(fields: [storyId], references: [id], onDelete: Cascade)
  name        String
  description String?       @db.Text
  status      ArcStatus     @default(building)    // enum: building, climaxed, resolved, dormant
  importance  Int           @default(5) // 1-10
  annotation  String?       @db.Text // User's notes on why this arc matters
  moments     MomentInArc[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([storyId, name])
  @@index([storyId, status])
}

model MomentInArc {
  id        String      @id @default(cuid())
  arcId     String
  arc       StoryArc    @relation(fields: [arcId], references: [id], onDelete: Cascade)
  momentId  String
  moment    StoryMoment @relation(fields: [momentId], references: [id], onDelete: Cascade)
  position  Float       @default(0) // ordering within arc — float for insert-between support
  note      String?     @db.Text // Why this moment belongs in this arc

  @@unique([arcId, momentId])
  @@index([arcId, position])
  @@index([momentId])
}
```

A moment can belong to multiple arcs (many-to-many via MomentInArc). Each link has an optional note explaining why it belongs. Position allows ordering within an arc.

### 1b. StoryTranscript model (NEW)

Stores imported transcripts for cross-referencing and re-scanning.

```prisma
model StoryTranscript {
  id              String        @id @default(cuid())
  storyId         String
  story           Story         @relation(fields: [storyId], references: [id], onDelete: Cascade)
  label           String        // "Chat 1", "Chat 2", etc.
  sourceType      String        @default("claude") // claude, document, manual
  rawContent      String        @db.Text
  processed       Boolean       @default(false)
  processedThrough Int?         // Last chunk index successfully processed (for resume)
  totalChunks     Int?          // Total chunk count (set after initial parse)
  messageCount    Int?          // Number of parsed messages (after labeling)
  moments         StoryMoment[] // Back-relation to extracted moments
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([storyId])
}
```

Transcripts are stored persistently so the AI can re-scan them during arc discovery. Not ephemeral. The `processedThrough` field enables safe resume after failures — chunks ≤ processedThrough are skipped on retry.

### 1c. StoryMoment enhancements

```prisma
// Existing StoryMoment — add:
  arcs               MomentInArc[]          // Back-relation to arcs
  sourceTranscriptId String?                // Which transcript this was extracted from
  sourceTranscript   StoryTranscript?       @relation(fields: [sourceTranscriptId], references: [id], onDelete: SetNull)
  sourceChunkIndex   Int?                   // Which chunk within the transcript (for idempotent re-runs)
  sourceNotes        String?     @db.Text   // Provenance trail: "Extracted from [Day 3-5 summary]. Enriched from [Chat 1, chunk 8]."
  annotation         String?     @db.Text   // User's notes ONLY — agent never writes this field
  deletedAt          DateTime?              // Soft-delete for merge safety (null = active)
  mergedIntoId       String?                // Points to the canonical moment this was merged into

  @@index([sourceTranscriptId, sourceChunkIndex])
```

**Soft-delete (C3 fix):** `merge_moments` sets `deletedAt` + `mergedIntoId` instead of hard-deleting. All queries filter `deletedAt IS NULL`. A `restore_moment` tool can undo merges during the review period. Hard cleanup happens only after the user explicitly confirms the canonical timeline is finalized.

**Resume safety (C1 fix):** `sourceTranscriptId` + `sourceChunkIndex` together enable idempotent re-runs. If chunk 22 fails, chunks 1-21 are already recorded and will be skipped on retry.

### 1d. CharacterInMoment enhancements

```prisma
// Existing CharacterInMoment — add:
  relationshipContext String? @db.Text // How this moment affects relationships
```

### 1e. StoryCharacter enhancements

```prisma
// Existing StoryCharacter — add:
  importNotes String? @db.Text // Raw context that doesn't fit structured fields
```

### 1f. Story relation additions

```prisma
// Existing Story — add:
  arcs        StoryArc[]
  transcripts StoryTranscript[]
```

**Files:**
- `packages/database/prisma/schema.prisma`
- Migration via `pnpm --filter database db:migrate`

**Tests:**
- Basic CRUD for StoryArc, MomentInArc, StoryTranscript (integration tests)

---

## Phase 2: Import MCP Tools

Six new tools on the storytelling plugin. All use `ctx.invoker` for LLM calls.

### Tool 1: `import_characters`

Bulk-create characters from pasted profiles.

- **Input:** `{ text: string }` — text blob containing character profiles (any format)
- **Process:**
  1. Load existing characters for the story
  2. Build prompt: "Here are character profiles. Extract structured data for each."
  3. `ctx.invoker` call (Sonnet for fidelity) → structured character data
  4. Upsert StoryCharacter records (merge with existing if name matches)
- **Output:** Summary of characters created/updated
- **Prompt priority:** Preserve personality nuance. Don't flatten. If a profile says "she hides vulnerability behind sarcasm but melts when someone sees through it" — that exact texture goes into personality, not "sarcastic but vulnerable."

### Tool 2: `import_document`

Process a summary document to extract moments, locations, character developments.

- **Input:** `{ text: string, label?: string }` — document text + optional label (e.g., "Days 1-3")
- **Process:**
  1. Store as StoryTranscript record (sourceType: "document")
  2. Load existing world state (characters, locations, recent moments)
  3. If document exceeds ~6K tokens, split by section headers
  4. For each chunk: `ctx.invoker` call (Sonnet) → extraction JSON
  5. Parse with Zod, apply to DB (characters, moments, locations)
  6. Carry forward world state between chunks
- **Output:** "Extracted N moments, N locations, updated N characters. Key events: [list]"
- **Prompt priority:** Extract at the granularity of emotional beats, not plot events.

### Tool 3: `import_transcript`

Process a stored Claude.ai chat transcript. The transcript must be stored first via the web UI's `store-story-transcript` server action — the tool takes a reference, not raw text (C4 fix: avoids MCP tool input size limits).

- **Input:** `{ transcriptId: string }` — ID of a StoryTranscript record already stored in the DB
- **Process:**
  1. Load StoryTranscript record, verify it belongs to the current story
  2. Parse Human/Assistant message boundaries (Claude.ai format)
  3. Set `totalChunks` on the transcript record
  4. Chunk into segments of ~10-15 message pairs (with overlap)
  5. Skip chunks ≤ `processedThrough` (resume safety — C1 fix)
  6. For each chunk:
     a. Load existing characters + current world state
     b. **Include recent extracted moments as "watch for re-tellings" context** (H2 fix)
     c. `ctx.invoker` call (Sonnet) → extraction JSON
     d. Parse, apply to DB with `sourceTranscriptId` + `sourceChunkIndex` on each moment
     e. Update `processedThrough` on the transcript record
     f. Report progress: "Processed chunk 5/30 (messages 61-90). Found: [key events]"
  7. After all chunks: mark transcript as `processed: true`
- **Output:** Summary of full transcript extraction + flagged uncertainties + flagged potential re-tellings
- **Prompt design for narrative prose:**
  - Input includes the character list so Sonnet knows who's in the story
  - Handles implicit speaker attribution ("she said" → resolve from context)
  - Distinguishes: dialogue, action, internal thought, scene description
  - Captures multi-character scenes (up to 10 participants)
  - Notes relationship dynamics, not just plot events

**Chunking strategy:**
- Split by message pairs (Human + Assistant = 1 unit), not mid-message
- ~10-15 pairs per chunk (~8K tokens)
- 2-pair overlap for context continuity
- Each chunk includes: existing character list, current scene state, previous chunk's last few events

### Tool 4: `detect_duplicates`

AI-powered duplicate/drift detection across imported moments.

- **Input:** `{ scope?: string }` — optional: a storyTime range ("Day 7-11"), a character name, or "all"
- **Process:**
  1. Load moments in scope. **Auto-paginates if > 50 moments** (C2 fix): splits into time-window batches and processes each separately
  2. Group by similarity: same characters + similar summary + overlapping storyTime
  3. `ctx.invoker` call (Sonnet) per batch — "Which of these describe the same event? Which is the canonical version? What details differ?"
  4. Return candidate duplicate pairs with analysis
- **Output:** "Found N potential duplicates in [scope]. [For each pair: which version has correct details, what differs, recommendation]"
- **Key behavior:** Does NOT auto-merge. Returns analysis for user review. User says "keep version A, discard B" or "merge: take the day from A but the dialogue from B."
- **Default scope:** If no scope provided, processes by time window (Day 1-3, Day 4-6, etc.) to stay within context limits. Cross-window duplicates (Day 8 vs Day 11) are caught with a second pass that compares high-importance moments across windows.

This is critical because the transcripts already contain drift — Claude re-invented the driver's realization scene on day 11 that already happened on day 8. Both versions got extracted. The user needs to pick the canonical one.

### Tool 5: `merge_moments`

Merge two duplicate moments into one canonical version. Uses soft-delete — the discarded moment is recoverable (C3 fix).

- **Input:** `{ keepId: string, discardId: string, transferPerspectives?: boolean }`
- **Process:**
  1. If `transferPerspectives` (default true): copy CharacterInMoment records from discarded → kept, skipping characters already present on kept
  2. Reassign arc links: for each MomentInArc on discarded, check if kept already has a link to the same arc (H1 fix). If yes, drop the duplicate link (keep the one with a note). If no, reassign to kept.
  3. Soft-delete the discarded moment: set `deletedAt = now()`, `mergedIntoId = keepId`. Do NOT hard-delete.
  4. Append to kept moment's `sourceNotes`: "Merged with [discarded summary] on [date]"
- **Output:** Confirmation of what was merged + what perspectives were transferred
- **Use cases:**
  - "The day 8 driver scene is canonical, discard the day 11 re-telling"
  - "Keep A but take Mei's perspective from B — she was described better there"

### Tool 5b: `restore_moment`

Undo a merge or soft-delete. Safety net for the review process.

- **Input:** `{ momentId: string }`
- **Process:** Clear `deletedAt` and `mergedIntoId`. Does NOT reverse perspective transfers (those are additive, not destructive).
- **Output:** Confirmation that the moment is restored
- **Use case:** "I realized Day 11 was actually a separate scene, not drift — restore it"

### Tool 6: `create_arc`

Create a story arc and optionally seed it with moments.

- **Input:** `{ name: string, description?: string, momentIds?: string[], annotation?: string }`
- **Process:** Create StoryArc + MomentInArc records
- **Output:** Arc created with N moments

### Tool 7: `discover_arc_moments`

AI-powered arc discovery. Two-phase: fast search of extracted moments, then optional deep scan of raw transcripts (H3 fix).

- **Input:** `{ arcId: string, guidance?: string, deepScan?: boolean }` — the arc to expand + optional guidance + whether to scan raw transcripts
- **Process — Phase 1 (fast, always runs):**
  1. Load the arc's existing moments (the seed examples)
  2. Load the arc's description + user annotation
  3. Load ALL extracted StoryMoments for the story (paginated if > 100, filtered `deletedAt IS NULL`)
  4. Single `ctx.invoker` call (Sonnet): "Given this arc, which of these existing moments are related?"
  5. Returns candidates with explanations — typically takes < 1 minute
- **Process — Phase 2 (slow, only if `deepScan: true`):**
  6. Load ALL StoryTranscript records
  7. For each transcript, chunk and scan:
     a. Build prompt: "Given this arc, scan for moments NOT already captured in the extracted timeline"
     b. `ctx.invoker` call (Sonnet) → new discoveries only
  8. **Time estimate: 20-45 minutes per full scan.** Agent should warn the user before starting.
  9. New discoveries are created as StoryMoment records with `annotation: "[AI-suggested for arc: {arcName}]"`
- **Output:** "Phase 1 found N existing moments related to this arc. [list]. [If deepScan: Phase 2 found N new moments from raw transcripts.]"
- **Key behavior:** Returns suggestions, doesn't auto-link. The user reviews and says "yes to 1, 3, 5, no to 2 and 4."

### Tool 8: `correct_moment`

Fix specific details on a moment. Simpler than `merge_moments` for quick corrections.

- **Input:** `{ momentId: string, corrections?: Record<string, string | number>, removeCharacters?: string[], addCharacters?: { name: string, role: string }[] }`
- **Process:** Apply field corrections, remove phantom CharacterInMoment records, add missing characters
- **Output:** Updated moment summary
- **Use cases:**
  - "There were 11 people, not 13" → remove 2 CharacterInMoment records by name
  - "This happened on Day 8, not Day 11" → fix storyTime
  - "Mei was actually there but wasn't mentioned" → add CharacterInMoment

### Tool 9: `annotate_moment`

Add user annotation to a moment and optionally link it to arcs.

- **Input:** `{ momentId: string, annotation?: string, arcNames?: string[] }`
- **Process:** Update moment annotation, create MomentInArc links
- **Output:** Confirmation

**Files:**
- `packages/plugins/storytelling/src/_helpers/tool-import-characters.ts`
- `packages/plugins/storytelling/src/_helpers/tool-import-document.ts`
- `packages/plugins/storytelling/src/_helpers/tool-import-transcript.ts`
- `packages/plugins/storytelling/src/_helpers/tool-detect-duplicates.ts`
- `packages/plugins/storytelling/src/_helpers/tool-merge-moments.ts`
- `packages/plugins/storytelling/src/_helpers/tool-create-arc.ts`
- `packages/plugins/storytelling/src/_helpers/tool-discover-arc-moments.ts`
- `packages/plugins/storytelling/src/_helpers/tool-correct-moment.ts`
- `packages/plugins/storytelling/src/_helpers/tool-annotate-moment.ts`
- `packages/plugins/storytelling/src/_helpers/chunk-transcript.ts` — splits Claude.ai transcripts by message pairs
- `packages/plugins/storytelling/src/_helpers/chunk-document.ts` — splits summary docs by section headers
- `packages/plugins/storytelling/src/_helpers/build-import-extraction-prompt.ts` — shared prompt builder for import extraction
- `packages/plugins/storytelling/src/_helpers/build-arc-discovery-prompt.ts` — prompt for scanning transcripts for arc-related moments
- `packages/plugins/storytelling/src/_helpers/build-duplicate-detection-prompt.ts` — prompt for finding duplicate/drifted moments
- `packages/plugins/storytelling/src/_helpers/tool-restore-moment.ts`
- `packages/plugins/storytelling/src/_helpers/resolve-story-id.ts` — shared helper: storyCache with DB fallback (H4 fix — all tool handlers use this instead of raw cache access)
- `packages/plugins/storytelling/src/index.ts` — register 10 new tools (total: 16)

**Tests:**
- Each tool handler gets a test file in `_helpers/__tests__/`
- Prompt builders get separate tests
- Chunking logic gets tests (boundary handling, overlap)
- Merge logic gets tests (CharacterInMoment transfer, arc link reassignment, duplicate deletion)

---

## Phase 3: Import Prompt Engineering

The quality of the import lives or dies here. These prompts determine whether "Violet cried at the gravestone while the girls watched, then went to hold her" survives as that — or gets flattened to "the group visited the cemetery."

### Import Extraction Prompt (for documents + transcripts)

The prompt must instruct Sonnet to:

1. **Extract at emotional-beat granularity** — not "the team practiced" but "during practice, Kai noticed Violet struggling with serves and quietly showed her the grip without making a big deal of it, which was the first time anyone helped Violet without expecting something back"

2. **Capture multi-character dynamics** — for each moment, every character present gets a CharacterInMoment with:
   - Their role (not just "witness" — "the one who noticed first", "the one who pretended not to see because she doesn't know how to comfort people")
   - Their perspective (what this meant to them specifically)
   - Emotional impact (how it changed them)
   - Relationship context (how this shifted their relationship with others in the scene)

3. **Preserve the specific** — "under the streetlight" not "outside". "She whispered" not "she said". The concrete details are what make moments real.

4. **Flag uncertainties** — "This might be two separate scenes merged in the summary" or "Unclear if Mei was present here"

5. **Track relationship shifts** — when a moment changes how two characters relate, note it explicitly

6. **Detect drift** — when processing later transcripts, compare against already-extracted moments. If a scene looks like a re-telling of something that already happened (same characters, same emotional beat, different day), flag it: "This looks like it might be the AI re-inventing the driver lunch scene from Day 8. Compare with existing moment [ID]." This is the most important extraction instruction — drift detection during import prevents bad data from entering the canonical timeline.

7. **Count characters precisely** — note exactly who is present in each scene. If the text says "the girls" without naming them, flag it rather than guessing. Phantom characters (mentioned as present but not doing anything) should be flagged for user review.

### Arc Discovery Prompt

The prompt must:
1. Understand the arc's theme from description + seed moments
2. Look for: direct references, thematic parallels, character behavior that connects, foreshadowing, callbacks
3. Explain WHY each candidate is related (not just "mentions the grave" but "this is when she first hinted that she doesn't know where her mother is buried, which is the seed of the arc")
4. Rate confidence on each suggestion

### Transcript Speaker Attribution

For narrative prose within Claude's Assistant messages:
1. Provide the full character list with personality summaries
2. Use paragraph structure + dialogue tags + pronoun resolution
3. When ambiguous, use personality/voice as disambiguation ("this sounds like Suki's speech pattern")
4. Flag truly ambiguous passages for user review

---

## Phase 4: Web UI — Annotation & Review Interface

This is the primary work interface for days of review. It needs to be good.

### 4a. Moment Browser

The core review tool. A searchable, filterable, chronological view of all extracted moments.

**Features:**
- Chronological timeline (by storyTime)
- Filter by character (show moments involving Violet)
- Filter by character pair (Violet + Kai moments)
- Filter by location
- Filter by arc (show all moments in "Suki's Mother" arc)
- Filter by importance (high-importance moments only)
- Text search across moment summaries/descriptions
- Color-coded character badges on each moment card
- Expandable detail: click to see all CharacterInMoment perspectives
- Inline annotation: add notes to any moment
- Arc linking: select moments → "Add to arc" / "Create new arc"

**Multi-select mode:**
- Checkbox on each moment card
- Bulk actions: "Add selected to arc", "Create arc from selected", "Discover related moments"
- The "Discover related" action calls `discover_arc_moments` with the selected moments as seeds

**Components:**
- `apps/web/src/app/(chat)/stories/[storyId]/moments/page.tsx` — moment browser route
- `apps/web/src/app/(chat)/stories/[storyId]/moments/_components/moment-timeline.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/moments/_components/moment-card.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/moments/_components/moment-filters.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/moments/_components/character-pair-filter.tsx`

### 4b. Arc Editor

View and manage story arcs with their connected moments.

**Features:**
- Arc list sidebar (grouped by status: building, climaxed, resolved, dormant)
- Arc detail view: description, annotation, linked moments in order
- Drag to reorder moments within an arc
- Annotation field on each arc (why this arc matters)
- "Discover more" button → triggers AI scan of transcripts
- Suggestion queue: AI-discovered moments awaiting confirmation (accept/reject each)

**Components:**
- `apps/web/src/app/(chat)/stories/[storyId]/arcs/page.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/arcs/_components/arc-list.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/arcs/_components/arc-detail.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/arcs/_components/arc-suggestion-queue.tsx`

### 4c. Character Relationship View

On the existing character detail card, add a "Relationships" tab.

**Features:**
- Grid of other characters, sorted by shared moment count
- Click a pair → chronological view of their shared moments
- Shows how the relationship evolved over time (the moments ARE the history)
- Highlights moments where relationship dynamics shifted

**Components:**
- `apps/web/src/app/(chat)/chat/_components/character-relationships.tsx`

### 4d. Transcript Viewer

View stored transcripts with moment markers overlaid.

**Features:**
- Scrollable transcript with color-coded speakers
- Extracted moments highlighted inline (where in the transcript they came from)
- Click a highlight → shows the corresponding StoryMoment
- Unlinked passages are visible (transcript sections that produced no moments)
- "This is important" button on any passage → sends to the agent for extraction

**Components:**
- `apps/web/src/app/(chat)/stories/[storyId]/transcripts/page.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/transcripts/_components/transcript-viewer.tsx`
- `apps/web/src/app/(chat)/stories/[storyId]/transcripts/_components/transcript-highlight.tsx`

### 4e. Import Progress Dashboard

Overview of import status.

- Characters loaded: 25/25
- Transcripts stored: 5/5 (3 processed, 2 pending)
- Documents processed: 12/12
- Moments extracted: 340
- Arcs identified: 8
- Moments needing review: 47 (low-confidence extractions)

**Component:**
- `apps/web/src/app/(chat)/stories/[storyId]/_components/import-dashboard.tsx`

### Server Actions (supporting all UI)

- `list-story-moments.ts` — paginated, filterable moment query
- `update-story-moment.ts` — edit moment fields + annotation
- `list-story-arcs.ts` — arcs with moment counts
- `create-story-arc.ts` — create arc from UI
- `update-story-arc.ts` — edit arc, reorder moments
- `add-moments-to-arc.ts` — link moments to arc
- `remove-moment-from-arc.ts`
- `list-story-transcripts.ts`
- `store-story-transcript.ts` — upload/paste transcript to storage
- `list-character-shared-moments.ts` — moments involving a character pair

**Directory:**
- `apps/web/src/app/(chat)/stories/[storyId]/_actions/`

---

## Phase 5: Transcript Export from Claude.ai

The user needs to get full transcripts out of Claude.ai. Options to investigate:

1. **Claude.ai export feature** — Check if Claude has a conversation export (Settings → Data)
2. **Browser console** — The Claude.ai frontend likely stores conversation data in accessible state
3. **Claude API conversation history** — If the user has API access, conversations may be retrievable
4. **Manual copy-paste** — Fallback. Tedious for 400+ messages but works with "Select All" on the conversation
5. **Browser extension / bookmarklet** — Scrape the rendered conversation DOM into Human/Assistant pairs

This is a research task, not an implementation task. We'll figure out the best method when it's time.

---

## Phase 6: The Actual Import Workflow

What the user does, step by step.

### Step 1: Create the story
- Via web UI or conversation: create Story with name and premise
- Open a story thread for the import work

### Step 2: Load character profiles
- Paste character profiles (all at once or in batches)
- Agent calls `import_characters`, creates StoryCharacter records
- Agent reports what it has for each character
- User corrects: "No, Suki isn't timid — she's guarded. There's a difference."
- Agent updates

### Step 3: Process summary documents (chronologically)
- Paste first summary doc ("Days 1-3")
- Agent calls `import_document`, extracts moments/locations/character updates
- Agent reports: "I extracted 28 moments across 4 locations. Key events: [list]"
- User reviews in conversation, corrects major errors
- Repeat for each document
- The agent accumulates world state — each doc adds context for the next

### Step 4: Process full transcripts
- User provides transcripts (via paste, upload, or export method from Phase 5)
- Agent calls `import_transcript` for each
- This is the long step — each transcript takes multiple invoker calls
- Agent reports progress and key findings per chunk
- Agent flags: "Found scenes not in any summary doc: [list]"
- User reviews, confirms or corrects

### Step 5: Cross-reference and fill gaps
- Agent compares summary-extracted moments vs transcript-extracted moments
- Identifies gaps: "The summary mentions Violet's breakdown on Day 7, but I didn't find it in the transcripts. Which chat would that be in?"
- Identifies enrichments: "The summary says 'Kai comforted Violet' but the transcript shows a 15-message scene with specific dialogue. I've enriched the moment with the full detail."

### Step 5.5: Canonicalize the timeline (CRITICAL)
- Agent calls `detect_duplicates` across the full moment set
- Reports: "Found 12 potential duplicate pairs. The driver lunch scene appears on Day 8 (from Chat 1) AND Day 11 (from Chat 3) — the Day 11 version looks like AI drift."
- User reviews each pair:
  - "Yes, Day 8 is canonical. The Day 11 version is drift — discard it."
  - "These are actually two different scenes — keep both."
  - "Merge these: the Day 3 version has the right timeline but the Day 5 version captured the dialogue better."
- Agent calls `merge_moments` or deletes as directed
- User goes through flagged character count issues:
  - "The text says 13 people but only 11 characters are named — remove the two phantom entries"
  - "Mei WAS there, she just wasn't mentioned. Add her as a witness."
- Agent calls `correct_moment` for each fix
- **This step produces the canonical timeline.** Every moment that survives this step is ground truth. The ongoing storytelling system treats it as authoritative.

### Step 6: Build story arcs (the days-long review)
- User opens the Moment Browser in the web UI
- Browses chronologically, finding moments that connect
- Selects a few moments → "Create arc: Suki's Mother"
- Adds annotation: "This is about Suki learning someone knows where her mom is buried and eventually visiting the grave. It's her biggest emotional breakthrough."
- Clicks "Discover more" → agent scans all transcripts
- Agent returns: "Found 15 candidates. [list with explanations]"
- User accepts/rejects each
- Repeat for each arc

### Step 7: Deep annotation
- User goes through high-importance moments
- Adds notes: "This is where everything changed for Violet"
- Links moments across arcs: a moment can be in "Suki's Mother" AND "The Team Learning Trust"
- Corrects CharacterInMoment perspectives: "Mei wasn't indifferent here — she was afraid to show she cared"

### Step 8: Verification
- User reviews character profiles (should now be rich from all extracted trait updates)
- Reviews character pair relationships (do the shared moments tell the right story?)
- Reviews location map (are all locations and their relationships correct?)
- Reviews timeline continuity

### Step 9: Continue the story
- Create a new thread in the story
- Agent generates a recap from all the imported data
- Start writing

---

## Implementation Order

Priority is getting the import pipeline working so the user can start loading content. The review UI can iterate based on what they actually need once data is in.

### Batch 1: Foundation (get data in)
1. Schema additions (Phase 1) — all new models and fields
2. `import_characters` tool
3. `import_document` tool
4. `import_transcript` tool
5. `store-story-transcript` server action (paste/upload transcripts to storage)

### Batch 1.5: JSON export (safety net before destructive operations)
- Basic export server action: dump Story + Characters + Moments + Arcs to a JSON file
- This MUST exist before the user starts merging/correcting (L4 elevated to blocking)

### Batch 2: Canonicalization (fix the drift)
6. `detect_duplicates` tool (with auto-pagination)
7. `merge_moments` tool (soft-delete)
8. `restore_moment` tool (undo merges)
9. `correct_moment` tool

### Batch 3: Arc system (the review framework)
9. `create_arc` tool
10. `discover_arc_moments` tool
11. `annotate_moment` tool
12. Basic moment browser UI (list + filter + search)

### Batch 4: Review UI (the primary work interface)
13. Arc editor UI
14. Character relationship view
15. Transcript viewer with moment overlays
16. Import progress dashboard

### Batch 5: Polish
17. Multi-select + bulk actions in moment browser
18. Drag-reorder in arc editor
19. Suggestion queue for AI-discovered moments
20. Transcript export research/tooling

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Drift-contaminated moments enter canonical timeline | **CRITICAL** | `detect_duplicates` + `merge_moments` in Step 5.5. Extraction prompt explicitly instructs Sonnet to flag re-tellings. User reviews every potential duplicate. The entire point of the system is preventing this. |
| Moments lose emotional specificity during extraction | **CRITICAL** | Sonnet (not Haiku) for all import extraction. Prompts explicitly demand emotional beats + specifics. User review after each doc/transcript. |
| Character voice/personality flattened | **CRITICAL** | Import profiles FIRST so agent has full context. importNotes field for nuance. User corrects in conversation. |
| Phantom characters persist in moment records | HIGH | Extraction prompt demands precise character counts. `correct_moment` tool for removing phantoms. User review of character-count mismatches. |
| Transcript processing takes very long (2000+ messages) | HIGH | Chunk processing with progress reports. User can pause and resume. Background processing where possible. |
| Arc discovery misses important connections | HIGH | Human-seeded arcs + AI expansion. User guidance parameter helps target search. Multiple passes allowed. |
| Large transcripts exceed storage limits | MEDIUM | Store in StoryTranscript as @db.Text (PostgreSQL text has no practical limit). Chunk for processing, store whole. |
| Claude.ai transcript export is difficult | MEDIUM | Research multiple methods. Manual paste is always fallback. |

---

## Cost Estimate

Assuming ~2000 transcript messages + 12 summary documents:

| Step | Model | Est. Calls | Notes |
|------|-------|-----------|-------|
| Character import | Sonnet | 2-3 | Small, few calls |
| Summary doc extraction | Sonnet | 15-25 | ~2 per doc (chunked) |
| Transcript extraction | Sonnet | 80-130 | ~15-30 per transcript × 4-5 transcripts |
| Arc discovery — fast (per arc) | Sonnet | 1-3 | Searches extracted moments only |
| Arc discovery — deep scan (per arc) | Sonnet | 60-150 | Scans raw transcripts. 20-45 min per arc. |
| Duplicate detection | Sonnet | 5-15 | Paginated by time window |
| Corrections/updates | Sonnet | 20-30 | Ongoing conversation |

Total: ~130-210 Sonnet calls for initial import. Arc discovery deep scans add 60-150 per arc (use sparingly). At orchestrator pricing (Claude CLI), this is the time cost of those invocations, not API dollars. Each call takes 10-30 seconds, so full transcript processing takes 30-60 minutes per transcript.

---

## Post-Import: Feeding the Canonical Timeline Back Into Ongoing Storytelling

The import's purpose is to prevent future drift. After import, the canonical timeline must actively inform the ongoing storytelling system.

### Current limitation (L5 — address after import)

The existing `buildCastInjection` injects the top 10 moments per character by importance. With 300+ moments across 25 characters, this is ~3% coverage. Insufficient for maintaining the texture the import preserved.

### Required enhancement (post-import, separate plan)

After import is complete, revise `buildCastInjection` to support **arc-aware injection**:
- For the current scene's characters, inject not just top-10 by importance but the most relevant arc moments
- If the scene involves Violet and Kai, inject moments from arcs they share
- If a character's arc is at a critical point (status: "building" near climax), inject the arc's recent moments
- This is the mechanism that prevents the driver from having the same realization twice — the injection includes "Day 8: the driver already had this breakthrough"

This is NOT part of the import implementation. It's a follow-up enhancement to the storytelling plugin that makes the imported data actually prevent drift. The current top-10 injection will work for initial continuation but will need to be upgraded.

---

## What This Plan Does NOT Cover

- **Automatic format detection** for non-Claude.ai transcripts (can add later)
- **Collaborative review** (single-user system, not needed)
- **Re-import / incremental import from new chats** (can extend later — add new transcripts, process them, merge)
- **Export / backup of imported story** — moved to Batch 1.5 (JSON export required before canonicalization)
- **Arc-aware cast injection for ongoing storytelling** — documented in "Post-Import" section, separate plan
- **`verify_character_arc` tool** — traces a character's evolution and flags regressions. Valuable but not blocking for import.

---

## Adversarial Review Log

Reviewed 2026-03-22 via system-architecture-reviewer agent. 27 issues found: 4 critical, 5 high, 6 medium, 5 low. All critical and high issues have been addressed in this version of the plan:

- **C1 (mid-import failure rollback):** Fixed with `processedThrough` on StoryTranscript + `sourceChunkIndex` on StoryMoment
- **C2 (detect_duplicates context overflow):** Fixed with auto-pagination by time window
- **C3 (merge destroys data permanently):** Fixed with soft-delete (`deletedAt` + `mergedIntoId`) + `restore_moment` tool
- **C4 (MCP tool input size):** Fixed by storing transcripts first, passing `transcriptId` to tool
- **H1 (arc link conflicts during merge):** Fixed with explicit duplicate-link check in merge logic
- **H2 (drift detection lacks cross-chunk context):** Fixed by including recent extracted moments in chunk context
- **H3 (discover_arc_moments cost):** Fixed with two-phase approach (fast extracted search + optional deep scan with time warning)
- **H4 (storyCache cold start):** Fixed with shared `resolve-story-id.ts` helper with DB fallback
- **H5 (MomentInArc position):** Fixed with Float type + auto-assignment from storyTime on creation
