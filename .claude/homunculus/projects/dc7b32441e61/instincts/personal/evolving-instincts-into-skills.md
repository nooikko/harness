---
id: evolving-instincts-into-skills
trigger: when consolidating learned patterns from development sessions into reusable skills or commands
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Evolving Instincts into Skills/Commands

## Action
After identifying reusable patterns through development work, create evolved skills in `/evolved/skills/` and commands in `/evolved/commands/` with documented patterns, triggers, and implementation guidance.

## Evidence
- Observed 5 Write operations creating evolved files in session c4b88b9a (2026-03-15 19:16-19:17)
- Files created:
  - harness-integration-testing.md (with patterns: database reset, orchestrator factory, async waits, multi-plugin integration)
  - harness-research-workflow.md (with patterns: official docs first, sequential deep dive, empty response fallback)
  - harness-ui-patterns.md (with patterns: page layout, server actions, async components, type narrowing)
  - new-plugin.md (command for scaffolding plugins)
  - test-plugin.md (command for generating plugin tests)
- Followed by Bash cleanup to verify output structure
- Last observed: 2026-03-15 19:17:38

## Context
This workflow captures accumulated knowledge about the harness codebase patterns. Evolved skills become auto-triggered or user-invocable templates for common tasks. The frontmatter includes `evolved_from` list to trace pattern origins, and `trigger` specifies when the skill activates.

## Related
- Supports project guideline documentation
- Enables consistency across development tasks
- Reduces repetition of pattern discovery
