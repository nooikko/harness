---
id: webfetch-empty-response-fallback
trigger: when WebFetch returns empty output string after successful HTTP request
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# WebFetch Empty Response Fallback

## Action
When WebFetch returns empty output despite a 200 response, don't retry the same URL—instead use Bash with curl to diagnose the actual response, try a simplified prompt, or pivot to a different information source.

## Evidence
- Session 9fc9b500-3fe7-4994-9892-df5e7e684625 (2026-03-14): 21 empty responses observed
- Pattern: Scattered empty outputs across 08:55:44Z–08:56:03Z mixed with successful fetches
- Affected multiple documentation sites (tsup, esbuild, turborepo endpoints)
- Session 49317fb5 (2026-03-18 00:22-00:23): 8+ empty responses out of ~16 WebFetch calls
- Pattern: Empty responses interspersed across research sequence (08:22:42Z-08:22:55Z, 08:23:03Z)
- Affected: redirect endpoints, third-party content pages
- Last observed: 2026-03-18T00:23:03Z
- Impact: Breaks information gathering flow, requires manual URL filtering and fallback strategies

## Context
WebFetch empty responses are distinct from failures—they indicate HTTP success but no extractable content, possibly due to JavaScript-heavy pages, timeout, or content type issues. Repeating the same fetch wastes time.
