---
name: Storytelling plugin status
description: Current state of the storytelling plugin — phases complete, import onboarding progress, tool inventory
type: project
---

## Storytelling Plugin — Current State (2026-03-22)

**Phase 1+2**: Complete (narrative formatting, OOC commands, story model, emergent character detection, knowledge tracking, cast injection, 6 MCP tools)

**Story Import Onboarding**: Batches 1-3 complete, Batch 4 (Review UI) pending.

**Plan**: `AI_RESEARCH/plans/story-import-onboarding.md` — adversarial-reviewed, all critical/high fixes applied.

### Import Tool Inventory (16 MCP tools total)

| Category | Tools |
|----------|-------|
| Original (Phase 2) | update_character, record_moment, advance_time, add_location, character_knowledge, get_character |
| Batch 1: Import | import_characters, import_document, import_transcript |
| Batch 2: Canonicalization | detect_duplicates, merge_moments, restore_moment, correct_moment |
| Batch 3: Arcs | create_arc, discover_arc_moments, annotate_moment |

### Schema Additions (Phase 1)
- StoryArc (name, description, ArcStatus enum, importance, annotation)
- MomentInArc (many-to-many join, float position, note)
- StoryTranscript (rawContent, processedThrough, totalChunks for resume)
- StoryMoment: sourceTranscriptId, sourceChunkIndex, sourceNotes, annotation, deletedAt, mergedIntoId
- CharacterInMoment: relationshipContext
- StoryCharacter: importNotes

### Test Coverage
305 tests across 36 files in the storytelling plugin.

### What's Next — Batch 4: Review UI
The plan calls for:
1. **Moment browser** (`/stories/[storyId]/moments/`) — chronological timeline, filter by character/pair/location/arc/importance, text search, multi-select for arc linking
2. **Arc editor** (`/stories/[storyId]/arcs/`) — arc list sidebar, detail view with ordered moments, drag reorder, "Discover more" button, suggestion queue
3. **Character relationship view** — shared moments between character pairs, chronological
4. **Transcript viewer** (`/stories/[storyId]/transcripts/`) — color-coded speakers, moment highlights overlaid
5. **Import progress dashboard** — characters loaded, transcripts processed, moments extracted, arcs identified

Server actions needed: list-story-moments, update-story-moment, list-story-arcs, create-story-arc, update-story-arc, add-moments-to-arc, remove-moment-from-arc, list-story-transcripts, store-story-transcript, list-character-shared-moments

**Why:** This story is therapeutic — the six volleyball girls are parts of the user's inner self. Fidelity is non-negotiable. The review UI is the primary work interface for days of annotation, correction, and arc building.
