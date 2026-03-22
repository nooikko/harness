# Plan: Task/Todo List System

## Summary

A personal task management system that agents can interact with via MCP tools and users can manage through a dedicated UI. Tasks support titles, descriptions, message provenance, project scoping, and dependency chains (blockers/successors).

## Design Decisions

- **New `UserTask` model** (not reusing `OrchestratorTask`) — `OrchestratorTask` is for delegation loop internals. User-facing tasks are a different domain with different fields (dependencies, due dates, message links, project scope).
- **New plugin: `@harness/plugin-tasks`** — exposes MCP tools for agents to create/update/complete tasks during conversation.
- **New UI route: `/tasks`** — accessible from the sidebar, shows global + project-scoped task lists.
- **Dependency model via join table** — `UserTaskDependency` with `dependsOnId` / `dependentId` enables "blocked by" and "blocks" relationships.

## Schema

```prisma
enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model UserTask {
  id            String        @id @default(cuid())
  title         String
  description   String?       @db.Text
  status        TaskStatus    @default(TODO)
  priority      TaskPriority  @default(MEDIUM)
  dueDate       DateTime?

  // Provenance — which message/thread spawned this task
  sourceMessageId String?
  sourceThreadId  String?

  // Scoping — null projectId = global task
  projectId     String?
  project       Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // Who created it (agent vs user)
  createdBy     String        @default("user") // "user" | agent slug

  // Dependencies
  blockedBy     UserTaskDependency[] @relation("DependentTask")
  blocks        UserTaskDependency[] @relation("BlockingTask")

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  completedAt   DateTime?

  @@index([status])
  @@index([projectId, status])
  @@index([sourceThreadId])
}

model UserTaskDependency {
  id            String    @id @default(cuid())
  dependentId   String    // The task that is blocked
  dependent     UserTask  @relation("DependentTask", fields: [dependentId], references: [id], onDelete: Cascade)
  dependsOnId   String    // The task that must complete first
  dependsOn     UserTask  @relation("BlockingTask", fields: [dependsOnId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())

  @@unique([dependentId, dependsOnId])
}
```

Add `tasks UserTask[]` relation to `Project` model.

## Plugin: `@harness/plugin-tasks`

### MCP Tools

| Tool | Description |
|------|-------------|
| `tasks__add_task` | Create a new task. Auto-resolves `projectId` and `sourceThreadId` from `meta.threadId`. |
| `tasks__list_tasks` | List tasks, filterable by status/project/priority. Returns compact summaries. |
| `tasks__update_task` | Update title, description, status, priority, dueDate by task ID. |
| `tasks__complete_task` | Mark a task as DONE, sets `completedAt`. |
| `tasks__add_dependency` | Link two tasks: "task A is blocked by task B". |
| `tasks__remove_dependency` | Remove a dependency link. |

### Tool Schemas (key fields)

**add_task:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "priority": "LOW|MEDIUM|HIGH|URGENT (optional, default MEDIUM)",
  "dueDate": "ISO datetime (optional)",
  "projectId": "string (optional, auto-resolved from thread if omitted)",
  "blockedBy": "string[] (optional, task IDs this is blocked by)"
}
```

**list_tasks:**
```json
{
  "status": "TODO|IN_PROGRESS|DONE|CANCELLED (optional)",
  "projectId": "string (optional, omit for global)",
  "includeGlobal": "boolean (default true — include unscoped tasks)"
}
```

### Plugin Shape

```typescript
const tasksPlugin: PluginDefinition = {
  name: "tasks",
  version: "1.0.0",
  tools: [addTask, listTasks, updateTask, completeTask, addDependency, removeDependency],
  register: async (ctx) => ({
    // No hooks needed initially — purely tool-driven
  }),
};
```

## UI: `/tasks` Route

### Layout

Add "Tasks" link to `NavLinks` in the sidebar (between Agents and Admin).

### Page Structure

```
/tasks                    → Global task list (all tasks, filterable)
/tasks?project=<id>       → Project-scoped view (query param filter)
```

### Components

1. **`task-list-page.tsx`** (server component)
   - Fetches tasks with dependencies
   - Groups by: status (kanban columns) OR flat list with filters
   - Start with flat list + status filter tabs (TODO / In Progress / Done)

2. **`task-card.tsx`** (client component)
   - Shows: title, priority badge, due date, project tag, dependency count
   - Click → expands inline or opens detail panel
   - Quick actions: status toggle, priority change

3. **`task-detail-panel.tsx`** (client component)
   - Full task view: title, description (markdown), status, priority, due date
   - "Source" link → navigates to the thread/message that created it
   - Dependencies section: "Blocked by" list + "Blocks" list
   - Add dependency via search/select

4. **`create-task-modal.tsx`** (client component)
   - Title, description, priority, due date, project selector
   - "Add blocker" search field

5. **`task-filters.tsx`** (client component)
   - Status tabs, priority filter, project filter, search

### Server Actions

```
_actions/
  create-task.ts
  update-task.ts
  delete-task.ts
  list-tasks.ts
  add-task-dependency.ts
  remove-task-dependency.ts
```

## Implementation Steps

### Step 1: Schema + Migration
- Add `UserTask`, `UserTaskDependency` models to `schema.prisma`
- Add `tasks UserTask[]` to `Project`
- Run `pnpm db:generate` + migration

### Step 2: Plugin (MCP tools)
- Create `packages/plugins/tasks/` with standard structure
- Implement 6 MCP tools
- Register in `ALL_PLUGINS` (after project plugin)
- Tests for each tool handler

### Step 3: Server Actions
- Create `apps/web/src/app/(chat)/chat/_actions/tasks/` with CRUD actions
- Or create at route level: `apps/web/src/app/tasks/_actions/`

### Step 4: UI — Task List Page
- Create `/tasks` route with list view
- Task card component with status/priority badges
- Filter tabs (status)
- Add "Tasks" to sidebar NavLinks

### Step 5: UI — Task Detail + Create
- Task detail panel (slide-over or inline expand)
- Create task modal
- Dependency management UI (add/remove blockers)
- Source message link (navigate to thread)

### Step 6: UI — Integration Points
- In thread view: show tasks created from this thread (small badge/link)
- In project view: show project tasks count

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/database/prisma/schema.prisma` | Modify | Add UserTask, UserTaskDependency, TaskStatus, TaskPriority |
| `packages/plugins/tasks/src/index.ts` | Create | Plugin definition with 6 MCP tools |
| `packages/plugins/tasks/src/_helpers/*.ts` | Create | Tool handlers (one per file) |
| `apps/orchestrator/src/plugin-registry/index.ts` | Modify | Register tasks plugin |
| `apps/web/src/app/tasks/page.tsx` | Create | Task list page |
| `apps/web/src/app/tasks/_components/*.tsx` | Create | Task UI components |
| `apps/web/src/app/tasks/_actions/*.ts` | Create | Server actions |
| `apps/web/src/app/(chat)/chat/_components/nav-links.tsx` | Modify | Add Tasks link |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Circular dependencies (A blocks B blocks A) | Validate in `add_dependency` tool + server action — reject if cycle detected |
| Task list performance with many tasks | Pagination from the start (cursor-based), index on status+projectId |
| Agent creating duplicate tasks | Tool returns existing task if title+projectId match within 1 hour |
