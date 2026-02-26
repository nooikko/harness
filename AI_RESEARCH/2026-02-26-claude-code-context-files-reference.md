# Claude Code Context Files: Complete Reference
*Date: 2026-02-26 | Sources: Context7 official docs (HIGH), web research + GitHub issues*

## All Available Mechanisms

| Mechanism | Path | Loads | Shared via git | Who writes |
|-----------|------|-------|----------------|------------|
| Root CLAUDE.md | `CLAUDE.md` or `.claude/CLAUDE.md` | Session start, always | Yes | Humans |
| Private CLAUDE | `CLAUDE.local.md` | Session start, always | No (gitignored) | Humans |
| Rules directory | `.claude/rules/*.md` | Session start, always* | Yes | Humans |
| User CLAUDE.md | `~/.claude/CLAUDE.md` | Session start, always | No | Humans |
| Per-package CLAUDE.md | `packages/*/CLAUDE.md` | Lazy (when Read() hits that subtree) | Yes | Humans |
| Auto memory | `~/.claude/projects/<git-root>/memory/MEMORY.md` (first 200 lines) | Session start, always | No | Claude auto-writes |
| Skills | `.claude/skills/*/SKILL.md` | On-demand when invoked | Yes | Humans |
| Agents | `.claude/agents/*.md` | On-demand when delegated | Yes | Humans |

*Path-scoping is currently broken — see bugs section.

## Precedence Order (highest → lowest)
1. Managed policy (enterprise system dirs)
2. `~/.claude/CLAUDE.md` (user)
3. Root `CLAUDE.md` / `.claude/CLAUDE.md` (ancestors)
4. `.claude/rules/*.md`
5. `CLAUDE.local.md` (ancestors)
6. Auto memory `MEMORY.md`
7. Per-subdirectory `CLAUDE.md` (lazy)
8. Skills (on-demand)
9. Agents (on-demand)

## @import Syntax

Works inside any CLAUDE.md or rules file:

```markdown
Plugin contract: @packages/plugin-contract/src/index.ts
Schema: @packages/database/prisma/schema.prisma
Commands: @package.json
```

Rules:
- Syntax is `@path/to/file` — NOT `@import path`
- Relative to the file containing the import (not cwd)
- Absolute and `~/` paths work
- Up to **5 hops** of recursion
- Can import TypeScript, JSON, Prisma schema, any text file — not just markdown
- Skipped inside markdown code spans/blocks
- One-time approval dialog per project on first use
- **Zero drift** — always reflects current file state

## Known Bugs (Feb 2026)

### Bug #16299 — Path-scoped rules load globally (OPEN)
`.claude/rules/` files with `paths:` frontmatter load unconditionally regardless of current directory. Rules "accumulate" — once loaded they stay for the session. No workaround, no ETA.

**Implication:** Treat all `.claude/rules/` files as always-on. Do not rely on path-scoping to limit context. Write rules files that are globally applicable, not directory-conditional.

### Bug #13905 — Invalid YAML syntax in docs (CLOSED Jan 11, 2026)
Correct YAML syntax for paths frontmatter:
```yaml
---
paths:
  - "src/**/*.ts"
  - "packages/**/*.ts"
---
```
NOT bare glob patterns. Quoted strings required.

### Issue #2571 — Subdirectory CLAUDE.md doesn't load via @-injection (CLOSED not-planned)
Per-package `CLAUDE.md` files only load when Claude uses the `Read()` tool on files in that directory. They do NOT load via `@packages/foo/CLAUDE.md` syntax.

**Implication:** Per-package CLAUDE.md files are lazy but reliable — they load when Claude is actually working in that package. Good for package-specific context.

## Auto Memory Details

