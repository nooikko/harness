---
id: external-library-breaking-change-investigation
trigger: when investigating potential breaking changes or compatibility issues in external dependencies
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# External Library Breaking Change Investigation

## Action
When an external dependency (like YouTube.js) appears to have breaking API changes, use WebFetch to retrieve source code from GitHub, then use Bash to extract and compare TypeScript type definitions and API signatures to understand what changed and how it impacts the project.

## Evidence
- Observed 7 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: WebFetch raw.githubusercontent.com for source → Bash grep/extract types → WebFetch GitHub PR for change context → Bash filter type diffs
- Context: Investigating YouTube.js breaking changes in search filters between v16 and v17
- Files examined: StreamingInfo.ts, SearchFilters types, UploadDate, Duration, Feature enums
- Last observed: 2026-03-16T23:51:26Z

## Workflow Steps
1. **Identify the problem** — Error or incompatibility in dependency integration
2. **Fetch source code** — Use WebFetch on `raw.githubusercontent.com/{owner}/{repo}/main/src/{file}`
3. **Extract type definitions** — Use Bash to grep and display relevant TypeScript interfaces/types
4. **Fetch PR/changelog** — Use WebFetch on GitHub PR or release pages to find breaking change context
5. **Compare versions** — Use Bash to extract type diffs between versions
6. **Document changes** — Note which types were added, removed, or changed

## When to Apply
- Dependency error appears related to API changes
- Type mismatches between library and project code
- Need to understand scope of breaking change before deciding on migration strategy
- Evaluating compatibility of library upgrade

## Related Instincts
- `webfetch-sequential-research-deep-dive` — For initial investigation of NEW libraries
- `async-research-investigation-pattern` — For complex architectural research across multiple topics
