---
id: turborepo-docs-url-redirects
trigger: when researching Turborepo monorepo documentation or TypeScript ecosystem tools
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Turborepo Documentation URL Redirects

## Action
Expect permanent redirects (301/308) when fetching documentation URLs from older domains; use the redirected URL for subsequent requests. Known: turbo.build → turborepo.dev, www.shew.dev → turborepo.com

## Evidence
- Observed 3 instances of HTTP redirects during documentation fetching (2026-03-14):
  - turbo.build/repo/docs → turborepo.dev (301)
  - www.shew.dev/monorepos/packaging/jit → turborepo.com (308)
  - turbo.build/repo/docs/guides/single-package-monorepo → turborepo.dev (301)
- Pattern: Accessing Turborepo and related ecosystem documentation from old domain names triggers permanent redirects
- Last observed: 2026-03-14T06:27:48Z

## Context
The Turborepo and related monorepo tool projects have undergone URL migrations. WebFetch correctly detects these redirects and reports the new URLs, but knowing these specific migrations beforehand can streamline research workflows.

## When to Apply
- Researching Turborepo internal packages, JIT packages, or monorepo patterns
- Investigating monorepo packaging strategies
- Looking for documentation on TypeScript project references or module resolution in monorepos
