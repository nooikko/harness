# Storytelling Plugin Timeline Implementation Audit

**Date:** 2026-03-25  
**Scope:** Data models, current timeline tracking, cast injection, extraction pipeline, temporal handling

---

## Prisma Schema — Story-Related Models

### Story (Root)
- **id**: cuid primary key
- **name**: string (story title)
- **premise**: optional text
- **storyTime**: optional string — **ONLY TIME TRACKING FIELD** on Story model (e.g., "Dawn, Day 3", "Three weeks later")
- **currentScene**: optional JSON (shape: `{ characters?: string[]; locationName?: string }`)
- **agentId**: optional FK to Agent
- **Relations**: threads, characters, moments, locations, arcs, transcripts

**Key finding**: `storyTime` is a **free-form string**, not a structured datetime. The system uses narrative time labels, not absolute timestamps.

### StoryMoment (Core Timeline Model)
- **id**: cuid primary key
- **storyId**: FK to Story (onDelete: Cascade)
- **summary**: text (1-2 sentence emotional summary)
- **description**: optional text (longer narrative)
- **storyTime**: optional string — **when in the story this occurred** (narrative time, matches Story.storyTime at moment of creation)
- **locationId**: optional FK to StoryLocation
- **kind**: string (dialogue | action | revelation | bonding | confrontation | intimate | breakthrough | comedic | routine | decision)
- **importance**: int, default 5 (1-10 scale)
- **messageId**: optional FK to Message (chat context)
- **sourceTranscriptId**: optional FK to StoryTranscript (from import)
- **sourceChunkIndex**: optional int (chunk position within transcript)
- **sourceNotes**: optional text (import metadata)
- **annotation**: optional text (user notes)
- **deletedAt**: optional datetime (soft delete marker)
- **mergedIntoId**: optional string (if merged, points to canonical moment)
- **createdAt**: datetime (extraction time)

**Indexes**: [storyId, createdAt], [storyId, importance], [locationId], [sourceTranscriptId, sourceChunkIndex], [deletedAt]

**Key finding**: Moments track **narrative time** (`storyTime`), not database time (`createdAt`). Multiple moments can have the same `storyTime`. Soft deletes via `deletedAt` enable recovery.

### CharacterInMoment (Character Participation)
- **id**: cuid primary key
- **characterId**: optional FK to StoryCharacter
- **characterName**: string (redundant copy of character name for unresolved refs)
- **momentId**: FK to StoryMoment
- **role**: string (protagonist | witness | antagonist | supporting | mentioned | observer | comforter | catalyst)
- **perspective**: optional text (what this moment means from their POV)
- **emotionalImpact**: optional text (how it affects them)
- **knowledgeGained**: optional text (what they learned)
- **relationshipContext**: optional text (how it changes their relationship with others in scene)

**Key finding**: Character knowledge is tracked **per-moment** via `knowledgeGained` field. Knowledge state is derived from the set of moments a character has participated in.

### StoryCharacter (Cast)
- **id**: cuid primary key
- **storyId**: FK to Story
- **name**: string
- **aliases**: string array
- **appearance, personality, mannerisms, motives, backstory, relationships**: optional text fields
- **color**: optional string (UI hint)
- **status**: string, default "active"
- **importNotes**: optional text
- **firstSeenAt**: datetime (moment creation time)

**Key finding**: Characters have a `firstSeenAt` timestamp but no narrative time. Character knowledge is derived from moment participation, not stored as a summary field.

### StoryLocation (World Building)
- **id**: cuid primary key
- **storyId**: FK to Story
- **name**: string
- **description**: optional text
- **parentId**: optional self-FK for containment hierarchy
- **children**: relation to nested locations
- **moments**: relation to moments set in this location
- **relationsFrom/To**: directional relationships with distance/direction fields

**Key finding**: Locations form a containment hierarchy, not a timeline structure. Spatial relationships are tracked explicitly (distance, direction).

### StoryArc (Narrative Structure)
- **id**: cuid primary key
- **storyId**: FK to Story
- **name**: string (e.g., "Suki's Mother", "The Team Learning Trust")
- **description**: optional text
- **status**: ArcStatus enum (building | climaxed | resolved | dormant)
- **importance**: int, default 5 (1-10)
- **annotation**: optional text (user notes)
- **moments**: relation to MomentInArc join table
- **createdAt, updatedAt**: timestamps

**ArcStatus enum**: building (in progress), climaxed (reached peak), resolved (concluded), dormant (paused)

**Key finding**: Arcs track narrative progress (status enum), not timeline position. Arc moments are ordered via `MomentInArc.position` (float), enabling flexible reordering without refactoring.

