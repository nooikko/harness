# Character Trajectory Skeleton + Transcript-Authoritative Evolution

**Date:** 2026-03-27
**Status:** PLANNED — adversarial review complete, ready for implementation
**Plugin:** `@harness/plugin-storytelling`

---

## Problem Statement

The storytelling plugin currently treats character data as static strings. Two document types are imported — summary documents (dense personality overviews) and transcripts (actual story conversations) — but both use the same extraction prompt and the same `applyExtraction` pipeline. Character fields are set once and only updated via null-fill on merge.

This means:
- Characters are frozen at first introduction
- Summary documents (which provide holistic personality reads spanning multiple story days) are processed identically to transcripts
- There's no way to track HOW a character evolved over time
- No provenance — you can't see WHY a character is described a certain way
- No distinction between core personality traits vs. transient emotional states
- No human curation layer — you can't tell the system "that's not a personality change, that's a momentary reaction"

## Design Philosophy

- **Transcripts are source of truth.** What actually happened in the story.
- **Summaries are skeleton/guideposts.** They give the system interpolation points — "around Day X, this character was trending toward Y." Not canonical truth.
- **Character evolution is real.** Outgoing on Day 10, withdrawn on Day 12 — valid IF transcripts show something happened. If nothing happened, the summary was wrong.
- **Provenance is critical.** Every character trait traces back to the exact transcript passage. The user can see the passage, the surrounding context, and override the system's interpretation.
- **Synthesis is async with processing indicators.** Don't rush processing; show the user that freshness is in-flight.

---

## Pre-Implementation Fixes (from Adversarial Review)

These issues were identified by the adversarial review as pre-existing problems that MUST be fixed before the new system is built, because the new system's correctness depends on them.

### Fix 1: Wire `judgeCharacterMatch` in `applyExtraction`

**File:** `apply-extraction.ts` line 100
**Issue:** The `judge` action from `resolveCharacterIdentity` (Qdrant score 0.65–0.84) falls through to create, silently making duplicates. `judgeCharacterMatch` exists and works in `tool-import-characters.ts` but is never called from `applyExtraction`.
**Fix:** Add `if (resolution.action === 'judge')` branch that calls `judgeCharacterMatch`, matching the pattern in `tool-import-characters.ts` lines 135-173.
**Why first:** The entire observation system depends on correct `characterId` assignment. Duplicate characters corrupt trajectory linkage.

### Fix 2: Add null-guard to upsert path

**File:** `apply-extraction.ts` lines 103-116
**Issue:** The upsert `update` clause overwrites all non-undefined fields unconditionally. Only the merge path (lines 82-95) has a null-guard.
**Fix:** Add the same `!current` guard to the upsert path — or change the upsert update to only write fields that are currently null.
**Why first:** Once `StoryCharacter` fields become a synthesized cache, unguarded overwrites from live extraction corrupt curated data.

### Fix 3: Re-index characters after merge

**File:** `apply-extraction.ts` — merge branch (lines 63-98)
**Issue:** The `continue` at line 97 skips `indexCharacter` at line 120. Merged characters get enriched fields but stale Qdrant vectors.
**Fix:** Call `indexCharacter` after the merge update, using the merged character's current name + updated personality.
**Why first:** Character deduplication accuracy degrades as more transcripts are processed without re-indexing.

### Fix 4: Extract `CHARACTER_FIELDS` to shared constant

**File:** `apply-extraction.ts` line 41, `tool-import-characters.ts` line 11
**Issue:** Identical constant declared independently in two files.
**Fix:** Move to `packages/plugins/storytelling/src/_helpers/character-fields.ts` and import from both.

### Fix 5: Fix `recentMoments` N+1 in transcript import

**File:** `tool-import-transcript.ts` line 94
**Issue:** DB query for `recentMoments` inside the per-chunk loop. Should follow the pattern in `tool-import-document.ts` (load once, refresh incrementally).
**Fix:** Move query before the loop, refresh in-memory array after each chunk.

---

## Schema Changes

### New Model: `CharacterTrajectory`

From summary documents — skeleton/guideposts, NOT source of truth.

