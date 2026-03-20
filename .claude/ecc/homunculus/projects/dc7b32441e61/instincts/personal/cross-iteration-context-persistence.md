---
id: cross-iteration-context-persistence
trigger: when running multi-iteration autonomous workflows across separate Claude Code sessions
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Cross-Iteration Context Persistence Pattern

## Action
Use a shared notes file (SHARED_TASK_NOTES.md) to persist progress, next steps, and context across independent Claude Code invocations in multi-iteration loops.

## Evidence
- Session 905fb573-64e3-4089-9b22-87ac0b25d2dc: Agent research identified SHARED_TASK_NOTES.md as critical innovation for continuous-claude loops (lines 266-281 of autonomous-loops skill)
- Continuous-claude CLI tool explicitly supports --notes-file parameter (defaults to SHARED_TASK_NOTES.md)
- Project hooks include post-merge-validate.py suggesting iteration-based merge workflows
- Each iteration runs in isolation (separate git worktree, fresh context window), requires bridging via shared file
- Last observed: 2026-03-13

## Why This Pattern Matters

When running autonomous development loops with multiple iterations (using `continuous-claude` or separate `claude -p` calls), each invocation is isolated:
- Fresh context window (can't reference previous outputs)
- Separate git worktree (can't see previous working directory state)
- Independent execution (each iteration must be self-contained)

Without shared context, the next iteration has to re-discover:
- What work was completed
- What failed and why
- What to attempt next
- Test setup, mocking, or environment state

## Standard Structure

SHARED_TASK_NOTES.md should contain:

```
## Progress Checklist
- [x] Implemented auth module
- [ ] Add rate limiting
- [ ] Test with 1000 concurrent users

## Next Steps (Priority Order)
1. Rate limiting on POST /api/auth endpoints
2. Add redis cache for session tokens
3. Load test verification

## Notes for Next Iteration
- Mock setup reusable: see tests/mocks/stripe.ts
- Clerk integration already working, don't touch auth module
- CI gate: all tests must pass on node 20
```

## When to Use

- Multi-day autonomous loops (`continuous-claude -m 10` or `/engine` style automation)
- Feature work broken into smaller iterations
- Team handoff between human and AI development
- Time-boxed autonomous passes (e.g., "spend 2 hours on testing")

## File Lifecycle

1. **Created** at loop start or iteration 1
2. **Read** at iteration start (refresh context)
3. **Updated** at iteration end (record progress + next steps)
4. **Pruned** to stay actionable (remove completed items, keep only forward-looking)
