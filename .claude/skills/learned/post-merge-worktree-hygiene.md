---
name: post-merge-worktree-hygiene
description: "Fix typecheck failures after merging worktree branches that add Prisma models or npm deps"
user-invocable: false
origin: auto-extracted
---

# Post-Merge Worktree Hygiene (Prisma + pnpm)

**Extracted:** 2026-03-13
**Context:** Harness monorepo — Prisma ORM, pnpm workspaces, git worktrees

## Problem

After merging a feature branch (especially from a git worktree) that introduces new
Prisma models or npm dependencies, `git merge` only updates source files and the
lockfile. It does NOT:

1. Regenerate the Prisma client — new model accessors (e.g. `prisma.file`) won't
   exist in the generated types
2. Install new npm packages — imports for newly-added deps will fail typecheck

Pre-push hooks (typecheck/lint) fail even though the merge succeeded cleanly.

## Solution

After any merge that touches `schema.prisma` or `package.json`:

```bash
pnpm db:generate   # regenerate Prisma client with new/changed models
pnpm install       # resolve any new dependencies from merged lockfile
```

Then push.

## Diagnostic Signs

- `error TS2339: Property 'X' does not exist on type 'PrismaClient'` → `pnpm db:generate`
- `error TS2307: Cannot find module 'X'` → `pnpm install`

## When to Use

- After `git merge` of a branch that added Prisma models or npm dependencies
- After merging worktree branches (worktrees have separate node_modules and generated output)
- When pre-push typecheck fails on code that compiled fine in the source branch
