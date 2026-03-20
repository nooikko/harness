---
id: pnpm-monorepo-sequential-resolution
trigger: when running multiple pnpm install/update operations in sequence
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# pnpm Monorepo Sequential Dependency Resolution

## Action
Expect multiple pnpm dependency resolution operations to run in quick succession (5-8 second intervals) during development or build workflows, each showing different resolved/reused/downloaded counts due to workspace-specific dependency trees.

## Evidence
- Observed 6 times in session 2a855ad4-6cda-40ff-9d79-6018d84df5c1
- Pattern: Sequential pnpm operations with consistent output format "Progress: resolved X, reused Y, downloaded Z, added W"
- All operations complete successfully with "Done in Xs using pnpm vX.X.X"
- Recurring deprecation warnings for boolean@3.2.0 and glob@10.5.0
- Last observed: 2026-03-20T21:10:37Z

## Context
This is a monorepo (likely using Turborepo) where different workspaces trigger independent pnpm resolution cycles. The sequential pattern suggests this may be:
- Multiple workspace builds happening in parallel but reporting sequentially
- Different dependency update checks across workspaces
- Part of a pre-commit or build pipeline

The consistent deprecated subdependency warnings indicate these should be evaluated for updates or removal.
