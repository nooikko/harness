---
id: web-search-query-specificity-empty-results
trigger: when executing WebSearch or WebFetch with narrow, domain-specific search terms
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Web Search Query Specificity Causes Empty Results

## Action
Broaden search terms by removing domain-specific modifiers, narrowing date ranges, or shifting to more general keywords when initial search returns empty results.

## Evidence
- Observed 13+ empty WebSearch/WebFetch responses in session 20d108a3-0403-439c-abbd-0bfb5dd49a29 (2026-03-18)
- Pattern: Search for "health AI assistant disclaimer best practices 'not medical advice' effective communication 2025" returned empty with explicit note: "specific combination of search terms is quite narrow and may not have substantial web content matching all these criteria"
- Subsequent broader searches succeeded:
  - "FDA guidance AI wellness health apps not medical device regulation 2024 2025" → 10+ results
  - "InsideTracker SiPhox Health Function Health Levels AI biomarker tracking" → 10+ results
  - "blood work interpretation optimal ranges vs reference ranges functional medicine" → 10+ results
- Last observed: 2026-03-18T00:50:23Z

## When to Apply
When a search returns empty results:
1. Remove hyphenated keywords or quoted phrases
2. Drop specific date range modifiers if available
3. Shift from technical/regulatory terminology to general domain keywords
4. Break multi-constraint queries into separate, simpler searches

Examples:
- ❌ "health AI assistant disclaimer best practices 'not medical advice' effective communication 2025"
- ✅ "FDA guidance AI wellness health apps 2024 2025"

- ❌ Narrow domain-specific queries with 5+ constraint terms
- ✅ 2-3 constraint terms focused on core topic

## Benefits
- Increases likelihood of finding relevant results
- Avoids repeated empty searches wasting session time
- Can follow up with WebFetch on promising results
- Supports layered research approach: broad first, then narrow