```prisma
model CharacterTrajectory {
  id              String    @id @default(cuid())
  characterId     String
  character       StoryCharacter @relation(fields: [characterId], references: [id], onDelete: Cascade)
  storyDay        Int?                  // approximate story day this reflects
  storyDayEnd     Int?                  // if spanning a range (e.g., "Days 5-10")
  field           String                // "personality" | "motives" | "relationships" | etc.
  content         String    @db.Text    // the description at this point
  sourceTranscriptId String?            // FK to StoryTranscript (the summary document)
  sourceTranscript   StoryTranscript? @relation(fields: [sourceTranscriptId], references: [id], onDelete: SetNull)
  status          String    @default("active")  // "active" | "contradicted" | "confirmed"
  contradictedById String?              // observation ID that overrode this
  createdAt       DateTime  @default(now())

  @@index([characterId, field])
  @@index([characterId, storyDay])
}
```

### New Model: `CharacterObservation`

From transcripts — ground truth. Human-curatable.

```prisma
model CharacterObservation {
  id                String    @id @default(cuid())
  characterId       String
  character         StoryCharacter @relation(fields: [characterId], references: [id], onDelete: Cascade)
  momentId          String?
  moment            StoryMoment? @relation(fields: [momentId], references: [id], onDelete: SetNull)
  storyDay          Int?
  field             String              // "personality" | "motives" | "relationships" | etc.
  content           String    @db.Text  // what was observed
  sourcePassage     String    @db.Text  // exact transcript text that led to this
  sourceContext     String?   @db.Text  // surrounding messages for review
  sourceTranscriptId String?
  sourceTranscript   StoryTranscript? @relation(fields: [sourceTranscriptId], references: [id], onDelete: SetNull)
  sourceChunkIndex  Int?

  classification    String    @default("unclassified")  // "core_trait" | "emotional_state" | "reaction" | "growth" | "unclassified"
  classificationReason String? @db.Text  // AI's reasoning for the classification

  // Human curation
  curatedAt         DateTime?
  curatedNote       String?   @db.Text  // human interpretation
  accepted          Boolean?            // null=unreviewed, true=confirmed, false=rejected

  // Trajectory linkage
  trajectoryId      String?
  trajectory        CharacterTrajectory? @relation(fields: [trajectoryId], references: [id], onDelete: SetNull)
  alignment         String?             // "confirms" | "contradicts" | "extends"

  createdAt         DateTime  @default(now())

  @@index([characterId, field])
  @@index([characterId, accepted])
  @@index([characterId, createdAt])
}
```

### Modified Model: `StoryCharacter`

Add back-relations and synthesis tracking:

```prisma
// Add to StoryCharacter:
trajectories      CharacterTrajectory[]
observations      CharacterObservation[]
lastSynthesizedAt DateTime?             // when portrait was last rebuilt
synthesisStatus   String?               // "current" | "processing" | "stale"
```

### Modified Model: `StoryMoment`

Add back-relation:

```prisma
// Add to StoryMoment:
observations      CharacterObservation[]
```

---

## Implementation Phases

### Phase 1: Pre-Implementation Fixes

Fix the 5 pre-existing issues listed above. These are independent of the new feature and can be committed separately.

### Phase 2: Schema Migration

- Add `CharacterTrajectory` and `CharacterObservation` models
- Add back-relations on `StoryCharacter` and `StoryMoment`
- Add `lastSynthesizedAt` and `synthesisStatus` to `StoryCharacter`
- Run `pnpm db:push` (additive — no data loss)

### Phase 3: Skeleton Extraction for Summaries

**New files:**
- `build-skeleton-extraction-prompt.ts` — summary-specific prompt focused on temporal character trajectories
- `parse-skeleton-result.ts` — Zod schema + parser for trajectory extraction output
- `apply-skeleton.ts` — writes `CharacterTrajectory` records; checks against existing observations for contradiction detection (only effective when transcripts were processed first)

**Modified files:**
- `tool-import-document.ts` — switch from `buildImportExtractionPrompt` to `buildSkeletonExtractionPrompt` for character data; keep moment/location extraction via existing prompt

**Extraction JSON schema for skeletons:**
```json
{
  "characterTrajectories": [
    {
      "name": "character name",
      "storyDay": 5,
      "storyDayEnd": 10,
      "personality": "description at this point...",
      "motives": "...",
      "relationships": "...",
      "backstory": "..."
    }
  ],
  "moments": [...],
  "locations": [...],
  "scene": null,
  "aliases": [...],
  "timeline": { ... }
}
```

