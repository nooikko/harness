---
id: sequential-server-action-crud-creation
trigger: when implementing database features requiring multiple CRUD operations
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Sequential Server Action CRUD Creation

## Action
Create "use server" action files in sequence for CRUD operations: create, update, delete, then related operations (e.g., dependencies).

## Evidence
- Observed 5 instances in session dc7b32441e61 on 2026-03-15
- Pattern: When building task management features, create server actions in this order:
  1. create-task.ts (Create operation)
  2. update-task.ts (Update operation)
  3. delete-task.ts (Delete operation)
  4. add-task-dependency.ts (Relation operation)
  5. remove-task-dependency.ts (Relation cleanup)
- Each file uses "use server" directive, Prisma operations, and revalidatePath()
- Last observed: 2026-03-15T06:18:30Z

## Notes
This pattern suggests a deliberate CRUD-first workflow when adding new entity management features. Server actions are typed, error-handled, and include cache invalidation.
