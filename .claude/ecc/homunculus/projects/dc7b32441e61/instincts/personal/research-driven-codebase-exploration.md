---
id: research-driven-codebase-exploration
trigger: when investigating feature scope, understanding existing code architecture, or exploring package structure before implementation
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Research-Driven Codebase Exploration

## Action
Use alternating Glob (find files) and Read (inspect content) sequences to methodically explore related code sections before proposing changes or implementations.

## Evidence
- Observed 9+ tool calls (5 Glob + 4 Read) in alternating sequence in session 4856ee0a (2026-03-15 22:06-22:06:29)
- Pattern: Search for files matching a pattern → read one → search for related patterns → read another → repeat
- Used for: investigating search plugin implementation, vector-search package, and plan documentation
- Last observed: 2026-03-15 22:06:29

## Context
Before proposing changes to feature implementations, use focused Glob queries to find relevant files, then Read them to understand current state. This discovery process prevents assumptions about code structure and catches existing implementations early.

## Related
- Occurs before implementation/modification work
- Complements existing research skills (webfetch-official-docs-pattern)
