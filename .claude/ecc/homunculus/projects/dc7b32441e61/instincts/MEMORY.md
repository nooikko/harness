# Project Instincts Index

216 project-scoped instincts across 6 domains: code-style (59), testing (45), workflow (96), debugging (6), file-patterns (11), git (2).

Key instinct clusters have been distilled into `.claude/rules/` files with path-scoped activation:
- `plugin-development-patterns.md` — triggers on `packages/plugins/**`
- `integration-testing-patterns.md` — triggers on `tests/integration/**`
- `server-action-patterns.md` — triggers on `apps/web/**/_actions/**`

Two evolved commands are available in `evolved/commands/`:
- `new-plugin.md` — scaffold a new plugin package
- `test-plugin.md` — generate tests for a plugin

Run `/instinct-status` to see all instincts with confidence scores.
