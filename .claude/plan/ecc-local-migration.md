# Plan: Migrate ECC from Global Plugin to Repo-Local

**Status:** EXECUTED — in worktree `ecc-migration`, pending merge + global cleanup
**Merge note:** Merge LAST after all other agent sessions finish. Re-copy Homunculus data fresh from `~/.claude/homunculus/` at merge time (stale from concurrent sessions). Then disable global ECC plugin + clear sessions.
**Created:** 2026-03-20
**Scope:** ECC only (superpowers will be uninstalled separately, trailofbits stays global)

---

## Goal

Move Everything Claude Code (v1.8.0) from the global plugin cache into `.claude/ecc/` within the harness repo. Commit it to git. Strip irrelevant content. Merge hooks. Disable the global plugin.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | ECC only | Superpowers being uninstalled, trailofbits stays global |
| Commit to git | Yes | Version control over local copy |
| Cleanup | Strip irrelevant skills/agents/rules/commands | ~50% of ECC is for languages/domains harness doesn't use |
| Hook dedup | Choose more robust per-pair | See hook comparison below |
| Naming | `.claude/ecc/` as vendor root | Keeps ECC separate from harness's own `.claude/` assets |

---

## Phase 1: Vendor ECC Source + Strip Irrelevant Content

**Copy the ECC plugin source, then remove what doesn't belong.**

### Directory: `.claude/ecc/`

Copy from `~/.claude/plugins/cache/everything-claude-code/everything-claude-code/1.8.0/`

### Skills to KEEP (45 of 89)

Agent/orchestration:
- `agent-harness-construction`, `agentic-engineering`, `autonomous-loops`, `continuous-agent-loop`
- `continuous-learning`, `continuous-learning-v2`, `enterprise-agent-ops`
- `cost-aware-llm-pipeline`, `iterative-retrieval`, `nanoclaw-repl`
- `blueprint`, `eval-harness`, `strategic-compact`

TypeScript/Node/React/Next.js:
- `coding-standards`, `frontend-patterns`, `backend-patterns`
- `api-design`, `e2e-testing`, `tdd-workflow`
- `verification-loop`, `security-review`, `security-scan`
- `plankton-code-quality`, `search-first`

Database/infra:
- `postgres-patterns`, `database-migrations`
- `docker-patterns`, `deployment-patterns`

Claude API:
- `claude-api`

Content (used for harness storytelling/digest features):
- `article-writing`, `content-engine`

Research:
- `deep-research`, `exa-search`, `market-research`

Misc workflow:
- `configure-ecc`, `content-hash-cache-pattern`
- `project-guidelines-example`, `skill-stocktake`, `skill-create`
- `regex-vs-llm-structured-text`
- `dmux-workflows`, `ralphinho-rfc-pipeline`

### Skills to REMOVE (44 of 89)

Language-specific (not TypeScript):
- `golang-patterns`, `golang-testing`, `python-patterns`, `python-testing`
- `perl-patterns`, `perl-security`, `perl-testing`
- `swift-concurrency-6-2`, `swift-actor-persistence`, `swift-protocol-di-testing`, `swiftui-patterns`
- `foundation-models-on-device`, `liquid-glass-design`
- `kotlin-coroutines-flows`, `compose-multiplatform-patterns`, `android-clean-architecture`
- `java-coding-standards`, `jpa-patterns`
- `springboot-patterns`, `springboot-security`, `springboot-tdd`, `springboot-verification`
- `django-patterns`, `django-security`, `django-tdd`, `django-verification`
- `cpp-coding-standards`, `cpp-testing`
- `clickhouse-io`

Domain-specific business:
- `logistics-exception-management`, `carrier-relationship-management`
- `returns-reverse-logistics`, `inventory-demand-planning`
- `production-scheduling`, `quality-nonconformance`
- `energy-procurement`, `customs-trade-compliance`

Social/media (not relevant to harness):
- `crosspost`, `x-api`, `fal-ai-media`, `video-editing`, `videodb`
- `frontend-slides`, `visa-doc-translate`, `nutrient-document-processing`
- `investor-materials`, `investor-outreach`

### Agents to KEEP (13 of 17)

- `architect`, `build-error-resolver`, `code-reviewer`, `database-reviewer`
- `doc-updater`, `e2e-runner`, `harness-optimizer`, `loop-operator`
- `planner`, `refactor-cleaner`, `security-reviewer`, `tdd-guide`
- `chief-of-staff`

### Agents to REMOVE (4 of 17)

- `go-build-resolver`, `go-reviewer`, `kotlin-reviewer`, `python-reviewer`

### Commands to KEEP (33 of 42)

