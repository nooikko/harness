---
id: schema-model-inspection-ui-planning
trigger: when planning new UI features that interact with database models
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Schema Model Inspection During UI Planning

## Action
When designing UI features, inspect database schema models early to understand data structure and constraints before reading server actions and form components.

## Evidence
- Observed 5+ times in session 24439914-c6fd-4ef7-8e0b-6f559ceab0cd
- Pattern: Read page/UI files → Bash grep schema for relevant models (Project, File, FileScope) → Read server actions
- Prevents designing UIs that don't match data model capabilities
- Last observed: 2026-03-15T06:12:29Z

## Workflow
1. Read planning doc and page components to understand feature scope
2. Bash grep database schema for relevant model definitions (e.g., `Project`, `File`, enums)
3. Read schema.prisma in detail to check relationships and constraints
4. Cross-reference with server action signatures to verify they support needed operations
5. Then implement UI components

## Why This Matters
Checking schema early prevents designing UI for non-existent fields or incompatible relationships. Prevents wasted effort on components that can't map to the data layer.
