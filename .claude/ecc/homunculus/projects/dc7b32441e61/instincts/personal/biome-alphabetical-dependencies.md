---
id: biome-alphabetical-dependencies
trigger: when biome linting reports "dependencies should be ordered alphabetically"
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Biome Alphabetical Dependencies Rule

## Action
When biome flags unordered dependencies in package.json, immediately fix the alphabetical ordering of the dependencies object keys.

## Evidence
- Observed in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: biome check found "unordered-dependencies" error (07:25:43); edit applied reordering of @harness/plugin-calendar and @harness/plugin-outlook (07:25:39)
- Last observed: 2026-03-16T07:25:43Z

## Context
The harness project uses biome as its linter and enforces strict alphabetical ordering of dependencies in package.json files. This is a hard requirement that must be satisfied before code can pass linting.
