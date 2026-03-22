# Documentation & Memory Cleanup Plan

## Overview

Clean up, consolidate, and update all non-code documentation across the repo. Each file needs individual, nuanced review — no bulk operations.

## Areas in Scope

- **AI_RESEARCH/** — 66 files + 3 subdirectories (agent-isolation/, ui-redesign/, projects-review/)
- **CLAUDE.md** — 308 lines, last substantive update ~Mar 5
- **.claude/rules/** — 5 files (architectural-invariants, data-flow, plugin-system, agent-identity-state, cron-scheduler), last updated Mar 2-5
- **Memory files** — 7 files + MEMORY.md index in `/Users/quinn/.claude/projects/-Users-quinn-dev-harness/memory/`
- **.claude/plan/** — 16 files (mix of active designs, completed research, audits)
- **docs/** — 9 files across setup/, plans/, research/, superpowers/
- **docs/superpowers/** — 2 files that should be in AI_RESEARCH/ per user feedback

---

## Phase 1: AI_RESEARCH/ Triage

Decision framework per file:
- **DELETE** — Feature complete, all insights captured in code/rules/docs. Nothing left to reference.
- **KEEP** — Active feature, blocked feature, or contains reference patterns still useful for future work.
- **CONSOLIDATE** — Multiple files on same topic where one would suffice.

### Batch 1: Agent Identity, Memory, Bootstrap (10 files) — REVIEWED, 3 DELETE / 7 KEEP
Features are COMPLETE (Phases 1-2-4-5, bootstrap). Keep files contain architectural justifications and research not captured elsewhere.

- [x] `2026-03-01-agent-identity-soul-memory-research.md` — KEEP (5-system comparison informs Agent model schema design)
- [x] `2026-03-03-agent-memory-architecture-isolation-research.md` — KEEP (3-level scope design came directly from this; hybrid architecture pattern)
- [x] `2026-03-01-agent-personality-memory-standards.md` — KEEP (evidence: personas don't improve accuracy; memory > personality)
- [x] `2026-03-11-persona-drift-role-persistence-research.md` — KEEP (research justification for dual injection; attention decay within 8 turns)
- [x] `2026-03-11-role-prompting-frameworks-comparison.md` — DELETE (frameworks not used; key findings duplicated in personality-memory-standards)
- [x] `2026-03-11-agentic-role-prompting-patterns.md` — KEEP (conversational vs agentic role distinction; Anthropic official templates)
- [x] `2026-03-04-default-agent-plan.md` — DELETE (implementation plan for completed feature)
- [x] `2026-03-04-default-agent-bootstrap-design.md` — DELETE (duplicate of default-agent-plan, also completed)
- [x] `2026-03-04-openclaw-default-agent-onboarding.md` — KEEP (reference architecture for bootstrap pattern)
- [x] `2026-03-01-identifiable-agents-plan.md` — KEEP (master synthesis: ties all research into 5-phase roadmap + risk analysis)

### Batch 2: Vector Search & Embeddings (4 files) — REVIEWED, 1 DELETE / 3 KEEP
Phase 3 is PAUSED (blocked on Qdrant service). Architecture, landscape, and API reference still needed for implementation day.

- [x] `2026-03-03-qdrant-vector-search-agent-memory.md` — KEEP (implementation roadmap: collection design, indexing pipeline, graceful degradation)
- [x] `2026-03-03-embedding-model-competitive-landscape.md` — KEEP (model selection trade-offs; will need re-evaluation when Phase 3 unblocks)
- [x] `2026-03-03-voyage-ai-embedding-benchmarks.md` — DELETE (granular Voyage benchmarks; key findings already in landscape file)
- [x] `2026-03-14-qdrant-js-client-embeddings-api.md` — KEEP (TypeScript API reference with gotchas for implementation)

### Batch 3: Workspace Isolation (6 files)
Feature decisions made. Git worktree approach implemented.

- [ ] `2026-03-01-workspace-isolation-synthesis.md` — Synthesis of 4 research streams
- [ ] `2026-03-01-workspace-isolation-industry-patterns.md` — Enterprise platforms (GitHub Copilot, Devin, Cursor)
- [ ] `2026-03-01-agent-workspace-isolation-patterns.md` — Open source frameworks (OpenClaw, OpenHands)
- [ ] `2026-03-01-agent-workspace-isolation-research.md` — Academic isolation taxonomy
- [ ] `2026-03-01-git-worktree-agent-isolation.md` — Git worktree deep dive
- [ ] `agent-isolation/research-report.md` — Harness isolation audit

### Batch 4: Music/YouTube Plugin (8 files) — REVIEWED, all DELETE
Feature is COMPLETE. 13 MCP tools, dual auth (OAuth + cookie), full Cast control, admin UI, content blocks, comprehensive tests (15 test files). All 8 research files fully absorbed into implementation. Nothing useful remains beyond the code.

- [x] `2026-03-12-youtubei-js-authentication-deep-dive.md` — DELETE (OAuth + cookie auth fully implemented)
- [x] `2026-03-05-youtubei-js-api-surface.md` — DELETE (search, streaming, format selection all implemented)
- [x] `2026-03-05-youtube-music-nodejs-libraries.md` — DELETE (decision made: youtubei.js v17.0.1)
- [x] `2026-03-16-youtubei-js-v14-to-v17-breaking-changes.md` — DELETE (migration complete, v17.0.1 running)
- [x] `2026-03-16-youtubei-js-signature-decipher-error.md` — DELETE (fixed by v17.0.1 upgrade)
- [x] `2026-03-12-music-plugin-auth-settings-design.md` — DELETE (all routes, schema, admin UI built)
- [x] `2026-03-05-google-cast-nodejs-youtube-music.md` — DELETE (castv2-client + bonjour implemented)
- [x] `2026-03-12-cast-discovery-auth-settings-ux.md` — DELETE (device list, aliases, identify all in admin UI)

### Batch 5: UI/UX Design (16 files) — REVIEWED
Phases 1-8 complete. Phase 9 (agents page) and Phase 10 (motion/polish) have remaining work.

- [x] `2026-03-05-ui-standardization-audit.md` — DELETE (audit complete, issues resolved)
- [x] `2026-03-05-ui-standardization-plan.md` — DELETE (plan executed)
- [x] `2026-03-05-ui-standardization-design.md` — DELETE (design decisions made, implemented)
- [x] `2026-03-05-joy-inducing-ui-design-shadcn-customization.md` — DELETE (philosophy absorbed)
- [x] `2026-03-12-premium-ui-patterns-linear-vercel-raycast.md` — KEEP (reference for remaining polish work)
- [x] `2026-03-11-ux-design-standards-and-quality-criteria.md` — DELETE (general standards, not project-specific)
- [x] `2026-03-11-senior-ux-designer-ai-startup-competencies.md` — DELETE (hiring reference, not implementation)
- [x] `2026-03-11-senior-ux-designer-ai-products-workflow.md` — DELETE (process reference, not implementation)
- [x] `2026-03-11-ux-ui-designer-ai-agent-capabilities.md` — DELETE (informational only)
- [x] `2026-03-11-ai-ux-anti-patterns-and-agent-tool-mapping.md` — DELETE (general knowledge)
- [x] `ui-redesign/master-plan.md` — KEEP (overall design direction, still referenced)
- [x] `ui-redesign/phase-01-design-foundation.md` — DELETE (implemented)
- [x] `ui-redesign/phase-02-sidebar.md` — DELETE (implemented)
- [x] `ui-redesign/phase-03-page-headers.md` — DELETE (implemented)
- [x] `ui-redesign/phase-04-tables.md` — DELETE (implemented)
- [x] `ui-redesign/phase-05-plugin-cards.md` — DELETE (plugins page fully redesigned)
- [x] `ui-redesign/phase-06-forms.md` — DELETE (implemented)
- [x] `ui-redesign/phase-07-empty-states.md` — DELETE (implemented)
- [x] `ui-redesign/phase-08-usage-dashboard.md` — DELETE (implemented)
- [x] `ui-redesign/phase-09-agents-page.md` — KEEP (remaining work on agent cards)
- [x] `ui-redesign/phase-10-motion-polish.md` — KEEP (animation tokens, transitions not yet applied)

### Batch 6: Claude Code Ecosystem, Prompting, SDK (10 files)
Mostly reference material that may have been absorbed.

- [ ] `2026-02-22-claude-code-ecosystem-state.md` — Claude Code state, hooks, MCP
- [ ] `2026-02-26-claude-code-memory-context-mechanisms.md` — 7 memory mechanisms
- [ ] `2026-02-26-claude-code-context-files-reference.md` — CLAUDE.md, rules/ reference
- [ ] `2026-02-26-claude-code-context-monorepo-execution-path.md` — Monorepo context strategies
- [ ] `2026-02-26-documentation-pipeline-mcp-research.md` — Internalized Context7 architecture
- [ ] `2026-02-26-self-updating-architectural-context-ai-assistants.md` — Serena MCP, auto-doc
- [ ] `2026-01-12-ai-agent-prompt-design-best-practices.md` — Anthropic 5 workflow patterns
- [ ] `2026-02-25-dynamic-tool-discovery-intent-routing.md` — Tool registration patterns
- [ ] `2026-02-24-claude-cli-streaming-cold-start.md` — CLI vs SDK latency
- [ ] `2026-02-24-anthropic-api-low-latency-chat.md` — Direct SDK calls

### Batch 7: Everything Else (12+ files)
Individual review needed per file.

- [ ] `2026-02-23-nextjs16-server-first-patterns.md` — Server Components, Suspense
- [ ] `2026-02-23-nextjs-suspense-streaming-patterns.md` — Streaming mechanics
- [ ] `2026-02-26-dynamic-plugin-ui-loading-nextjs.md` — Dynamic plugin settings loading
- [ ] `2026-02-26-markdown-rendering-chat-ui.md` — react-markdown vs streamdown
- [ ] `2026-03-01-projects-feature-design.md` — Project model design
- [ ] `2026-03-01-ai-projects-memory-hierarchy-research.md` — Project memory patterns
- [ ] `user-profile-design.md` — UserProfile model design
- [ ] `user-profile-implementation-plan.md` — UserProfile implementation steps
- [ ] `2026-03-01-industry-gap-analysis-agent-orchestration.md` — 10-dimension gap analysis
- [ ] `2026-03-01-gap-implementation-analysis.md` — Gap → codebase findings
- [ ] `2026-03-05-dynamic-widget-slot-registry-patterns.md` — Widget registry patterns
- [ ] `2026-03-05-widget-state-management-push-updates.md` — Push-based widget updates
- [ ] `2026-03-12-everything-claude-code-analysis.md` — ECC repo analysis
- [ ] `2026-03-12-everything-claude-code-deep-analysis.md` — ECC reverse-engineering
- [ ] `2026-03-12-agentshield-security-analysis.md` — AgentShield CLI analysis
- [ ] `2026-03-13-turborepo-large-monorepo-patterns.md` — Turborepo compilation
- [ ] `2026-03-13-turborepo-internal-packages.md` — Internal packages
- [ ] `2026-03-14-turborepo-per-package-task-config.md` — Per-package turbo.json
- [ ] `2026-03-14-tsup-esbuild-workspace-bundling.md` — tsup/esbuild bundling
- [ ] `2026-03-13-monorepo-package-consolidation-patterns.md` — Consolidation patterns
- [ ] `2026-02-23-task-master-ai-configuration.md` — task-master-ai config
- [ ] `2026-02-23-task-master-ai-cli-toolkit.md` — task-master-ai CLI/MCP
- [ ] `2026-03-01-openrouter-perplexity-integration.md` — OpenRouter API
- [ ] `2026-03-02-claude-agent-sdk-structured-output.md` — Structured output
- [ ] `2026-03-13-claude-agent-sdk-session-isolation.md` — SDK session isolation
- [ ] `projects-review/*.png` — Screenshots (3 images)

---

## Phase 2: CLAUDE.md Update

Depends on Phase 1 (need to know what's current).

- [ ] Add missing plugins to Architecture section:
  - `packages/plugins/music/` — YouTube Music + Cast
  - `packages/plugins/outlook/` — Outlook email (Microsoft Graph)
  - `packages/plugins/calendar/` — Calendar events (Microsoft Graph)
  - `packages/plugins/tasks/` — Task management
  - `packages/plugins/search/` — Global search (FTS + vector)
  - `packages/plugins/playwright/` — Browser automation
- [ ] Update "What Already Exists" section with completed features:
  - File uploads & attachments UI
  - Global Cmd+K search
  - Project hub page
  - Task management system
  - Content block system
  - Code block component (syntax highlighting + copy)
  - Observability (Pino logging, error handling, admin dashboard)
  - Microsoft Graph OAuth integration
- [ ] Update "Planned But Incomplete" — remove completed items, add new incomplete items
- [ ] Update plugin registration order (ALL_PLUGINS list grew)
- [ ] Verify Commands section
- [ ] Verify all file path references still valid

---

## Phase 3: .claude/rules/ Audit

Independent of Phase 1-2. Cross-reference each rule against source files.

**Global fix across ALL rules files:** Remove all specific line number references (e.g., "line 152", "line 119") and hard plugin counts (e.g., "14 plugins"). These go stale with every code change. Reference by function/type name and structural position instead.

- [ ] `architectural-invariants.md` — Remove line numbers. Update PluginContext methods if changed. Update hook list if new hooks added.
- [ ] `data-flow.md` — Remove all line number references. Verify pipeline steps still accurate. Check for new stream event types.
- [ ] `plugin-system.md` — Remove line numbers. Add new plugins to ALL_PLUGINS list. Add per-plugin summaries for new plugins. Update PluginHooks type if changed.
- [ ] `agent-identity-state.md` — Remove line numbers. Verify phase statuses. Check AgentConfig fields. Verify scoring/retrieval logic.
- [ ] `cron-scheduler.md` — Remove line numbers. Add new CRUD MCP tools (list, get, update, delete). Update schema if changed.

---

## Phase 4: Memory Cleanup

Quick phase, can run in parallel with Phase 2-3.

- [ ] MEMORY.md — Add missing `search-polish.md` plan reference
- [ ] MEMORY.md — Update content-block-system status
- [ ] MEMORY.md — Update integration test counts
- [ ] MEMORY.md — Review "Key Constants" for accuracy
- [ ] `feedback-plan-spec-location.md` — Decision absorbed. Consider DELETE.
- [ ] `feedback-autonomous-agents.md` — Check if still relevant.
- [ ] `user-life-systems.md` — Review for accuracy.
- [ ] `agent-stability-audit.md` — Check if any findings fixed since Mar 17.

---

## Phase 5: .claude/plan/ Cleanup

Depends on Phase 1 (for deciding where to move research files).

- [ ] `plugin-consolidation.md` — FILED research (conclusion: not worth it). Evaluate on own merits — does the research contain useful context beyond the conclusion?
- [ ] `agent-isolation-research.md` — Contains research questions + answers on data/execution isolation. Evaluate whether the content is still useful reference independent of any memory entries.
- [ ] `content-block-system.md` — Phase 2 complete. Update status, keep for Phase 3.
- [ ] `projects-system-review.md` — Project hub now built. Review if still needed.
- [ ] `plugin-system-reliability-audit.md` — Test gap analysis. Check which gaps filled.
- [ ] All other design plans — verify against git history, mark completed phases.

---

## Phase 6: docs/ Reorganization

Depends on Phase 1 and 5.

- [ ] Move `docs/superpowers/plans/` and `docs/superpowers/specs/` contents to AI_RESEARCH/ (per user feedback rule)
- [ ] Remove empty `docs/superpowers/` directory
- [ ] Review `docs/plans/2026-03-02-scheduled-tasks-prd.md` — Feature complete. Keep as historical or move to AI_RESEARCH/.
- [ ] Review `docs/plans/ui-component-migration-2026-03-07.md` — Check if migration done.
- [ ] Review `docs/research/2026-03-02-agent-memory-scoping.md` — Feature complete. Keep as reference.
- [ ] Review `docs/research/2026-03-02-e2e-testing-approaches.md` — E2E still absent. Keep.
- [ ] Review `docs/microsoft-graph-setup.md` — Recently updated (Mar 16). Verify accuracy.
- [ ] Consider adding: `docs/api-reference.md` (REST routes), `docs/mcp-tools.md` (all plugin tools)
- [ ] Update `docs/plugin-development.md` with new plugin examples

---

## Execution Order

```
Phase 1 (AI_RESEARCH triage)     ← heaviest, do first, 7 batches can run in parallel
Phase 2 (CLAUDE.md)              ← after Phase 1
Phase 3 (.claude/rules/)         ← can start in parallel with Phase 2
Phase 4 (Memory)                 ← can run in parallel with Phase 2-3
Phase 5 (.claude/plan/)          ← after Phase 1
Phase 6 (docs/)                  ← after Phase 1 and 5
```

## Complexity: HIGH

100+ files requiring individual human-level judgment about whether content is still load-bearing.
