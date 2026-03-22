---
id: delegate-exploration-to-agent
trigger: when performing broad directory exploration, research across multiple sources, or investigating complex topics
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Delegate Broad Exploration to Agent

## Action
Use Agent tool for exploratory research tasks involving multiple files, directories, or information sources rather than attempting targeted reads with Read or Glob.

## Evidence
- Observed 3 times across different sessions on 2026-03-17
- Pattern: Agent successfully completed "list AI_RESEARCH directory recursively", "research Claude Code hooks documentation", "explore existing project hooks configuration"
- Occurs across sessions: b2ed7404-0359-4731-8614-8d1c4df95a8c, 861a6505-ac58-49b8-aa2e-3b331db12cd5
- Last observed: 2026-03-17T17:52:46Z

## Why This Matters
For exploratory tasks, Agent provides:
- Recursive directory traversal and comprehensive inventory
- Multi-source synthesis and information gathering
- Organized summaries rather than raw file content
- Effective handling of async research workloads
- Better context preservation across multiple files