### Phase 4: Observation Pipeline for Transcripts

**New files:**
- `apply-observations.ts` — writes `CharacterObservation` records from transcript extraction. Links to trajectory points. Populates `sourcePassage` from extraction output.

**Modified files:**
- `build-import-extraction-prompt.ts` — add trajectory skeleton context section; add `sourcePassage` and `classification` fields to per-character extraction schema
- `tool-import-transcript.ts` — after calling `applyExtraction` for moments/locations, call `apply-observations.ts` for character data

**Key design decision:** `applyExtraction` is NOT modified for character behavior. Instead, `apply-observations.ts` is a NEW function called AFTER `applyExtraction`. This avoids the 3-caller problem (live, document, transcript all share `applyExtraction`). The existing function continues to write moments, locations, aliases, scene, and timeline. Character field writes in `applyExtraction` are gated by a `skipCharacterWrites: boolean` parameter (default false for backward compat).

**For live extraction (`extractStoryState`):** No change. Live extraction continues to write directly to `StoryCharacter` fields via `applyExtraction`. This is intentional — live sessions need immediate character updates without waiting for curation. The synthesis layer is for import-time quality, not live-session latency.

### Phase 5: Portrait Synthesis

**New file:**
- `synthesize-character-portrait.ts` — rebuilds `StoryCharacter` fields from observations + trajectory gaps

**Synthesis algorithm:**
1. Query `CharacterObservation` where `accepted != false` (includes unreviewed + accepted)
2. Group by field
3. Within each field: `core_trait` observations weighted highest, `emotional_state` lowest
4. If `curatedNote` exists on an observation, use it instead of `content`
5. Most recent high-weight observation per field wins
6. For fields with no observations: use most recent `CharacterTrajectory` point with `status != 'contradicted'`
7. Write synthesized values to `StoryCharacter` fields
8. Update `lastSynthesizedAt` and `synthesisStatus = 'current'`

**Does NOT require LLM invocation.** Synthesis is a deterministic aggregation — pick the best observation per field based on classification weight + recency. No Opus/Haiku call needed.

**Triggers:**
- Fire-and-forget after each transcript import batch (in `tool-import-transcript.ts`)
- Fire-and-forget after each document import batch (in `tool-import-document.ts`)
- Synchronous on accept/reject/reclassify UI actions (single character, fast)
- `synthesisStatus` set to `"processing"` before synthesis starts, `"current"` when done
- `synthesisStatus` set to `"stale"` when new observations are written but synthesis hasn't run yet

### Phase 6: Cast Injection Enhancement

**Modified file:**
- `build-cast-injection.ts` — for Tier 1 (in-scene) characters, add evolution context

**Addition to Tier 1 output:**
```
### Quinn
Personality: [synthesized current personality]
...
Evolution: Was reserved (Day 1-3) → growing more open (Day 5+) — 3 observations confirm
Currently processing: grief over mother revelation (Day 12) [emotional_state, not core trait]
```

The "Currently processing" line comes from recent `emotional_state` classified observations — things that are happening TO the character right now but aren't personality changes.

**No additional DB queries for Tier 1.** The trajectory/observation data can be loaded in the existing `storyCharacter.findMany` via `include: { trajectories: { take: 5 }, observations: { where: { accepted: { not: false } }, take: 5, orderBy: { createdAt: 'desc' } } }`.

Tier 2 and Tier 3 characters remain unchanged — they read from the synthesized cache (which is the `StoryCharacter` fields).

### Phase 7: Character Review UI

**New route:** `apps/web/src/app/(chat)/stories/[story-id]/characters/[character-id]/page.tsx`

**Server actions:**
- `get-character-detail.ts` — character + observations + trajectories
- `accept-observation.ts` — sets `accepted: true`, triggers synthesis
- `reject-observation.ts` — sets `accepted: false`, adds `curatedNote`, triggers synthesis
- `reclassify-observation.ts` — updates `classification`, triggers synthesis
- `add-observation-note.ts` — sets `curatedNote`

