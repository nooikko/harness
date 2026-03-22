---
id: monorepo-package-research-prelude
trigger: when faced with monorepo package structure decisions, before implementation
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Monorepo Package Research Before Implementation

## Action
Research Turborepo and pnpm workspace documentation about package types (just-in-time vs compiled) and internal package structure before deciding on architectural changes.

## Evidence
- Observed 5 WebFetch operations to turborepo.dev documentation:
  - Turborepo package types and compilation strategies
  - Creating internal packages guidance
  - Repository structuring best practices
  - pnpm workspaces protocol and linking behavior
  - Turborepo scaling discussion thread
- Last observed: 2026-03-14

## Context
The harness project is a monorepo with 20+ packages. Package structure decisions (compilation strategy, workspace protocol usage, linking behavior) have architectural implications for build caching, compilation speed, and developer experience. This pattern suggests researching the official documentation and community discussions before making these decisions.

## Related Instincts
- harness-structure-orientation: general orientation to harness project layout
- multi-plugin-package-inventory: understanding current plugin package organization
