# Research: Claude Code Context Files — Monorepo & Execution-Path Patterns
Date: 2026-02-26

## Summary

Focused supplement to `2026-02-26-claude-code-memory-context-mechanisms.md`, covering
monorepo-specific CLAUDE.md strategies, the "execution path level" documentation pattern,
known bugs that affect path-scoped rules, and concrete strategies for keeping context
current. Findings sourced from official docs, open GitHub issues, and community reports.

## Prior Research
- `/mnt/ramdisk/harness/AI_RESEARCH/2026-02-26-claude-code-memory-context-mechanisms.md`
  (complete mechanism inventory — load timing, update authority, precedence hierarchy)

---

## 1. Complete Mechanism Inventory (cross-reference)

See prior research file for full table. Short version for this document:

| File / Path | Loads at | Editable by |
|---|---|---|
| `CLAUDE.md` (root, ancestors) | Session start | Humans |
| `.claude/CLAUDE.md` | Session start | Humans |
| `CLAUDE.local.md` | Session start | Humans (gitignored) |
| `.claude/rules/*.md` | Session start (always-on) or on match (path-scoped) | Humans |
| `~/.claude/CLAUDE.md` | Session start | Humans |
| `packages/*/CLAUDE.md` (subdirs) | On demand when files in subtree are Read() | Humans |
| `~/.claude/projects/<hash>/memory/MEMORY.md` (first 200 lines) | Session start | Claude auto-writes; humans can edit |
| Skills (`SKILL.md`) | On demand when invoked via `/skill-name` | Humans |

**Critical nuance about subdirectory CLAUDE.md:** The lazy-loading mechanism only fires
when Claude uses the `Read()` tool on a file in that subtree. It does NOT fire if the
user injects the file via `@path/to/file` in a prompt. (Source: GitHub issue #2571,
Anthropic collaborator confirmation July 2025.)

---

## 2. .claude/rules/ — Current Status and Known Bugs

### What is confirmed working (HIGH confidence)
- All `.md` files in `.claude/rules/` and subdirectories load at session start.
- YAML frontmatter `paths:` field accepts YAML sequences (list syntax) and quoted strings.
- Subdirectories are supported and discovered recursively.
- Symlinks are supported with circular-symlink protection.

