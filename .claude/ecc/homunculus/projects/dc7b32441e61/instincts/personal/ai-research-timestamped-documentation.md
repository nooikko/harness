---
id: ai-research-timestamped-documentation
trigger: when creating research documentation files in AI_RESEARCH/
confidence: 0.7
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# AI Research Timestamped Documentation

## Action
Name research documentation files with YYYY-MM-DD prefix, store in AI_RESEARCH/ directory with consistent markdown structure including Summary, Prior Research, and Current Findings sections.

## Evidence
- Observed 3 times in session 2026-03-14
- Pattern: `YYYY-MM-DD-kebab-case-title.md` stored in `/dev/harness/AI_RESEARCH/`
- Examples:
  - `2026-03-13-turborepo-internal-packages.md`
  - `2026-03-13-turborepo-large-monorepo-patterns.md`
  - `2026-03-13-claude-agent-sdk-session-isolation.md`
- Last observed: 2026-03-14T06:29:41Z
