---
id: webfetch-official-docs-pattern
trigger: when researching technical frameworks, libraries, or APIs, especially for documentation, configuration options, or architecture patterns
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# WebFetch Official Documentation Pattern

## Action
Prioritize WebFetch for accessing official documentation sites (turborepo.dev, platform.claude.com, nodejs.org, typescriptlang.org) over generic web searches when investigating technical topics.

## Evidence
- Observed 20+ WebFetch operations in session 9fc9b500-3fe7-4994-9892-df5e7e684625
- Pattern: User fetches from official documentation sources:
  - turborepo.dev (internal packages, TypeScript config, repository structuring)
  - platform.claude.com (Agent SDK reference, permissions config)
  - nodejs.org (ESM resolution, package exports)
  - typescriptlang.org (tsconfig, module resolution)
  - github.com (issue discussions, real-world examples)
- Pattern: WebFetch used exclusively for reference documentation; WebSearch used sparingly (4 times) for discovery/overview only
- Last observed: 2026-03-14T06:26:54Z

## Context
The harness project involves complex monorepo architecture, plugin systems, and Agent SDK integration. These domains benefit from authoritative official documentation rather than summary/aggregated results. User demonstrates strong preference for fetching complete reference docs directly.

## When to Apply
- Researching Turborepo monorepo patterns → fetch turborepo.dev docs
- Investigating Claude Agent SDK features → fetch platform.claude.com docs
- Exploring Node.js module resolution → fetch nodejs.org API docs
- Understanding TypeScript configuration → fetch typescriptlang.org docs
- Examining real-world implementations → fetch GitHub repository code

## Benefits
- Official docs provide authoritative, complete information
- Reduces research time by going directly to source
- Captures all configuration options and edge cases
- Enables more informed architectural decisions
