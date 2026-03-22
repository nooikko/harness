---
id: dialog-aria-describedby-compliance
trigger: when test output warns about missing `Description` or `aria-describedby` for DialogContent components
confidence: 0.55
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Dialog Accessibility Attribute Compliance

## Action
When Dialog/Modal components generate accessibility warnings about missing `Description` or `aria-describedby` attributes, add `aria-describedby={undefined}` to the DialogContent component to suppress the warning and maintain accessibility compliance.

## Evidence
- Observed warnings in multiple dialog components during test runs (2026-03-17T02:03:16Z):
  - ErrorDetailModal (error-detail-modal.test.tsx)
  - CreateTaskDialog (create-task-dialog.test.tsx)
  - EditAgentForm (edit-agent-form.test.tsx)
- Pattern: Test warnings about missing aria attributes appear across multiple files
- Response: Edit added `aria-describedby={undefined}` to DialogContent in error-detail-modal.tsx (2026-03-17T02:04:27Z)
- Indicates systematic accessibility compliance work across dialog components

## Context
The harness project is working to address accessibility compliance warnings in Radix UI Dialog components. When warnings appear, the fix is to explicitly set `aria-describedby={undefined}` on the DialogContent component to indicate that no description is needed, suppressing the accessibility warning.

## Related Instincts
- test-edit-pause.md: Test-driven fix cycles pattern
