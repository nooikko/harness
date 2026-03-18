# Storytelling Plugin — Phase 2 Implementation Plan

**Parent plan:** `AI_RESEARCH/2026-03-17-storytelling-plugin-plan.md`
**Depends on:** Phase 1 (committed: `90e9927`)
**Goal:** Story model, emergent character detection, knowledge tracking, locations, moments, MCP tools.

## Requirements

1. `Story` as a first-class entity (parallel to Project) with characters, locations, moments
2. `Thread.storyId` FK — threads belong to stories, mutually exclusive with projectId
3. Emergent character detection via blocking Haiku extraction in `onAfterInvoke`
4. Tiered cast injection in `onBeforeInvoke` (Tier 1-4 based on scene presence)
5. 6 MCP tools for the agent to manage story state
6. OOC `//` command handling via `onMessage` hook
7. storyId caching for tool handlers
8. Recap generation when starting a new thread in a story

## Implementation Steps

Phase 2 is large. Split into 5 sub-steps, each independently testable and committable.

---

### Step 2A: Schema Migration (Prisma)

**Files:**
- `packages/database/prisma/schema.prisma` — add 6 new models + Thread.storyId + Agent.stories
- Migration SQL (via `pnpm --filter database db:migrate`)
- `packages/database/src/index.ts` — verify new types are re-exported (Prisma generates them)

**Models to add:**
- `Story` — name, premise, storyTime, currentScene (Json?), agentId FK
- `StoryCharacter` — storyId FK, name, aliases[], appearance, personality, mannerisms, motives, backstory, relationships, color, status
- `StoryLocation` — storyId FK, name, description, parentId self-relation (containment)
- `LocationRelationship` — fromId/toId FKs, distance, direction, notes
- `StoryMoment` — storyId FK, summary, description, storyTime, locationId FK, kind, importance, messageId FK
- `CharacterInMoment` — characterId? FK (SetNull), characterName, momentId FK, role, perspective, emotionalImpact, knowledgeGained

**Thread changes:**
- Add `storyId String?` with `@relation(fields: [storyId], references: [id], onDelete: SetNull)`
- Add `@@index([storyId])`

**Agent changes:**
- Add `stories Story[]` reverse relation

**Message changes:**
- Add `storyMoments StoryMoment[]` reverse relation (for messageId FK)

**Custom migration SQL needed for:**
- GIN index on `StoryCharacter.aliases`: `CREATE INDEX idx_story_character_aliases ON "StoryCharacter" USING GIN ("aliases");`

**Mutual exclusivity middleware:**
- Add to `packages/database/src/index.ts` or a new `packages/database/src/_helpers/story-thread-middleware.ts`
- Prisma `$extends` with `query.thread.create` and `query.thread.update` that reject both storyId + projectId being non-null

**Tests:**
- `packages/database/src/__tests__/story-thread-middleware.test.ts` — 5 tests (both set rejected, each alone ok, neither ok, update both rejected)

---

### Step 2B: Extraction System (onAfterInvoke)

The core innovation — Haiku reads the latest exchange and extracts characters, moments, locations.

**Files:**
- `packages/plugins/storytelling/src/_helpers/extract-story-state.ts`
  - Exports `extractStoryState`
  - Input: `ctx: PluginContext, storyId: string, threadId: string, assistantOutput: string`
  - Queries DB for: recent user messages, existing characters, existing locations, story time
  - Calls Haiku with the extraction prompt
  - Parses JSON response
  - Creates/updates StoryCharacter, StoryMoment, CharacterInMoment, StoryLocation, LocationRelationship records
  - Updates Story.currentScene and Story.storyTime
  - Validates currentScene with Zod

- `packages/plugins/storytelling/src/_helpers/build-extraction-prompt.ts`
  - Exports `buildExtractionPrompt`
  - Input: existing cast (names + IDs), existing locations (names + IDs + hierarchy), story time, latest exchange
  - Output: the prompt string for Haiku

- `packages/plugins/storytelling/src/_helpers/parse-extraction-result.ts`
  - Exports `parseExtractionResult`
  - Input: raw Haiku output string
  - Output: typed extraction result or null on parse failure
  - Uses Zod for validation

