---
id: iterative-code-search
trigger: when searching for specific functions or code patterns in unfamiliar code
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Iterative Code Search Pattern

## Action
When searching for a specific function or code pattern, try multiple Grep queries with different patterns—the first search may not return results, so refine and retry.

## Evidence
- Observed 4 Grep operations in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Grep called twice at 01:54:31 and twice at 01:54:37 with varying search patterns
- Result: First searches returned empty or minimal results; refined search found `getAllPluginNames` function
- Last observed: 2026-03-17 01:54:37Z

## Context
This workflow appears when:
- Searching for functions by name in unfamiliar modules
- Initial pattern may be too narrow or use different naming conventions
- Followed by Glob to locate the file, then Read to examine it
