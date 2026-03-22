---
id: plan-section-incremental-editing
trigger: when editing a multi-section plan document
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plan-Driven Incremental Section Editing

## Action
When editing a plan document with multiple sections, read one section → edit that section → read again to verify the change → move to next section. Don't edit multiple sections in one pass.

## Evidence
- Observed 7 times in session 9fc9b500-3fe7-4994-9892-df5e7e684625 (2026-03-14)
- Sequence: Read plugin-consolidation.md section → Edit exports field → Read to verify → Edit alternative approaches → Read again (06:36:28 through 06:36:58)
- Pattern: Consistent cycle across 30 minutes of plan refinement
- Each read-edit-verify cycle ensures section changes are correct before moving forward
- Last observed: 2026-03-14T06:36:58Z

## Rationale
Section-by-section editing with inline verification prevents coordinating errors across multiple changes and allows plan to evolve incrementally without holding multiple pending edits.