- `packages/plugins/storytelling/src/_helpers/apply-extraction.ts`
  - Exports `applyExtraction`
  - Input: parsed extraction result, ctx.db, storyId
  - Creates new StoryCharacter records
  - Updates existing characters (upsert on storyId + name)
  - Creates StoryLocation records (new locations first, then moments that reference them)
  - Creates StoryMoment + CharacterInMoment records
  - Updates Story.currentScene and Story.storyTime

**Plugin index.ts changes:**
- Add `onAfterInvoke` hook (blocking, not fire-and-forget)
- Check storyCache for storyId — skip if not a story thread
- 60-second dedup guard
- Call extractStoryState
- Log errors without crashing pipeline

**Tests:**
- `_helpers/__tests__/build-extraction-prompt.test.ts` — prompt includes cast, locations, exchange, story time
- `_helpers/__tests__/parse-extraction-result.test.ts` — valid JSON parsed, invalid JSON returns null, missing fields handled
- `_helpers/__tests__/apply-extraction.test.ts` — new characters created, existing updated, moments with character perspectives, locations with parent, scene updated
- `src/__tests__/index.test.ts` — extend with onAfterInvoke tests: skips non-story, dedup guard, blocking await, error handling

---

### Step 2C: Cast Injection (onBeforeInvoke enhancement)

Upgrade the Phase 1 `onBeforeInvoke` from "inject formatting instructions" to "inject cast sheet + formatting instructions."

**Files:**
- `packages/plugins/storytelling/src/_helpers/build-cast-injection.ts`
  - Exports `buildCastInjection`
  - Input: storyId, currentScene, ctx.db
  - Queries: StoryCharacter (active, ordered by updatedAt), StoryMoment (by importance), StoryLocation
  - Builds tiered injection:
    - Tier 1: characters in currentScene → full detail with moments + knowledge
    - Tier 2: recently active (updated in last hour) not in scene → one-liner
    - Tier 3: all other active → name only
  - Returns: string to inject before the user message

- `packages/plugins/storytelling/src/_helpers/format-character-full.ts`
  - Exports `formatCharacterFull`
  - Input: StoryCharacter with included moments (CharacterInMoment + StoryMoment)
  - Output: full character block (appearance, personality, mannerisms, motives, backstory, relationships, key moments, knowledge)

- `packages/plugins/storytelling/src/_helpers/derive-character-knowledge.ts`
  - Exports `deriveCharacterKnowledge`
  - Input: character's CharacterInMoment records, all StoryMoments for the story
  - Output: `{ knows: string[], doesNotKnow: string[] }`
  - "Knows" = aggregated knowledgeGained across all moments character participated in
  - "Does NOT know" = significant moments (importance >= 7) where character has no CharacterInMoment record

**Plugin index.ts changes:**
- In `onBeforeInvoke`: after checking storyId, load story + currentScene, call buildCastInjection, prepend to prompt before formatting instructions
- storyCache now also caches the currentScene for the current thread

**Tests:**
- `_helpers/__tests__/build-cast-injection.test.ts` — tier assignment, empty cast, no currentScene fallback, token budget check
- `_helpers/__tests__/format-character-full.test.ts` — all fields rendered, missing fields omitted, moments sorted by importance
- `_helpers/__tests__/derive-character-knowledge.test.ts` — knows from knowledgeGained, doesNotKnow from absent moments

---

### Step 2D: MCP Tools

6 tools for the agent to manage story state. All resolve storyId from storyCache.

**Files:**
- `packages/plugins/storytelling/src/_helpers/tool-update-character.ts`
- `packages/plugins/storytelling/src/_helpers/tool-record-moment.ts`
- `packages/plugins/storytelling/src/_helpers/tool-advance-time.ts`
- `packages/plugins/storytelling/src/_helpers/tool-add-location.ts`
- `packages/plugins/storytelling/src/_helpers/tool-character-knowledge.ts`
- `packages/plugins/storytelling/src/_helpers/tool-get-character.ts`

**Plugin index.ts changes:**
- Add `tools` array to PluginDefinition with all 6 tools
- Each tool handler resolves storyId from storyCache, returns error if not in story thread

**Tool schemas:**

1. `update_character` — `{ name: string, field: string, value: string }` — updates one field on a character
2. `record_moment` — `{ summary, description?, storyTime?, locationName?, kind, importance, characters: [{ name, role, perspective?, emotionalImpact?, knowledgeGained? }] }`
3. `advance_time` — `{ storyTime: string }` — updates Story.storyTime
4. `add_location` — `{ name, description?, parentName?, distance?, direction? }`
5. `character_knowledge` — `{ name: string }` — returns what character knows / doesn't know
6. `get_character` — `{ name: string }` — returns full character profile with moments