All except language-specific:
- Remove: `go-build`, `go-review`, `go-test`, `gradle-build`, `python-review`
- Remove: `multi-*` commands if they exist only as wrappers
- Keep everything else (testing, agent loops, code review, learning, workflow)

### Rules to KEEP (14 of 48)

- `common/` (9 files — universal dev patterns)
- `typescript/` (5 files — TypeScript/Node.js)
- Remove: `golang/`, `kotlin/`, `perl/`, `php/`, `python/`, `swift/`

### Top-level files to KEEP

- `README.md`, `CHANGELOG.md`, `LICENSE`
- `package.json`, `package-lock.json` (needed for hook scripts)

### Top-level files to REMOVE

- `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SPONSORING.md`, `SPONSORS.md`
- `README.zh-CN.md`
- `the-longform-guide.md`, `the-openclaw-guide.md`, `the-security-guide.md`, `the-shortform-guide.md`
- `commitlint.config.js`, `eslint.config.js`, `.prettierrc`, `.markdownlint.json`
- `.gitignore`, `.npmignore`

### Directories to REMOVE

- `.agents/`, `.claude/`, `.claude-plugin/`, `.cursor/`, `.codex/`, `.opencode/`, `.github/`
- `tests/`, `schemas/`, `examples/`, `assets/`
- `everything-claude-code/` (empty dir)
- `plugins/` (ECC's own plugin system, not ours)

### Directories to KEEP

- `skills/` (after pruning)
- `agents/` (after pruning)
- `commands/` (after pruning)
- `rules/` (after pruning)
- `scripts/` (needed for hooks)
- `hooks/` (reference for hook config)
- `contexts/` (3 files — dev, research, review)
- `docs/` (review for relevance)
- `mcp-configs/` (review for relevance)

---

## Phase 2: Merge Hooks Into Project Settings

**Merge ECC hooks into `.claude/settings.json`, resolving overlaps.**

### Hook Comparison Results

| Overlap Area | ECC Approach | Harness Approach | Winner | Action |
|-------------|-------------|-----------------|--------|--------|
| **Console.log** | `post-edit-console-warn.js` + `check-console-log.js` — warn only | `block-console-log.py` — **blocks preemptively** (exit 2) | **HARNESS** | Keep harness, skip ECC |
| **Code formatting** | `post-edit-format.js` — auto-detects Biome/Prettier, uses local binary (fast) | `biome-check.py` — Biome only via npx (slower) | **ECC** | Replace `biome-check.py` with ECC's `post-edit-format.js` |
| **Quality gates** | `quality-gate.js` — multi-lang (.json, .md, .go, .py), async | No equivalent (only biome-check covers .json) | **ECC** | Add ECC's `quality-gate.js` |
| **Doc warnings** | `doc-file-warning.js` — warns on non-standard doc locations | `track-doc-changes.py` — tracks changes + suggests review | **BOTH** | Keep both (complementary) |

### Final Hook Configuration

ECC hooks use `${CLAUDE_PLUGIN_ROOT}` — rewrite ALL to `$CLAUDE_PROJECT_DIR/.claude/ecc`.

**PreToolUse hooks (merged order):**

Bash matchers:
1. `block-no-verify.py` (harness) — BLOCK
2. `pre-commit-validate.py` (harness, 300s) — BLOCK
3. `enforce-commit-message.py` (harness) — BLOCK
4. `block-any-types.py` (harness, 30s) — BLOCK
5. `auto-tmux-dev.js` (ECC) — advisory
6. `pre-bash-tmux-reminder.js` (ECC) — advisory
7. `pre-bash-git-push-reminder.js` (ECC) — advisory

Write|Edit matchers:
1. `protect-files.py` (harness) — BLOCK
2. `enforce-kebab-case.py` (harness) — BLOCK
3. `block-barrel-exports.py` (harness) — BLOCK
4. `block-test-file-location.py` (harness) — BLOCK
5. `block-retro-ui-imports.py` (harness) — BLOCK
6. `block-direct-env-access.py` (harness) — BLOCK
7. `block-direct-prisma-client.py` (harness) — BLOCK
8. `block-dangerous-html.py` (harness) — BLOCK
9. `block-console-log.py` (harness) — BLOCK (replaces ECC's warn-only)
10. `block-deep-package-imports.py` (harness) — BLOCK

Write matcher:
1. `doc-file-warning.js` (ECC) — warn only

Edit|Write matcher:
1. `suggest-compact.js` (ECC) — advisory

Wildcard matcher:
1. `observe.sh` (ECC, async, 10s) — Homunculus observer

Bash|Write|Edit|MultiEdit matcher:
1. `insaits-security-wrapper.js` (ECC, 15s) — opt-in via `ECC_ENABLE_INSAITS=1`

**PostToolUse hooks (merged order):**

Bash matchers:
1. `post-merge-validate.py` (harness, 300s) — advisory
2. `post-bash-pr-created.js` (ECC) — advisory
3. `post-bash-build-complete.js` (ECC, async, 30s) — advisory

Write|Edit or Edit matchers:
1. `post-edit-format.js` (ECC) — **REPLACES** harness `biome-check.py`
2. `enforce-arrow-functions.py` (harness, 10s) — warn
3. `track-doc-changes.py` (harness, 5s) — tracking
4. `quality-gate.js` (ECC, async, 30s) — multi-lang quality
5. `post-edit-typecheck.js` (ECC) — TypeScript check after edits

Wildcard matcher:
1. `observe.sh` (ECC, async, 10s) — Homunculus observer

**PreCompact hooks (NEW — from ECC):**
1. `pre-compact.js` — save state before compaction

**SessionStart hooks (NEW — from ECC):**
1. `session-start.js` — rewrite to use direct path instead of fallback chain

**Stop hooks (NEW — from ECC):**
1. `session-end.js` (async, 10s) — persist session state
2. `evaluate-session.js` (async, 10s) — extract patterns
3. `cost-tracker.js` (async, 10s) — token/cost metrics

**SessionEnd hooks (NEW — from ECC):**
1. `session-end-marker.js` — lifecycle marker

**Notification hooks (keep harness):**
1. `notify-on-complete.py` (harness)

**WorktreeCreate hooks (keep harness):**
1. `worktree-setup.py` (harness)

### Hooks REMOVED (redundant)

- `check-console-log.js` (Stop) — harness blocks preemptively via PreToolUse
- `post-edit-console-warn.js` (PostToolUse) — same reason
- `biome-check.py` (PostToolUse) — replaced by ECC's more capable `post-edit-format.js`

---

## Phase 3: Migrate Global Agents

**Copy 4 global agents from `~/.claude/agents/` into `.claude/agents/`.**

| Global Agent | Project Equivalent | Action |
|-------------|-------------------|--------|
| `research-specialist.md` | Already exists (11.7KB vs 10.4KB) | **Keep project version** (larger, likely customized) |
| `typescript-expert.md` | Already exists (6.9KB vs 9.7KB) | **Diff and merge** — global is larger |
| `unit-test-maintainer.md` | Already exists (3.3KB vs 11KB) | **Diff and merge** — global is significantly larger |
| `systematic-problem-solver.md` | Does not exist locally | **Copy to project** |

---

## Phase 4: Migrate Learned Skills + Homunculus

1. Create `.claude/skills/learned/` if not exists
2. Copy `audit-plans-before-execution.md` and `record-lookup-nounchecked-indexed-access.md`
3. Copy harness-specific Homunculus project data from `~/.claude/homunculus/projects/` (the project ID `dc7b32441e61` directory)
4. Update observer paths to point to `.claude/ecc/` instead of global

---

## Phase 5: Update Global Settings

1. Set `"everything-claude-code@everything-claude-code": false` in `~/.claude/settings.json` `enabledPlugins`
2. Remove harness-specific permissions from global settings (pnpm, db, filter commands) — these already exist in project settings
3. Leave trailofbits plugins enabled globally
4. Leave frontend-design enabled globally

---

## Phase 6: Install Dependencies + Verify

1. `cd .claude/ecc && npm install` — ECC hooks need node_modules
2. Start a fresh Claude Code session
3. Verify:
   - All `/skill` invocations resolve (especially `/plan`, `/do`, `/review`)
   - Hooks fire on SessionStart, Stop, Write, Edit, Bash
   - Observer captures tool use events
   - No `${CLAUDE_PLUGIN_ROOT}` references remain in settings
   - Existing harness hooks still work (block-no-verify, enforce-kebab-case, etc.)

---

## Execution Order

1. Phase 1 — vendor + strip (bulk of the work)
2. Phase 4 — migrate learned skills + homunculus data (small, independent)
3. Phase 3 — merge agents (small, independent)
4. Phase 2 — merge hooks into settings.json (most delicate, do last with all files in place)
5. Phase 5 — disable global plugin (only after local is verified)
6. Phase 6 — install deps + verify

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| SessionStart hook breaks (complex fallback chain) | Rewrite to simple direct path: `$CLAUDE_PROJECT_DIR/.claude/ecc/scripts/hooks/...` |
| Skill namespacing changes | Test that `everything-claude-code:X` names still resolve from local install |
| ECC node scripts fail without dependencies | Run `npm install` in `.claude/ecc/` before testing |
| Hook ordering causes unexpected behavior | Harness blocking hooks first, ECC advisory hooks second |
| Formatting hook conflict | `biome-check.py` deleted, `post-edit-format.js` takes over |
| Global plugin still interferes after disable | Test with disabled flag; if needed, delete cache entry |
