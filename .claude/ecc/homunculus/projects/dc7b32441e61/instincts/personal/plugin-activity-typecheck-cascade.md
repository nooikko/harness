---
id: plugin-activity-typecheck-cascade
trigger: when plugin-activity typecheck fails during pnpm build execution
confidence: 0.7
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Activity Typecheck Cascade Failure

## Action
When @harness/plugin-activity#typecheck fails, immediately fix the typecheck errors in that plugin before addressing cascading ELIFECYCLE failures in dependent plugins—the cascade is a symptom, not the root cause.

## Evidence
- Observed 1 clear instance in session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17T17:00:43Z)
- Pattern: Single root failure (@harness/plugin-activity#typecheck) triggers 20+ downstream ELIFECYCLE failures
  - Total task failures: 24 out of 55 tasks
  - Failed plugins include: plugin-music, plugin-playwright, plugin-tasks, plugin-auto-namer, plugin-time, plugin-project, plugin-search, plugin-web, plugin-discord, plugin-delegation, plugin-cron, plugin-summarization, plugin-audit, plugin-metrics, plugin-identity, web app
- Root cause is localized to a single plugin; fixing that plugin will resolve the entire build cascade
- Last observed: 2026-03-17T17:00:43Z
- Indicates: plugin-activity is a critical dependency in the monorepo build order

## Related
- Consider the order of plugin dependencies in the pnpm workspace configuration
- plugin-activity typecheck should be verified early in local development workflow
