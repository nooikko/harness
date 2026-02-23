# Pre-Commit Coverage Gate Design

Date: 2026-02-23

## Problem

Agents working in git worktrees can commit code without adequate test coverage. There is no enforcement mechanism to ensure changed files have tests, and no guard against barrel-only re-export files which violate project conventions.

## Solution

Two pre-commit enforcement mechanisms running in both Husky (git hooks) and Claude Code (PreToolUse hooks):

1. **Barrel file detector** - instantly rejects files that are purely re-exports
2. **Coverage gate** - runs Vitest with `--related` on staged files, enforces 80% line + branch coverage

## Architecture

### Barrel File Detector

Scans ALL staged `.ts/.tsx` files. A file is a "barrel" if every non-empty, non-comment line is a re-export (`export * from`, `export { ... } from`, `export type { ... } from`). Detection runs before any tests, fails immediately on match.

This applies to all staged files universally, including existing files. Current violations (e.g., `packages/ui/src/index.ts`) must be refactored.

### Coverage Gate

Flow:
1. Get staged `.ts/.tsx` files via `git diff --cached --name-only --diff-filter=ACMR`
2. Filter out: `*.config.ts`, `*.d.ts`, `prisma/generated/**`, `.next/**`, `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
3. If no testable files remain, pass
4. Run `vitest run --coverage --reporter=json --coverage.reporter=json --related <files>`
5. Parse `coverage/coverage-final.json`
6. Check each staged file: line coverage >= 80% AND branch coverage >= 80%
7. Fail with per-file report if any file is below threshold

Coverage provider: `@vitest/coverage-v8`

### Integration Points

**Husky pre-commit** (`.husky/pre-commit`):
```
pnpm lint-staged
pnpm sherif
pnpm test:coverage-gate
```

Replaces `pnpm test` with `pnpm test:coverage-gate`.

**Claude Code PreToolUse hook** (`pre-commit-validate.py`):
Add `pnpm test:coverage-gate` to the checks list alongside typecheck, lint, build.

**New root script**: `"test:coverage-gate": "python3 scripts/coverage-gate.py"`

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| `scripts/coverage-gate.py` | Create | Barrel detection + coverage enforcement |
| `package.json` (root) | Modify | Add `test:coverage-gate` script |
| `.husky/pre-commit` | Modify | Replace `pnpm test` with `pnpm test:coverage-gate` |
| `.claude/hooks/pre-commit-validate.py` | Modify | Add coverage-gate to checks |
| `vitest.config.ts` (root) | Modify | Add coverage config |
| Per-package `vitest.config.ts` | Modify | Add coverage config blocks |
| `packages/ui/src/index.ts` | Modify | Refactor from barrel to direct exports |

### Exclusions from Coverage

- `*.config.ts` (configuration files)
- `*.d.ts` (type declaration files)
- `prisma/generated/**` (generated Prisma types)
- `.next/**` (Next.js build output)
- `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` (test files themselves)

### Failure Output

Barrel detection:
```
Barrel file detected (re-export only):

  packages/ui/src/index.ts
    Contains only re-exports. Add logic or remove the file.

Barrel files are not allowed. Move exports to their source modules.
```

Coverage failure:
```
Coverage check failed for changed files (minimum: 80%):

  apps/orchestrator/src/invoker/_helpers/build-args.ts
    Lines:    45% (need 80%)
    Branches: 33% (need 80%)

  apps/web/src/app/page.tsx
    Lines:    72% (need 80%)
    Branches: 80% (ok)

Add tests for these files before committing.
```

## Dependencies

- `@vitest/coverage-v8` (new dev dependency at root and per-package)
- Python 3 (already available, used by all existing hooks)

## Decisions

- **80% threshold** for both line and branch coverage
- **Python script** for consistency with existing hook infrastructure
- **Dual enforcement** via both Husky and Claude Code hooks
- **`--related` flag** for fast, targeted test runs based on Vitest's module graph
- **Universal barrel detection** - no grandfathering of existing barrels