### Confirmed YAML syntax (post-fix, January 11, 2026)
The doc examples were updated. Use YAML list syntax with quoted globs:

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "packages/orchestrator/**/*.ts"
---
```

Single-line unquoted glob syntax like `paths: *.ts` or `paths: {src,lib}/**/*.ts` was
broken in docs (YAML reserved characters). Fixed in docs as of Jan 11, 2026.
(Source: GitHub issue #13905, closed resolved.)

### Active bug: path-scoped rules load globally (LOW confidence for conditional behavior)
As of February 23, 2026, GitHub issue #16299 is OPEN and confirmed in v2.1.5+:

> Path-scoped rules with `paths:` frontmatter load into context at session start
> REGARDLESS of whether any matching file is being worked on.

**Impact:** Rules accumulate throughout the session. Once loaded, they never deactivate.
This creates context bloat but does NOT cause incorrect behavior — it just means path-scoped
rules behave as always-on rules (they load at start rather than conditionally).

**Implication for architecture context:** The "pay only when you need it" promise of path-
scoped rules is currently broken. Treat all `.claude/rules/*.md` files as if they load
at session start unconditionally. Size them accordingly — each file adds to the baseline
context cost.

**Workaround:** Keep per-domain rule files lean. Use skills (SKILL.md) instead of path-
scoped rules for domain knowledge that should only load on demand.

---

## 3. Subdirectory CLAUDE.md Loading — Monorepo Behavior

### Load mechanism (confirmed official behavior)
From Anthropic collaborator bcherny (July 27, 2025):
> "This is supported today — Claude automatically reads CLAUDE.md files in subdirectories
> as it works on files in those directories."

The trigger is the `Read()` tool call. When Claude reads any file in `packages/foo/`,
it will pick up `packages/foo/CLAUDE.md` at that point.

### The @file-injection workaround gap
If a user references a file via `@packages/foo/src/index.ts` in the prompt (file
injection), the subdirectory CLAUDE.md does NOT load. This is documented in issue #2571
(closed as NOT_PLANNED, marked as a known limitation).

### Practical impact for monorepos
For a monorepo like this one (apps/web, apps/orchestrator, packages/*):

- Per-package CLAUDE.md files WILL load when Claude is reading code in that package.
- They will NOT load if the user only uses @-injection to reference files.
- Starting Claude from a specific package subdirectory (e.g., `apps/orchestrator/`) means
  that package's CLAUDE.md also loads as an ancestor file (always-on at session start).

### Recommended monorepo CLAUDE.md layout
```
harness/
  CLAUDE.md                       # repo-wide: stack, commands, code style, file layout
  .claude/
    CLAUDE.md                     # optional alt location
    rules/
      plugin-contract.md          # how plugins wire to orchestrator (always-on)
      data-flow.md                # request lifecycle traces (always-on)
  apps/
    orchestrator/
      CLAUDE.md                   # entry points, key files, execution paths for orchestrator
    web/
      CLAUDE.md                   # Next.js App Router patterns, RSC boundaries
  packages/
    plugins/
      context/
        CLAUDE.md                 # context plugin contract and data flow
      delegation/
        CLAUDE.md                 # delegation plugin specifics
    database/
      CLAUDE.md                   # schema notes, migration patterns
```

Root `CLAUDE.md` loads at session start always. Package-level files load on demand
when Claude reads files in that package.

---

## 4. Execution-Path Documentation Pattern

### What "execution path level" means
Rather than documenting "what exists" (e.g., "there is a plugin system"), document
"how X reaches Y" — the precise chain of function calls, files, and boundaries that
connect a user action to its effect.

### The O'Reilly-documented pattern (MEDIUM confidence, community source)
From https://www.oreilly.com/radar/reverse-engineering-your-software-architecture-with-claude-code-to-help-claude-code/

The author documents architecture as:
1. **Flow maps**: "UI -> BFF -> API -> update DB -> publish event -> handler -> use case"
2. **Reference tables**: maps artifact names (endpoint, event name, DB table) to business flows
3. **Event boundaries**: what signal marks each step as complete
4. **Requirements-as-constraints**: "read the entire workflow to see ALL events" — direct
   instructions that prevent Claude's known hallucination of incomplete discovery

### Applying this to the Harness codebase
For the specific problem of Claude making wrong architectural recommendations due to not
tracing execution paths deeply enough, the pattern is:

**Document the exact call chain in CLAUDE.md or a rules file, with file:line pointers.**

Example (for `.claude/rules/data-flow.md`):

```markdown
## Request Lifecycle: Web Chat to Claude Response

1. `apps/web/src/app/(chat)/chat/_actions/send-message.ts`
   — persists user message to DB, then POST to orchestrator

2. `apps/orchestrator/src/tool-server/index.ts` (onChatMessage handler)
   — receives HTTP, calls ctx.sendToThread(threadId, message)

3. `apps/orchestrator/src/index.ts` (sendToThread)
   — fire-and-forget: calls handleMessage then persists results

4. `apps/orchestrator/src/orchestrator/index.ts` (handleMessage)
   — SIDE-EFFECT FREE: returns stream events only, does NOT persist

5. `apps/orchestrator/src/invoker-sdk/index.ts` (invoke)
   — runs Claude agent, emits onMessage callbacks

6. `apps/orchestrator/src/invoker-sdk/_helpers/map-stream-event.ts`
   — transforms raw Anthropic SDK stream events to typed StreamEvent union

## Plugin Hook Wiring

Plugin registration: `apps/orchestrator/src/plugin-registry/index.ts`
Hook execution: each plugin's `onChatMessage(ctx)` is called from tool-server
Plugin contract: `packages/plugin-contract/src/index.ts` (PluginContext type)

INVARIANT: Plugins receive `ctx: PluginContext` — they call ctx.sendToThread,
never directly writing to DB or calling Anthropic SDK.
```

### Why file:line references improve Claude's reasoning
Claude can `Read()` the referenced file to verify the claim. This makes the documentation
self-verifiable — Claude can check whether the stated behavior matches the actual code,
and update its understanding if there's a drift.

---

## 5. Keeping Context Files Current

### Option A: Manual "handoff" discipline
After finishing a major change, explicitly instruct Claude to update the relevant context
files. The `/handoff` skill pattern in this codebase automates part of this.

**What to say:** "Update `.claude/rules/data-flow.md` to reflect the new sendToThread
signature we just implemented" — Claude will Read the file, diff it against the current
code, and rewrite the relevant sections.

### Option B: PostToolUse hook for documentation reminder
A hook can fire after a file write/edit and check if the modified file is in a "watched"
set (e.g., `apps/orchestrator/src/orchestrator/index.ts`) and emit a reminder to update
the corresponding rules file.

```json
// .claude/settings.json (hooks section)
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/check-context-drift.sh"
          }
        ]
      }
    ]
  }
}
```

The `Stop` hook fires when Claude finishes responding. The script can check `git diff --name-only`
against a list of "architecturally significant" files and output a reminder if any changed
but the corresponding rules file was not also changed.

**Limitation:** Stop hooks cannot inject the reminder back into the current context; the
output is shown to the user as a notification-style message. It cannot force Claude to
update the file — it is a prompt to the human.

### Option C: SessionStart hook to detect drift
A `SessionStart` hook can diff the current state of key files against a checksum stored
in `.claude/context-checksums.json`. If an architecturally significant file changed since
the last session, the hook outputs a warning injected into Claude's context at session
start:

```bash
#!/bin/bash
# .claude/hooks/detect-context-drift.sh
# Reads from stdin: {"session_id": "...", "cwd": "..."}
# Outputs: { "hookSpecificOutput": { "additionalContext": "..." } }
```

The `additionalContext` field in SessionStart hook output is injected into Claude's
system prompt for that session. This is a fully automated approach.

**Limitation:** No official documentation confirms that `additionalContext` is the exact
field name for SessionStart output injection. The hooks reference documents output formats
per event type — verify against https://code.claude.com/docs/en/hooks before implementing.

### Option D: Encode staleness warnings in the rules files themselves
Add a section at the top of architecture rules files:

```markdown
---
# STALENESS PROTOCOL
# When you modify any file listed in the "Key Files" section of this document,
# verify the execution-path description below is still accurate.
# If it changed, update this file as part of the same commit.
---
```

This is a human-process constraint, not automated, but it creates an explicit link between
code changes and documentation updates in Claude's context.

### Option E: @import live files instead of duplicating content
Instead of rewriting `package.json` contents into CLAUDE.md, use:

```markdown
Available npm scripts: @package.json
Database schema: @packages/database/prisma/schema.prisma
Plugin contract types: @packages/plugin-contract/src/index.ts
```

These imports are always live — they reflect the current state of the file at session
load time. No drift possible. The schema is always accurate.

**Limitation:** Large files (like `schema.prisma` or `package.json`) will consume context
tokens for every session, not just relevant ones. Use judiciously.

---

## 6. Recommended Starting Point for This Codebase

Given the specific problem (Claude makes wrong recommendations because it doesn't trace
execution paths), the highest-ROI changes in order:

### Step 1: Create `.claude/rules/data-flow.md` (always-on, no paths frontmatter)

Document the exact call chain for the three most commonly misunderstood paths:
1. Web chat message → Claude response (the full pipeline)
2. Plugin hook registration and invocation chain
3. handleMessage (side-effect-free) vs sendToThread (persists) distinction

Keep it under 150 lines. File:line references are more valuable than prose.

### Step 2: Create `.claude/rules/architectural-invariants.md`

Short file (30-50 lines) listing the invariants that Claude keeps violating:
- "handleMessage is SIDE-EFFECT FREE — never add DB writes here"
- "Plugins call ctx.sendToThread, never the DB directly"
- "mapStreamEvent is the only place raw Anthropic SDK events are transformed"

These are the constraints that prevent wrong recommendations.

### Step 3: Add per-package CLAUDE.md files for the orchestrator and web app

`apps/orchestrator/CLAUDE.md` — entry points, key functions, what belongs where
`apps/web/CLAUDE.md` — RSC boundaries, client component constraints, where server actions live

These load lazily when working in those directories, or can be triggered by starting
Claude from within that directory.

### Step 4: Use @imports for live source-of-truth files

In root `CLAUDE.md`, add:
```markdown
Plugin contract (source of truth): @packages/plugin-contract/src/index.ts
Database schema (source of truth): @packages/database/prisma/schema.prisma
```

### Step 5: Encode the "update docs" protocol in CLAUDE.md

Add a section to root CLAUDE.md:
```markdown
## Architectural Context Maintenance
When modifying files in `apps/orchestrator/src/orchestrator/` or
`apps/orchestrator/src/invoker-sdk/`, verify `.claude/rules/data-flow.md`
still accurately describes the call chain and update it if needed.
```

---

## Key Takeaways

1. **Path-scoped rules in `.claude/rules/` currently load globally** (bug #16299, open as
   of Feb 2026). Treat ALL rules files as always-on. Keep them lean.

2. **Subdirectory CLAUDE.md lazy loading works** when Claude uses Read() tool, but NOT
   when files are @-injected. Starting Claude from a package subdirectory makes that
   package's CLAUDE.md an ancestor (always-on).

3. **@import live source files** (schema.prisma, package.json) instead of copy-pasting
   their contents — eliminates drift for high-churn artifacts.

4. **File:line references beat prose** for execution path documentation. Claude can
   verify them by reading the actual files.

5. **The Stop hook** is the best hook for detecting documentation drift, but it only
   produces a notification — it cannot force an update. Human discipline is still required.

6. **Auto memory MEMORY.md** (200-line limit) is Claude's writable scratch pad. It is
   keyed to the git repo root, so all packages in this monorepo share it. It's best
   for session-specific learnings, not architectural invariants (use CLAUDE.md for those).

---

## Sources

- https://code.claude.com/docs/en/memory (HIGH confidence — official docs)
- https://code.claude.com/docs/en/hooks (HIGH confidence — official docs)
- https://github.com/anthropics/claude-code/issues/16299 (path-scoped rules bug, OPEN Feb 2026)
- https://github.com/anthropics/claude-code/issues/13905 (YAML syntax bug, FIXED Jan 2026)
- https://github.com/anthropics/claude-code/issues/2571 (subdirectory loading, CLOSED not-planned)
- https://github.com/anthropics/claude-code/issues/4275 (lazy loading confirmation, CLOSED completed Jul 2025)
- https://www.oreilly.com/radar/reverse-engineering-your-software-architecture-with-claude-code-to-help-claude-code/ (MEDIUM — community/O'Reilly)
- https://claudefa.st/blog/guide/mechanics/rules-directory (MEDIUM — community)
- https://github.com/shanraisshan/claude-code-best-practice/blob/main/reports/claude-md-for-larger-mono-repos.md (MEDIUM — community)
- https://serenitiesai.com/articles/claude-md-complete-guide-2026 (LOW — community guide)
