---
id: research-synthesis-file-grouping
trigger: when documenting research on a complex topic requiring multiple research streams
confidence: 0.5
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Research Synthesis File Grouping Pattern

## Action
When researching a complex topic, maintain separate focused research files (one per research stream/perspective) and create a synthesis file that ties all streams together with unified conclusions and trade-offs.

## Evidence
- Observed 4+ topic groups with consistent pattern:
  - **Workspace Isolation**: 4 research files + 1 synthesis
    - `2026-03-01-workspace-isolation-industry-patterns.md` (GitHub, Devin, Cursor, etc.)
    - `2026-03-01-agent-workspace-isolation-patterns.md` (open source frameworks)
    - `2026-03-01-agent-workspace-isolation-research.md` (academic + white papers)
    - `2026-03-01-git-worktree-agent-isolation.md` (git-specific deep dive)
    - `2026-03-01-workspace-isolation-synthesis.md` (meta-synthesis with platform table, 3-phase roadmap)
  - **Agent Isolation**: 3+ research files + 1 report
    - Individual research files on workspace, identity, bootstrap patterns
    - `agent-isolation/research-report.md` (synthesis covering data layer + execution layer isolation)
  - **AI Persona Field Definitions**: 2 research files + 1 synthesis (2026-03-18)
    - Read: `2026-03-11-agentic-role-prompting-patterns.md` (agentic role structure)
    - Read: `2026-03-11-persona-drift-role-persistence-research.md` (persona stability)
    - Write: `2026-03-17-ai-persona-field-definitions-research.md` (unified field taxonomy across platforms)
- Each synthesis explicitly references and ties together the prior research files
- Last observed: 2026-03-18T00:27:46Z

## When to Apply
When researching a topic with 4+ distinct angles or stakeholders:
- Create separate files for each research stream (one per platform, framework, or discipline)
- Use consistent naming: `YYYY-MM-DD-topic-stream-name.md`
- After collecting all streams, create a synthesis file that:
  - References prior research files explicitly
  - Builds a unified taxonomy or comparison table
  - Identifies gaps and contradictions across streams
  - Extracts actionable conclusions for your project
  - Quantifies findings (numbers, timing, costs) where available

## Benefits
- Separates focused research (easier to verify and cite sources) from synthesis (easier to act on)
- Allows individual streams to be deleted after synthesis if findings are captured
- Creates audit trail showing how conclusions were derived
- Prevents synthesis files from growing too large
