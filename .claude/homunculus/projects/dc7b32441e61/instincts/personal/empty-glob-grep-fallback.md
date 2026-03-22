---
id: empty-glob-grep-fallback
trigger: when Glob returns 0 files and subsequent search needed
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Empty Glob → Grep Tool Fallback

## Action
When Glob returns no files, switch to Grep tool for content-based search instead of falling back to Bash grep, which violates tool-usage guidelines.

## Evidence
- Observed 10+ empty Glob calls in session 2464ac8f-58a5-496a-b12e-600dcb754571
- Glob empty results: 09:17:16 (3x), 09:17:21 (2x), 09:17:30, 09:17:31, 09:17:35 (2x), 09:17:46
- Pattern: Multiple Glob patterns returned no matches, with subsequent Bash grep calls (09:17:17, 09:17:19 searching for "plugin:generate" and "settings-schema")
- Last observed: 2026-03-17T17:00:58Z
- Sessions: 2464ac8f-58a5-496a-b12e-600dcb754571 (original), 3db3a930-228b-4cee-8665-92a3648dd54b (new observations)
- **Additional observations from session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17T17:00-17:01)**:
  - 3 additional Glob empty results (17:00:45Z x2, 17:00:58Z)
  - Pattern remains consistent: targeted pattern searches returning no files
  - Confirms pattern recurs across multiple sessions
