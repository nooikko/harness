---
id: glob-file-discovery
trigger: when locating files by pattern across the codebase
confidence: 0.5
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Glob for File Discovery

## Action
Use Glob tool to locate files by pattern (e.g., `**/*.test.ts`, `**/sidebar*.tsx`) before reading or editing them.

## Evidence
- Session 75f4fdab-d328-44c8-9d7e-443e67343229 (00:05:37-00:05:38): Glob search for sidebar components, returned 4 matching files
- Session 75f4fdab-d328-44c8-9d7e-443e67343229 (00:05:37): Another Glob pattern search
- Session 4f4992b7-684f-4b35-9264-f6e40ea49329 (00:11:38): Glob search for additional file patterns
- Session 4f4992b7-684f-4b35-9264-f6e40ea49329 (00:17:14, 2026-03-18): Glob search for projects-related files, returned 24 matching files with project structure details
- Total: 5 Glob operations across 3 sessions
- Last observed: 2026-03-18T00:17:14Z

## Pattern
User consistently uses Glob as a discovery mechanism:
1. Search for files matching a pattern
2. Discover locations and filenames
3. Follow up with Read/Edit on discovered files

Glob serves as the primary tool for efficient codebase navigation before targeted read/edit operations.
