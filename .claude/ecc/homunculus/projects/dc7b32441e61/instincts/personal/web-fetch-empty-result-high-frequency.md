---
id: web-fetch-empty-result-high-frequency
trigger: when using WebFetch to retrieve URLs discovered via WebSearch
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# WebFetch Empty Results High Frequency

## Action
When WebFetch returns empty output, validate that the URL is publicly accessible and doesn't require authentication. Prefer WebSearch for discovery; use WebFetch selectively for official documentation sites that are known to work. If multiple WebFetch attempts fail, consider that the source may require authentication headers or may be blocking programmatic access.

## Evidence
- Observed 6 empty WebFetch completions vs 4 successful completions in session 20d108a3-0403-439c-abbd-0bfb5dd49a29
- Pattern: Rapid sequential WebFetch calls returning empty output (timestamps 00:51:22, 00:51:23, 00:51:26, then again at 00:51:39)
- Contrast: WebSearch used for discovery returned results reliably (4 successful, 1 empty)
- Success cases: WebFetch worked for official docs (blog.insidetracker.com, pmc.ncbi.nlm.nih.gov, github.com)
- Last observed: 2026-03-18T00:51:39Z

## Context
In this session, WebSearch was used to discover URLs on topics (biomarker visualization, patient participation in AI healthcare, code review prompts, doctor appointment preparation, Pi AI design). Many of the resulting URLs then returned empty when fetched with WebFetch, suggesting:
1. URLs may require authentication or special headers
2. Some sites may block or rate-limit WebFetch requests
3. WebSearch discovers URLs that don't all have publicly accessible content

## When to Apply
- After WebFetch returns empty for a URL discovered via WebSearch
- When doing multi-step research (search → fetch → analyze)
- When WebFetch consistently fails across different domains

## Benefits
- Avoid wasting tool calls on URLs that won't return content
- Recognize that WebSearch discovery doesn't guarantee WebFetch success
- Focus WebFetch on known-reliable sources (official documentation)
