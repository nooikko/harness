---
id: systematic-package-exploration-bash-grep-read
trigger: when exploring multiple related packages in the monorepo to understand structure and implementation
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Systematic Package Exploration via Bash-Grep-Read

## Action
When investigating related packages, use Bash to discover available files, Grep to filter for relevant patterns, then Read to examine specific implementation files in detail.

## Pattern
Three-phase systematic exploration workflow:
1. **Discovery (Bash)**: List files in package directory to understand available modules
2. **Filtering (Grep)**: Search for specific patterns (e.g., "Collection", "export") to identify key files
3. **Examination (Read)**: Read identified files in sequence to understand implementation

## Evidence
- Observed 2 times in session b7f02528-4124-41f6-9a3b-ebf8afed624b
- Exploration sequence for `search` package: Bash list → Grep filter → (Read implied)
- Exploration sequence for `vector-search` package: Bash list → Grep filter → Read 6 files (index.ts, qdrant-client.ts, ensure-collections.ts, search-points.ts, upsert-point.ts, collections.ts)
- Both packages have identical structure: src/, src/_helpers/, src/__tests__/ - pattern successfully applies to both
- Timestamp: 2026-03-20T01:30:01-01:30:13Z

## Context
This workflow is efficient for monorepo exploration where:
- Multiple packages have similar structure
- Initial discovery phase establishes file organization
- Grep filtering identifies key exports and patterns
- Sequential Read consolidates understanding of complete implementation

## Related Instincts
- `read-grep-read-workflow`: Similar pattern but starts with a read file rather than discovery
- `plugin-exploration-workflow`: Uses Glob for discovery instead of Bash listing