### MomentInArc (Arc Membership)
- **id**: cuid primary key
- **arcId**: FK to StoryArc
- **momentId**: FK to StoryMoment
- **position**: float, default 0 (ordering within arc)
- **note**: optional text (why this moment belongs to the arc)

**Unique constraint**: [arcId, momentId]  
**Index**: [arcId, position]

**Key finding**: `position` (float) allows flexible reordering without renumbering. Arc moments need not be chronological — they're ordered by thematic progression.

### StoryTranscript (Import Source)
- **id**: cuid primary key
- **storyId**: FK to Story
- **label**: string (e.g., "Days 1-3", "Day 10 Part 1")
- **sourceType**: string, default "claude" (source origin)
- **rawContent**: text (the transcript as stored)
- **processed**: boolean (extraction complete?)
- **processedThrough**: optional int (chunk index for resume on failure)
- **totalChunks**: optional int (for progress tracking)
- **messageCount**: optional int (statistics)
- **sortOrder**: int, default 0 (display order)
- **moments**: relation to extracted moments
- **annotations**: relation to inline annotations

**Key finding**: Transcripts track **extraction progress** (`processedThrough`, `totalChunks`) for resumable batch processing.

### TranscriptAnnotation (Inline Import Notes)
- **id**: cuid primary key
- **transcriptId**: FK to StoryTranscript
- **messageIndex**: int (position in transcript)
- **content**: text (annotation)
- **kind**: string, default "note" (annotation type)
- **momentId**: optional FK to StoryMoment (links to extracted moment)

**Key finding**: Inline annotations preserve human feedback during import, linking back to extracted moments.

---

## Current Timeline Tracking Implementation

### 1. Narrative Time (`storyTime` field)

**Location**: `Story.storyTime`, `StoryMoment.storyTime`

**Current behavior**: Free-form string field (no validation, no parsing)
- Examples: "Dawn, Day 3", "Three weeks later", "The morning after", "6 PM"
- Set manually via `advance_time` MCP tool
- Displayed in cast injection and moment records
- No automatic progression — fully manual management

**Code**: `tool-advance-time.ts`
```typescript
// Simply updates Story.storyTime to input string
await db.story.update({
  where: { id: storyId },
  data: { storyTime: input.storyTime },
});
```

**Limitations**:
- No validation (typos, format inconsistency)
- No parsing (cannot compute "how much time passed")
- No automatic advancement (must be manually maintained)
- Cannot filter moments by time range without text parsing
- Drift-detecting during import needs fuzzy matching on `storyTime` strings

### 2. Moment Timestamps

**Story.storyTime capture**: Set when moment is first created
- In batch import: `storyTime` from extraction prompt result
- In live interaction: not automatically captured; must be set manually or extracted

**Creation time**: `StoryMoment.createdAt` (database timestamp, not narrative)
- Records when moment was extracted, not when it occurred in story
- Soft-deleted moments keep original `createdAt`
- Chronological sort uses `createdAt`, not `storyTime`

### 3. Character Timeline

**firstSeenAt**: Timestamp when character record was created (database time, not narrative)
- Example use: tier 2 ranking in cast injection (recently updated vs background)
- Does NOT track when character first appeared in the story (narrative time)

**updatedAt**: Bumped on any character field update
- Used to rank tier 2 in cast injection: `character.updatedAt >= oneHourAgo`
- Not correlated to narrative time

**Character knowledge**: Derived from `CharacterInMoment.knowledgeGained` fields across all moments character participated in
- No aggregation into a "knowledge summary" record
- Must iterate all character moments to reconstruct knowledge state
- Knowledge progression is implicit (order of moments), not explicit (timeline markers)

### 4. Arc Timeline

**Arc status**: Enum (building | climaxed | resolved | dormant)
- No timestamps on status transitions
- Manual setting, not automatic
- No history of status changes

**Moment ordering**: `MomentInArc.position` (float)
- Enables flexible reordering independent of `StoryMoment.createdAt` or `storyTime`
- Can be used to define arc progression (chronological, thematic, or custom)

---

## Build-Cast-Injection: How Story Context Is Assembled

**File**: `packages/plugins/storytelling/src/_helpers/build-cast-injection.ts`

### Tier System (for character prioritization)

Characters are ranked by recency + scene participation:

```
Tier 1: In Scene
  - Characters listed in Story.currentScene.characters
  - Rendered with full profiles + moments + knowledge

Tier 2: Recently Active
  - Updated within the last hour (ONE_HOUR_MS = 3600000)
  - Uses character.updatedAt >= oneHourAgo
  - Rendered as one-liner (name + core trait)

Tier 3: Background
  - All others
  - Rendered as comma-separated list
```

