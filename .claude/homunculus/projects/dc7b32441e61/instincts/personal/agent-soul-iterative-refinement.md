---
id: agent-soul-iterative-refinement
trigger: when making multiple targeted edits to an agent's soul/identity/behavior in agent-definitions.ts
confidence: 0.8
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Agent Soul Iterative Refinement

## Action
When refining an agent's soul/identity/behavior, make targeted edits to specific guidance sections, then document the overall rationale in a feedback file and link it in MEMORY.md.

## Evidence
- Observed 6+ times in session 20d108a3-0403-439c-abbd-0bfb5dd49a29:
  - Health Advisor Agent (4 edits):
    - Edit 1 (01:17:17): Refined clinical diagnoses language (avoid saying "you have X", reframe to symptom associations)
    - Edit 2 (01:19:45): Calibrated doctor referral frequency (reserve for genuinely concerning values, not routine deviations)
    - Edit 3 (01:25:47): Added harm reduction orientation (engage with gray-market/self-administered compounds, focus on safety)
    - Edit 4 (01:26:01): Expanded "never do" section (refuse engagement only for acute symptoms, not for non-FDA-approved compounds)
  - Code Manager Agent (2 edits):
    - Edit 5 (02:04:17): Refined soul text to clarify delegation approach (delegate outcomes not instructions, senior engineers make implementation decisions)
    - Edit 6 (02:04:26): Refined identity text to emphasize outcome-focused briefs and communication style
- Pattern: Each edit targets a specific behavioral concern or refinement; applies to both newly created agents and iterative improvements to existing ones
- Context: Health advisor refinements followed by feedback-agent-*.md documentation with MEMORY.md linkage
- Last observed: 2026-03-18T02:04:26Z

## Rationale
Iterative refinement of agent behavior happens through multiple small, focused edits rather than a single large rewrite. This allows for incremental testing and feedback-driven improvements. Documenting the reasoning in memory ensures consistency across sessions and future adjustments.

## When NOT to Apply
- Don't over-document trivial typos or formatting fixes
- Single-edit changes don't warrant feedback documentation
- Keep feedback documentation to semantic/behavioral changes, not style