- Keyed to **git repo root** — entire monorepo shares one `~/.claude/projects/<hash>/memory/` directory
- Git worktrees get **separate** auto memory directories
- Only first **200 lines** of MEMORY.md load at session start
- Additional topic files (e.g., `api-conventions.md`) load on demand
- Claude writes automatically; humans can edit via `/memory` command or directly
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` env var disables it
- Not committed to git — machine-local only

## The Execution-Path Pattern (for Architecture Problems)

The core problem: Claude makes incomplete architectural recommendations because it doesn't trace execution paths before drawing conclusions.

### Solution: `.claude/rules/data-flow.md`

Explicit file:line call chains — Claude can verify each step against actual code:

```markdown
## Plugin Hook Execution Path

BEFORE recommending any architectural change, READ each file in this chain
and verify the current behavior. Do not assume — verify.

1. packages/plugin-contract/src/index.ts
   — defines PluginContext interface (the full API surface available to plugins)
   — defines all hook types: onMessage, onChatMessage, etc.

2. apps/orchestrator/src/plugin-registry/index.ts
   — registers plugin instances, calls hooks at the right time

3. apps/orchestrator/src/index.ts (sendToThread)
   — entry point for message processing; calls handleMessage then persists

4. apps/orchestrator/src/orchestrator/index.ts (handleMessage)
   — SIDE-EFFECT FREE: never writes DB, never makes HTTP calls
   — returns StreamEvent[] only

5. apps/orchestrator/src/invoker-sdk/index.ts (invoke)
   — runs Claude agent SDK, emits onMessage callbacks to plugin hooks
```

### Solution: `.claude/rules/architectural-invariants.md`

Explicit constraints, not implicit patterns:

```markdown
## Invariants — Verify Before Recommending Changes

- handleMessage is SIDE-EFFECT FREE. Never add DB writes here.
- Plugins receive PluginContext. They never import from "database" directly.
- New capabilities = new plugins implementing plugin-contract. Not new systems.
- mapStreamEvent is the ONLY stream transformation point.
- Verify: does the hook you need exist? Read plugin-contract/src/index.ts first.
```

## Keeping Context Current

| Strategy | Effort | Drift risk |
|----------|--------|-----------|
| `@import` live source files | One-time setup | Zero — always current |
| Per-package CLAUDE.md | Write once, update on change | Low |
| Stop hook drift detection | Script (~30 lines) | Low — notifies human |
| Handoff skill updating rules | Per-session manual | Medium |
| Encode update protocol in CLAUDE.md | One-time setup | Medium (requires discipline) |

### The Stop Hook Approach

Add to `.claude/settings.json` hooks section — fires after every session:
```bash
# Check if architecturally significant files changed; warn human if so
git diff --name-only HEAD | grep -E "(plugin-contract|orchestrator/src/index|plugin-registry)" \
  && echo "WARNING: Architectural files changed. Verify .claude/rules/data-flow.md is still accurate."
```

### The @import Approach (Zero Effort, Zero Drift)

In root CLAUDE.md:
```markdown
## Live Source References (always current)
Plugin contract: @packages/plugin-contract/src/index.ts
DB schema: @packages/database/prisma/schema.prisma
```

Claude reads these directly from source — no manual sync needed.

## What This Project Already Has

Current `.claude/` structure (excluding worktrees):
- `.claude/agents/` — 6 custom agents ✓
- `.claude/hooks/` — 10 hook scripts ✓
- `.claude/skills/` — 9 skills ✓
- `.claude/settings.json` + `settings.local.json` ✓

Missing:
- `.claude/rules/` directory — not created yet
- Per-package `CLAUDE.md` files — none exist
- `@import` of live source files in root CLAUDE.md — not present
- Stop hook for drift detection — not implemented

## Implementation Priority for This Project

1. **Create `.claude/rules/data-flow.md`** — execution path trace with file references
2. **Create `.claude/rules/architectural-invariants.md`** — the explicit "before you recommend X, verify Y"
3. **Add `@import` of plugin-contract + schema** to root CLAUDE.md
4. **Add per-package CLAUDE.md** for `apps/orchestrator/` and `packages/plugin-contract/`
5. **Add Stop hook** for drift detection when architectural files change