### Data Assembly

For each character in Tier 1:
1. Fetch top 10 moments by importance
2. For each moment, include location, perspective, emotional impact, knowledge gained
3. Derive knowledge state via `deriveCharacterKnowledge` (iterates all moments, aggregates `knowledgeGained`)
4. Format via `formatCharacterFull` (structured text with appearance, personality, motives, moments)

For Tier 2:
- Extract core trait: `character.personality ?? character.motives ?? 'active'`

### Location Context

If `Story.currentScene.locationName` is set:
1. Find location by name (case-insensitive)
2. Include description
3. List nearby locations via `relationsFrom` (distance + direction)

### Story Time

If `Story.storyTime` exists:
- Append "Story time: ${storyTime}" at end of injection

### Output Format

```
# Story State

## In Scene
[Tier 1 character profiles]

## Recently Active
[Tier 2 one-liners]

Background: [Tier 3 names]

## Location
Current: [location name]
[description]
Nearby:
  - [location] ([distance]) [[direction]]

Story time: [current storyTime]
```

**Key finding**: Cast injection is **recency-based** (updatedAt within 1h), not narrative-time-based. A character is "active" if recently modified, regardless of when they last appeared in the story.

---

## Build-Import-Extraction-Prompt: What Extraction Expects

**File**: `packages/plugins/storytelling/src/_helpers/build-import-extraction-prompt.ts`

### Input Schema

```typescript
{
  characters: CharacterRef[],      // Existing characters (id, name, aliases, personality)
  locations: LocationRef[],        // Existing locations (id, name, parentName)
  storyTime: string | null,        // Current Story.storyTime
  content: string,                 // Text to extract from
  contentLabel?: string,           // Transcript label (e.g., "Days 1-3")
  recentMoments?: RecentMomentRef[] // Last extracted moments (for drift detection)
}
```

### Key Extraction Rules

1. **Character Name Rules (STRICT)**
   - 1-4 words only (e.g., "Quinn", "The Expander", "CIS 405 Guy")
   - NEVER use sentences or status descriptions
   - OMIT if no identifiable name

2. **Extraction Priority**
   - Emotional-beat granularity (not plot summaries)
   - Multi-character dynamics (list every character, their role + perspective + impact)
   - Preserve specifics ("under the streetlight" not "outside")
   - **Detect drift**: If moment resembles existing one, flag `driftFlag: true` + `driftNote`
   - Count characters precisely; flag ambiguity

3. **Output JSON Schema**

```json
{
  "characters": [{
    "action": "create" | "update",
    "name": "string (1-4 words max)",
    "fields": { appearance?, personality?, mannerisms?, motives?, backstory?, relationships?, color?, status? }
  }],
  "moments": [{
    "summary": "1-2 sentence emotional summary",
    "description": "optional longer description",
    "storyTime": "optional — when in story this happened",
    "locationId": "existing location ID",
    "newLocationName": "if NEW location",
    "kind": "dialogue | action | revelation | bonding | confrontation | intimate | breakthrough | comedic | routine | decision",
    "importance": 1-10,
    "driftFlag": false,
    "driftNote": "optional — why this might be re-telling of existing",
    "characters": [{
      "name": "character name",
      "role": "protagonist | witness | antagonist | supporting | mentioned | observer | comforter | catalyst",
      "perspective": "what this means from POV",
      "emotionalImpact": "how it affects them",
      "knowledgeGained": "what they learned",
      "relationshipContext": "how relationship changed"
    }]
  }],
  "locations": [{
    "action": "create" | "update",
    "name": "string",
    "description": "optional",
    "parentName": "optional parent location"
  }],
  "scene": {
    "characters": ["names in current scene"],
    "location": "current location name or null",
    "storyTime": "current story time or null"
  } | null,
  "aliases": [{
    "alias": "alternate name used",
    "resolvedName": "canonical character name"
  }]
}
```

**Key finding**: Extraction is **content-driven**, not time-driven. `storyTime` is extracted from content itself (if found), not computed from document order. The extraction prompt provides `recentMoments` list for drift detection but doesn't enforce chronological ordering.

---

## Format-Storytelling-Instructions: Writing Guidance

**File**: `packages/plugins/storytelling/src/_helpers/format-storytelling-instructions.ts`

Instructions are appended to every storytelling thread prompt. They define:

