---
id: cascading-model-relationships
trigger: when adding a new database model that should relate to multiple existing models
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Cascading Model Relationships

## Action
When adding a new database model to the schema, systematically add relationship fields to each existing model that should reference it. Use separate, focused edits for each relationship addition to keep changes atomic.

## Evidence
- Observed 3 times in session 8eb534ab-c0ed-413f-af79-522e2dfca6ce
- Pattern: Added `File` model enum and model, then added `files` field to Project (Edit), Thread (Edit), and Agent (Edit)
- Each relationship was added via its own Edit operation
- Followed by schema verification via Read and Bash db:generate/build
- Last observed: 2026-03-13T03:21:16Z

## Notes
When one new model connects to multiple entities, avoid adding all relationships in a single edit. Separate them to maintain clarity and allow for easier review/debugging of each connection.
