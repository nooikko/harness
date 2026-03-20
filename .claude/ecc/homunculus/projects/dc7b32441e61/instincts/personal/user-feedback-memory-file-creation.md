---
id: user-feedback-memory-file-creation
trigger: when user provides correction, preference, or guidance on approach or tools
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# User Feedback Captured as Dedicated Memory Files

## Action
When user provides feedback about approach, tool usage, documentation standards, or any recurring guidance, create a dedicated `feedback-{topic}.md` file in memory and add a reference link to MEMORY.md under the Feedback section.

## Evidence
- Observed 3 times in session 861a6505 and b2ed7404 (2026-03-17, timestamps 18:43:23 - 18:43:56)
- 18:43:23: User feedback on doc hooks → Updated MEMORY.md with feedback-doc-hooks.md link
- 18:43:51: User feedback on rules file maintenance → Created feedback-rules-no-line-numbers.md
- 18:43:56: User feedback on memory file scope → Created feedback-memory-is-ephemeral.md
- Pattern: Correction received → feedback-{descriptive-name}.md created → MEMORY.md index updated
- Last observed: 2026-03-17T18:43:56Z

## File Structure
Each feedback file includes:
```markdown
---
name: Short description
description: One-line summary for deciding relevance in future conversations
type: feedback
---

[Explanation of the feedback and when/how to apply it]
```

## Why This Matters
Structured feedback files make it easy to reference the user's preferences in future sessions. The memory index ensures all feedback is discoverable without needing to search through many files.
