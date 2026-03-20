---
id: post-test-validation-pipeline
trigger: when sequential Bash commands execute after test runs with empty output
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Post-Test Validation Pipeline

## Action
After running tests successfully, expect multiple sequential Bash commands (5+ times) to execute automatically, likely running build, lint, typecheck, and additional test validation steps—these are pipeline stages, not failures.

## Evidence
- Observed 5 sequential Bash calls: 23:07:46, 23:08:14, 23:10:11, 23:10:17, 23:10:35 (total 5+ occurrences)
- Pattern: Edit test file → Bash (test run passes) → Bash (empty) → Bash (empty) → ... → Bash (error with TTY issue)
- Most calls have empty output (silent build/validation steps)
- Last observed: 2026-03-15T23:10:35Z in session 4856ee0a-a85e-44ce-988d-133f25f77051

## Workflow Context
The pipeline appears to run:
1. Test execution (shows test results)
2-5. Silent validation steps (likely: build, lint, typecheck, or additional test runs)
6. May fail if interactive terminal required (TTY error observed)

These are not individual independent commands but part of a coordinated validation workflow.

## Key Insight
Don't interpret empty-output Bash calls as errors—they're normal pipeline stages. The workflow is healthier than just test-then-done; it validates comprehensively.