1. **Dialogue**: `**CHARACTER NAME**: "Dialogue text here."`
2. **Actions**: *italics* for physical descriptions
3. **Internal thoughts**: > blockquotes for inner monologue
4. **Scene breaks**: `---` horizontal rule for transitions/time skips
5. **Narration**: Plain prose paragraphs
6. **Pacing rules**:
   - End at natural stopping points (question, silence, charged moment)
   - Don't answer character's own questions
   - Don't write user's character's dialogue/actions
   - Responses are scene beats (2-5 sentences), not chapters
   - Pause when scene turns to user's character

**Key finding**: Instructions are focused on **narrative pacing** and **character control**, not on time mechanics. No guidance on how to explicitly mark time progression or handle flashbacks.

---

## Extract-Story-State: How Extraction Is Triggered

**File**: `packages/plugins/storytelling/src/_helpers/extract-story-state.ts`

### Pipeline

1. Query existing characters (top 50, active only)
2. Query existing locations (top 100)
3. Query story time (`Story.storyTime`)
4. Query last 2 user messages (chronological)
5. Build "latest exchange": user messages + assistant output
6. Call `buildExtractionPrompt` with all context
7. Invoke Haiku to parse
8. Parse JSON result
9. Apply extraction to DB

### Dedup Guard

In `onAfterInvoke` hook:
- 60-second guard via `lastExtractionAt` map (in-memory, per storyId)
- Prevents extraction spam from back-to-back messages
- Uses in-memory timestamp, not `Story.updatedAt` (which is bumped by tool calls)

**Key finding**: Extraction is **fire-and-forget** (`void` in `onAfterInvoke`), runs once per 60 seconds per story, uses only the latest 2 user messages + assistant output (not full conversation history).

---

## Plugin Hook Order

### `onBeforeInvoke`
1. Cache `thread.storyId`
2. Check thread kind (skip if not 'storytelling' or 'story-import')
3. If storyId exists: build cast injection via `buildCastInjection` (queries characters, moments, locations)
4. Check if OOC command was handled in `onMessage`; if so, append command summary
5. Inject `formatStorytellingInstructions`
6. Return modified prompt

### `onAfterInvoke`
1. Check dedup guard (60s)
2. Call `extractStoryState` (fire-and-forget)
   - This invokes Haiku to parse latest exchange
   - Applies extraction to DB (upserts characters, moments, locations)

**Key finding**: Extraction happens **every turn** (subject to 60s dedup), not selectively. The system continuously parses story output for new moments, characters, locations.

---

## What's Missing / Not Yet Implemented

### Phase 3: Timeline Design (PENDING)

From CLAUDE.md memory:
> **Tier 5: DONE (2026-03-25 / 2026-03-18)** — Storytelling plugin. Phase 1+2 complete, Phase 3+4 pending

Specifically needed:
- **Structured day tracking** — way to mark "Day 1", "Day 2", etc. with metadata
- **Countdowns** — explicit tracking of "X days until event", "Y days since event"
- **Character commitments** — character promises/goals with deadlines, crossed-off when met
- **Timeline visualization** — UI to view moments on a timeline (currently only arcs exist)

### Current Gaps

1. **No datetime parsing**: `storyTime` is unstructured free-form string
2. **No time progression validation**: Can set arbitrary storyTime values; no consistency check
3. **No relative time calculation**: Cannot compute "how much time passed between moments"
4. **No time-based moment filtering**: Cannot query "all moments from Day 3" without text parsing
5. **No character age/development tracking**: Character is static; no way to mark how character changes over time
6. **No flashback/nonlinear narrative support**: System assumes linear extraction
7. **No time ranges on arcs**: Arc doesn't track "this arc spans Day 1-3" or "Day 10+"
8. **No countdown visualization**: No UI to show "X days until..." or "Y days since..."
9. **No future-event scheduling**: Cannot mark "this will happen on Day 5" and have system remind of it

---

## Summary

**Timeline tracking today**: Free-form narrative time strings + database creation timestamps + per-moment knowledge accumulation.

**Architecture**: Moments are the atomic unit. Each moment records `storyTime` (when it occurred in story), `createdAt` (when extracted), `importance`, and character participation. Arcs group moments by thematic progression, not chronology. Characters derive knowledge state from the set of moments they participated in.

**Extraction**: Fire-and-forget on every turn (60s dedup), parses latest exchange only, creates/updates moments with `storyTime` captured from content.

**Casting**: Tier system prioritizes in-scene characters (Tier 1 with full detail), recently modified characters (Tier 2 one-liner, within last hour), background (Tier 3 list).

**Next phase**: Structured time model needed — days, countdowns, character commitments, timeline UI for non-arc browsing.