**Tests:**
- One test file per tool in `_helpers/__tests__/` — happy path, not-in-story error, unknown character error
- `src/__tests__/index.test.ts` — extend with tools array shape test

---

### Step 2E: OOC Command Handling + Recap Generation

**OOC Commands (onMessage hook):**

- `packages/plugins/storytelling/src/_helpers/parse-ooc-command.ts`
  - Exports `parseOocCommand`
  - Input: message content (already confirmed as `//` prefixed)
  - Output: `{ type: 'rename' | 'knowledge' | 'personality' | 'remove' | 'color' | 'time' | 'location' | 'unknown', params: Record<string, string> }`
  - Simple pattern matching — not NLP. Looks for keywords: "rename", "doesn't know", "make X more", "remove", "color", "it's now", "we're at"

- `packages/plugins/storytelling/src/_helpers/handle-ooc-command.ts`
  - Exports `handleOocCommand`
  - Input: parsed command, ctx.db, storyId
  - Executes the DB write for known commands
  - Returns a summary string for injection ("The author renamed 'the cheerleader' to Mikenze")

**Plugin index.ts changes:**
- Add `onMessage` hook
- Detect `//` prefix, check storyCache for storyId
- Parse command, execute if known, store flag in `handledOocCommands` set
- In `onBeforeInvoke`: check handledOocCommands, inject summary instead of raw `//` text

**Recap Generation:**

- `apps/web/src/app/(chat)/chat/_actions/create-story-thread.ts`
  - Server action: creates a new thread in a story with auto-generated recap
  - Loads all StoryCharacters, recent StoryMoments, last 10-20 messages from previous thread
  - Calls Haiku to generate recap
  - Creates thread with storyId + kind='storytelling'
  - Creates `kind: 'recap'` Message as first message
  - Returns new threadId

- `packages/plugins/storytelling/src/_helpers/build-recap-prompt.ts`
  - Exports `buildRecapPrompt`
  - Input: characters, moments, recent messages, story premise
  - Output: prompt string for Haiku recap generation

**Tests:**
- `_helpers/__tests__/parse-ooc-command.test.ts` — all command types + unknown
- `_helpers/__tests__/handle-ooc-command.test.ts` — rename, knowledge, personality, remove, time, location
- `_helpers/__tests__/build-recap-prompt.test.ts` — includes characters, moments, messages
- `apps/web/.../_actions/__tests__/create-story-thread.test.ts` — creates thread, generates recap, handles empty story

---

## Dependency Order

```
2A (schema) → 2B (extraction) → 2C (injection) → 2D (tools) → 2E (OOC + recap)
                                                          ↗
                                               2C (injection)
```

2A must be first (all others depend on the schema).
2B and 2C are semi-independent but both need the schema.
2D depends on the storyCache pattern from 2C.
2E depends on 2D (OOC commands reference tool patterns) and 2C (recap needs injection patterns).

**Recommended execution: 2A → 2B → 2C → 2D → 2E, commit after each.**

---

## Test Summary

| Step | New tests | Key concerns |
|------|-----------|-------------|
| 2A | 5 | Mutual exclusivity middleware |
| 2B | ~20 | Extraction prompt, JSON parsing, DB writes, dedup guard |
| 2C | ~15 | Tier assignment, character formatting, knowledge derivation |
| 2D | ~18 | 6 tools × 3 tests each |
| 2E | ~15 | OOC parsing, command handling, recap generation |
| **Total** | **~73** | |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Haiku extraction JSON is malformed | Zod validation + null fallback + error logging |
| Extraction prompt grows too large with many characters | Send names + IDs only, not full state |
| Schema migration on existing data | All new fields are optional or have defaults; no data migration needed |
| storyCache stale after thread moves between stories | Cache is populated on every onBeforeInvoke call |
| OOC command parsing is too rigid | Unknown commands pass through to Claude as regular OOC |
| Recap generation takes too long | Blocking server action with loading state; Haiku is fast (~2s) |

---

**WAITING FOR CONFIRMATION**: Ready to start with Step 2A (schema migration)?
