---
id: web-research-empty-response-rate
trigger: when using WebFetch for web research on technical/academic topics
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# High Empty Response Rate in Web Research

## Action
Expect that 50-70% of WebFetch calls during web research will return empty output; supplement with multiple source queries and be prepared to synthesize from partial results.

## Evidence
- **Session 1** (2026-03-18T00:24:37Z): 15 empty out of 21 WebFetch calls (71% empty rate)
- **Session 2** (2026-03-18T00:25:33Z): 5-6 empty/irrelevant out of 9 WebFetch calls (56-67% rate)
- **Combined:** ~20-21 empty/irrelevant out of 30 calls (67-70% rate across sessions)
- Pattern: Consistent empty responses or explicit "does not contain" messages interspersed with off-topic results
- Context: Both sessions researching agent personas, role-prompting, system prompts, and prompt engineering guidance
- Last observed: 2026-03-18T00:25:33Z

## Implications
- Empty responses are not failures—pages may lack extractable text content
- Many web pages have JavaScript-rendered content or insufficient structured data
- Research workflows should account for high retry/resample rate
- Consider diversifying sources when initial WebFetch batch returns mostly empty
