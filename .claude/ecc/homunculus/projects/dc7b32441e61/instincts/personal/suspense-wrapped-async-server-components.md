---
id: suspense-wrapped-async-server-components
trigger: when implementing async server components in Next.js that need loading states
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Suspense-Wrapped Async Server Components

## Action
When creating async server components that need loading states, export an `Internal` version with the actual async logic and a public version that wraps it in a Suspense boundary with a matching Skeleton fallback component. Mark Internal exports with `@internal Exported for testing only`.

## Evidence
- Observed 3 component implementations following this pattern: CostOverTimeChart, TokensOverTimeChart, MessageList
- Each public export (`export const ComponentName`) wraps an Internal export (`export const ComponentNameInternal`) in Suspense
- Each has a matching skeleton component for the fallback (e.g., `CostOverTimeChartSkeleton`)
- Test files import and test Internal versions directly, mocking their Prisma dependencies
- Pattern enables clean test isolation by allowing dependency injection at the test level
- Last observed: 2026-03-14T06:24:57Z
