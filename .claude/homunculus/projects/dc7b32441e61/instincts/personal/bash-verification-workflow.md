---
id: bash-verification-workflow
trigger: when making code changes or completing fixes
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Bash Verification Workflow

## Action
After significant code changes or fixes, run comprehensive test suite via Bash to verify no regressions.

## Evidence
- Session 31c444d9-8205-4bd5-af0b-09f5495a3367: After editing M1-M7 stability fixes, user ran `npm test` showing 714 tests passing across 54 test files
- Session 75f4fdab-d328-44c8-9d7e-443e67343229: Bash used for git status verification
- Session 4f4992b7-684f-4b35-9264-f6e40ea49329: Bash for verification checks
- Total: 5 Bash operations across 3 sessions, 2 with test/verification output

## Pattern
User demonstrates consistent pattern of using Bash for:
1. Running test suites after fixes
2. Checking git state before major changes
3. Verification and validation commands

Indicates strong preference for immediate feedback loop: Change → Verify → Document.
