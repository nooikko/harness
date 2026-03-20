---
id: date-rendering-radix-select-test-issues
trigger: when date rendering tests or Radix UI Select component tests fail
confidence: 0.5
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Date Rendering and Radix UI Select Test Failures

## Action
When tests fail for date-related text rendering or Radix UI Select components, verify date format expectations match the actual rendered output and ensure all SelectItem components have non-empty value props.

## Evidence
- Observed 5 test failures in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-15 23:24:30)
- Pattern: Tests passing locally but failing in full test run, suggesting timezone or date formatting differences
- Specific failures:
  1. "renders due today for task due today" - likely date format mismatch
  2. "renders due tomorrow for task due in 1 day" - relative date formatting issue
  3. "renders due date when present" - absolute date format mismatch
  4. "renders completed date when present" - date format expectation issue
  5. "renders project select when projects are available" - Radix UI Select validation: "A <Select.Item /> must have a value prop that is not an empty string"
- Last observed: 2026-03-15T23:24:30Z
- Root causes: Date locale/timezone formatting differences, Radix UI Select requiring non-empty value props on all items

## Related Issues
- Date tests often work in isolation but fail in batch runs (potential timezone difference between test environments)
- Radix UI Select component requires explicit value props with non-empty strings to avoid React validation errors