**Page layout:**
1. **Header:** Character name, status, `synthesisStatus` indicator (green dot = current, spinner = processing, yellow dot = stale)
2. **Current Portrait:** The synthesized cache — personality, motives, relationships, etc. Each field shows its source (observation ID or trajectory point)
3. **Observation Timeline:** Chronological list grouped by field
   - Each observation: content, classification badge, accepted/rejected/unreviewed status
   - Expandable: `sourcePassage` + `sourceContext` (the actual transcript text)
   - Actions: Accept, Reject, Reclassify dropdown, Add Note
4. **Trajectory Skeleton:** Summary-derived guideposts with status badges (active/confirmed/contradicted)
5. **Unreviewed Queue:** Observations sorted by impact (observations that would change the portrait if accepted/rejected)

**Navigation:** Add a "Characters" tab to the existing story page sidebar (alongside Moments, Arcs, Transcripts, Workspace).

### Phase 8: Drift Detection Enhancement

- When processing summaries AFTER transcripts: `apply-skeleton.ts` checks new trajectory points against existing observations. Contradictions are flagged.
- When processing transcripts AFTER summaries: `apply-observations.ts` checks new observations against existing trajectory points. `alignment` field is set.
- Accumulating contradictions against a single trajectory point suggest the summary was wrong about that character beat.
- Surface contradicted trajectories in the character review UI with a warning badge.

---

## Processing Order

**Recommended:** Import summaries first (builds skeleton), then import transcripts (ground truth observations reconciled against skeleton).

**Also works:** Transcripts first. Observations exist without a skeleton. When summaries are imported later, trajectory points are checked against existing observations. `apply-observations.ts` can retroactively link existing observations to new trajectory points during the next synthesis pass.

---

## Adversarial Review Findings Addressed

| Finding | Severity | Resolution |
|---------|----------|------------|
| `judge` fallthrough in `applyExtraction` | CRITICAL | Pre-fix #1 |
| Upsert overwrites unconditionally | CRITICAL | Pre-fix #2 |
| `synthesize-character-portrait.ts` doesn't exist | CRITICAL | Phase 5 creates it |
| Merge path skips `indexCharacter` | MAJOR | Pre-fix #3 |
| `buildCastInjection` heavy queries | MAJOR | Phase 6 adds include, doesn't add queries |
| Documents in `StoryTranscript` | MAJOR | Accepted as-is; `sourceType` discriminates |
| `cachedSoul` no invalidation | MAJOR | Out of scope — separate fix (add `onSettingsChange` hook) |
| `judgeCharacterMatch` bifurcation | MAJOR | Pre-fix #1 resolves |
| `CHARACTER_FIELDS` duplication | MINOR | Pre-fix #4 |
| `recentMoments` N+1 | MINOR | Pre-fix #5 |
| `sourceTranscriptId` FK ambiguity | MINOR | Accepted — join on `sourceType` |
| Schema missing new models | CRITICAL | Phase 2 adds them |
| Live vs import prompt split | CRITICAL | Intentional — live stays on Haiku, import on Opus |
| No characters sub-route | MAJOR | Phase 7 creates it |
| `momentId` FK population | REJECTED | Works correctly — `created.id` used immediately |

---

## Files Changed (Summary)

**New files (8):**
- `build-skeleton-extraction-prompt.ts`
- `parse-skeleton-result.ts`
- `apply-skeleton.ts`
- `apply-observations.ts`
- `synthesize-character-portrait.ts`
- `character-fields.ts` (shared constant)
- `stories/[story-id]/characters/[character-id]/page.tsx`
- Server actions for character review (5 files)

**Modified files (6):**
- `schema.prisma` — new models + back-relations
- `apply-extraction.ts` — wire judge, null-guard upsert, re-index merge, add `skipCharacterWrites` param
- `tool-import-document.ts` — use skeleton prompt, call `apply-skeleton`
- `tool-import-transcript.ts` — call `apply-observations` after extraction, fix recentMoments N+1
- `build-import-extraction-prompt.ts` — add trajectory context + sourcePassage/classification fields
- `build-cast-injection.ts` — Tier 1 evolution context via includes

**Unchanged (intentionally):**
- `extract-story-state.ts` — live extraction stays on current path
- `build-extraction-prompt.ts` — live prompt unchanged
