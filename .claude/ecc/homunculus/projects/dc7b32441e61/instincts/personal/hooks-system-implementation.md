---
id: hooks-system-implementation
trigger: when implementing new Claude Code hook-based automation features
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Hooks System Implementation Research Workflow

## Action
When adding new Claude Code hooks, systematically research existing hook patterns by fetching official documentation, grepping for implementations in `.claude/hooks/`, and reading 2-3 similar hook files before building.

## Evidence
- 3 WebFetch calls to Claude Code hooks documentation (prompt hooks, agent hooks, input processing patterns)
- 1 Grep finding 18 existing hook implementations in `.claude/hooks/*.py`
- 4 Read operations examining specific hook implementations (biome-check.py, notify-on-complete.py, block-any-types.py)
- 1 Read of `.claude/settings.json` to understand hook wiring and configuration
- Context: User exploring delegation features and task tracking with hook support
- Last observed: 2026-03-17

## Pattern
The project uses extensive hook-based automation for:
- Code quality enforcement (Biome, ESLint, type checking)
- Pre/post tool validation (blocking commits with `any` types, file protection)
- Security guardrails (block direct env access, dangerous HTML, direct Prisma client)
- Automated tasks (post-merge validation, desktop notifications)
- Custom naming conventions (kebab-case enforcement, arrow functions)

Research-first workflow reveals hooks are Python scripts that:
- Receive JSON via stdin with tool info
- Use exit codes (0=allow, 2=block) and stderr for communication
- Are configured in `.claude/settings.json` with matchers and timeouts
- Fire at specific lifecycle events (PreToolUse, PostToolUse, etc.)
