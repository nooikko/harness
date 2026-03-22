---
id: typecheck-driven-prop-correction
trigger: when TypeScript reports that a component prop doesn't exist on the component type
confidence: 0.6
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# TypeScript-Driven Prop Name Correction Workflow

## Action
When typecheck reveals that test fixtures or component usage reference a non-existent prop: (1) grep to find all instances of the incorrect property name, (2) systematically edit each affected file to use the correct property name, (3) rerun typecheck to validate the fix.

## Evidence
- Observed 1 complete workflow in session bbe56a1c on 2026-03-17
- Component prop mismatch: tests and error-list.tsx were using `onOpenChange` which didn't exist on ErrorDetailModalProps
- Workflow steps:
  - 03:20:02 Bash typecheck → 9 TypeScript errors reported ("Property 'onOpenChange' does not exist")
  - 03:20:07 Bash grep → found all usages of onOpenChange (8 instances in test file, 1 in component file)
  - 03:20:14-03:20:21 Read → Edit cycle: error-detail-modal.test.tsx (8 replacements), error-list.tsx (1 replacement)
  - 03:20:41 Bash typecheck → success (errors resolved)
- Total instances of the pattern: 9 individual property references corrected across 2 files
- Last observed: 2026-03-17T03:20:41Z

## Pattern Details
The corrective workflow leverages TypeScript's error output as a complete checklist:
- Error count tells you how many instances exist
- Grep pinpoints all locations quickly
- Systematic edit-per-file approach ensures nothing is missed
- Re-validation immediately confirms success

This is more efficient than manual refactoring because the type system provides both discovery and verification.
