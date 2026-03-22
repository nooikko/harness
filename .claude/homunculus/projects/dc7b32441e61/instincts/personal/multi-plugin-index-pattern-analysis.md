---
id: multi-plugin-index-pattern-analysis
trigger: when analyzing cross-plugin patterns or identifying plugin ecosystem architecture conventions
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Multi-Plugin Index Pattern Analysis

## Action
When exploring the plugin ecosystem to identify common patterns or architectural conventions, breadth-first browse plugin entry files (index.ts) across multiple plugins in sequence rather than depth-first exploration of a single plugin.

## Evidence
- Observed 7 sequential index.ts reads in session 3db3a930-228b-4cee-8665-92a3648dd54b
- Pattern: plugins examined in order: cron, delegation, project, search, identity, tasks, outlook
- Each read scanned for: exports, tool definitions, hook registration, lifecycle methods
- Preceded by glob discovery of _helpers/ directories (ecosystem inventory)
- Last observed: 2026-03-17T17:38:14Z
- Context: Understanding plugin architecture patterns and commonalities across ecosystem

## When to Use
Before:
- Identifying plugin ecosystem conventions or patterns
- Assessing consistency of plugin structure
- Planning plugin-wide refactors
- Understanding how different plugins organize tool definitions or hooks
- Onboarding to harness plugin architecture at ecosystem level

## Pattern Details
Typical workflow:
1. Use glob to discover plugin structure (find _helpers/, find index.ts files)
2. Read index.ts from multiple different plugins in sequence
3. Scan for: PluginDefinition exports, tool schema patterns, hook registration, lifecycle methods (start/stop/register)
4. Compare patterns across plugins to identify conventions or variations

## Differs From
`plugin-entry-then-helpers-exploration`: That instinct is depth-first exploration of dependencies within ONE plugin. This pattern is breadth-first sampling across MANY plugins for ecosystem-level understanding.
