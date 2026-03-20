---
id: post-merge-state-restoration
trigger: when merging a git worktree branch into main
confidence: 0.75
domain: git
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Post-Merge State Restoration Required After Worktree Merges

## Action
After merging a worktree branch, regenerate any generated code (Prisma client) and reinstall dependencies before pushing, even if merge succeeds cleanly.

## Evidence
- Session 905fb573-64e3-4089-9b22-87ac0b25d2dc: Created post-merge-worktree-hygiene skill documenting Prisma client regen failures after merges
- Project settings include PostToolUse hook: post-merge-validate.py (validates after git merge operations)
- Project permissions explicitly allow both Bash(git worktree:*) and Bash(pnpm db:*) together
- Continuous-claude research identified worktrees + parallel execution as common pattern requiring state coordination
- Last observed: 2026-03-13

## Why This Matters
Git worktree branches have isolated node_modules and generated output directories. When merged back to main, the merge operation updates source files but NOT the generated code or installed packages. This causes typecheck/lint failures on pre-push hooks even though the merge was clean.

## Worktree-Specific Issue
- Worktree A installs deps + generates Prisma client
- Worktree A's changes merge cleanly to main
- Main's pre-push hook runs typecheck
- TypeCheck fails: missing Prisma accessors or package imports
- Root cause: Main's node_modules is stale, Prisma client is stale

## Solution Pattern
```bash
# After: git merge feature-branch
pnpm db:generate     # Regenerate Prisma client
pnpm install         # Resolve any new deps from merged lockfile
pnpm typecheck       # Verify before pushing
```
