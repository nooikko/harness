# Implementation Plan: Projects System Comprehensive Review

## Task Type
- [x] Frontend
- [x] Backend
- [x] Fullstack (Parallel)

## Current State Assessment

### What Exists
| Layer | Component | Status |
|-------|-----------|--------|
| **Schema** | `Project` model (id, name, description, instructions, memory, model) | Complete |
| **Schema** | `Thread.projectId` FK | Complete |
| **Schema** | `AgentMemory.projectId` FK + `MemoryScope.PROJECT` | Complete |
| **Schema** | `CronJob.projectId` FK | Complete |
| **Schema** | `File.projectId` FK | Complete |
| **Server Action** | `create-project.ts` | Complete |
| **Server Action** | `update-project.ts` | Complete |
| **Server Action** | `delete-project.ts` | Complete (incl. file cleanup + thread unlinking) |
| **Component** | `NavProjects` — sidebar collapsible per project with threads | Complete |
| **Component** | `NewProjectForm` — dialog with name/description/instructions | Complete but **NOT rendered anywhere** |
| **Component** | `NewProjectThreadButton` — creates thread within project | Complete |
| **Component** | `ProjectSettingsForm` — edit name/desc/model/instructions, delete | Complete |
| **Page** | `/chat/projects/[project-id]` — project settings page | Complete |
| **Backend** | Context plugin injects `project.instructions` + `project.memory` | Complete |
| **Backend** | Identity plugin scopes memories by project | Complete |
| **Backend** | Orchestrator inherits `project.model` for threads | Complete |
| **Backend** | Project plugin exposes `get/set_project_memory` MCP tools | Complete |
| **Seed** | No project seed data | Missing |

### Critical Findings

#### Finding 1: Projects Index Page Missing (404)
- **Sidebar link** at `nav-links.tsx:19` points to `/chat/projects`
- **No `page.tsx`** exists at `apps/web/src/app/(chat)/chat/projects/page.tsx`
- Clicking "Projects" in sidebar → **404 error**
- Screenshot: `AI_RESEARCH/projects-review/02-projects-404.png`

#### Finding 2: NewProjectForm Not Rendered
- `new-project-form.tsx` exists with a working dialog component
- **Not imported by any page, layout, or component** (only in its own test)
- Users have **no way to create a project** from the UI

#### Finding 3: No Thread-to-Project Assignment UI
- `manage-thread-modal.tsx` has no project field
- Once a thread is created without a project, there's no way to assign it to one
- Only `NewProjectThreadButton` creates threads within a project (but see Finding 2)

#### Finding 4: No Project Seed Data
- Database has 0 projects (confirmed via Prisma query)
- `packages/database/prisma/seed.ts` seeds agents, threads, and cron jobs but **no projects**
- First-time users see no projects in the sidebar → the system appears broken

#### Finding 5: WebSocket Errors
- Console shows repeated `WebSocket connection to 'ws://localhost:4000'` errors
- Orchestrator not running → expected in dev-only-web mode
- No graceful degradation in the UI for missing WebSocket

#### Finding 6: Delegation Task Threads Don't Inherit Project Context (Backend)
- `setup-delegation-task.ts` creates task threads with NO `projectId`
- Sub-agents lose all project context: instructions, memory, PROJECT-scoped memories, PROJECT-scoped files
- **Impact:** Delegation within a project silently drops project context
- **File:** `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts`

#### Finding 7: No Project FK on Metric Table (Backend)
- `Metric` table has `threadId` but no `projectId`
- Project-level usage reporting is impossible without joining through Thread
- **Impact:** Low-priority but blocks future usage-by-project dashboards

#### Finding 8: Backward-Compatible Memory Retrieval Path (Backend)
- `retrieveMemories` has a fallback: when no context is provided, returns ALL agent memories regardless of scope
- Identity plugin always passes context (safe), but the code path exists for potential future misuse
- **Risk:** Theoretical — any new caller forgetting context would leak cross-project memories

---

## Data Isolation Assessment

| Component | Isolation | Notes |
|-----------|-----------|-------|
| Thread-Project FK | Strong | Schema-enforced, optional design |
| Memory Scoping (3-level) | Strong | OR filter, always passed context |
| File Loading | Strong | PROJECT + THREAD scoped correctly |
| Project Context Injection | Strong | Instructions & memory respect boundaries |
| Model Inheritance | Strong | Thread → Project → Default fallback |
| Reflection Scoping | Strong | Project-scoped reflections separate |
| **Task Threads (Delegation)** | **Weak** | Do NOT inherit parent's projectId |
| **Metrics** | **Missing** | No project FK on Metric table |
| **Backward Compat Path** | **Risky** | retrieveMemories uncontexted fallback |

---

## Implementation Steps

### Step 1: Create Projects Index Page (`/chat/projects`)
**Expected deliverable:** A page listing all projects with create button

Create `apps/web/src/app/(chat)/chat/projects/page.tsx`:
- Server component that queries `prisma.project.findMany()` with thread counts
- Renders a grid/list of project cards (name, description, thread count, model, updated date)
- Each card links to `/chat/projects/[project-id]` (settings)
- Include the `NewProjectForm` dialog trigger in the page header
- Empty state: "No projects yet. Create one to group related chats."

```pseudo
const ProjectsPage = async () => {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { threads: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return (
    <div>
      <header> "Projects" + <NewProjectForm /> </header>
      {projects.length === 0 ? <EmptyState /> : <ProjectGrid projects={projects} />}
    </div>
  );
};
```

**Key files:**
| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/(chat)/chat/projects/page.tsx` | Create | Projects list page |
| `apps/web/src/app/(chat)/chat/projects/_components/project-card.tsx` | Create | Card component for project display |

### Step 2: Wire NewProjectForm Into the UI
**Expected deliverable:** Users can create projects from sidebar + projects page

- Import `NewProjectForm` in the projects index page header (Step 1)
- Also add it to `NavLinks` or a sidebar section so users can create from anywhere
- After creation, `router.push` to the new project's settings page

**Key files:**
| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/(chat)/chat/_components/nav-links.tsx` | Modify | Add NewProjectForm icon button next to "Projects" label |

### Step 3: Add Thread-to-Project Assignment
**Expected deliverable:** Users can move existing threads into/out of projects

- Add a project selector to `manage-thread-modal.tsx`
- Create `update-thread-project.ts` server action (sets `thread.projectId`)
- Include "None" option to unlink from project

```pseudo
// Server action
export const updateThreadProject = async (threadId, projectId) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { projectId: projectId ?? null },
  });
  revalidatePath('/chat');
};
```

**Key files:**
| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/(chat)/chat/_actions/update-thread-project.ts` | Create | Server action for thread-project assignment |
| `apps/web/src/app/(chat)/chat/_components/manage-thread-modal.tsx` | Modify | Add project Select dropdown |

### Step 4: Seed Default Project
**Expected deliverable:** Fresh installs have a starter project

- Add a default project to seed data (e.g., "General" project)
- Optionally assign the primary thread to it
- Use `prisma.project.upsert` (safe to re-run)

**Key files:**
| File | Operation | Description |
|------|-----------|-------------|
| `packages/database/prisma/seed.ts` | Modify | Add project upsert |

### Step 5: Fix Delegation Task Thread Project Inheritance
**Expected deliverable:** Task threads inherit parent thread's projectId

In `setup-delegation-task.ts`, the task thread is created without `projectId`. Fix:

```pseudo
// In setupDelegationTask, query parent thread for projectId:
const parentThread = await tx.thread.findUnique({
  where: { id: options.parentThreadId },
  select: { projectId: true },
});

// Pass to thread creation:
const thread = await tx.thread.create({
  data: {
    ...existingFields,
    projectId: parentThread?.projectId,  // inherit from parent
  },
});
```

**Key files:**
| File | Operation | Description |
|------|-----------|-------------|
| `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts` | Modify | Add projectId inheritance from parent thread |

### Step 6: Thread Isolation Verification
**Expected deliverable:** Confirm threads correctly inherit project context

Verify and test:
- Threads within a project receive `project.instructions` in prompts (context plugin)
- Threads within a project receive `project.memory` in prompts (context plugin)
- Threads inherit `project.model` when thread has no model override (orchestrator Step 0)
- `AgentMemory` records with `scope: PROJECT` are only retrieved for matching `projectId`
- Moving a thread out of a project stops injecting that project's context
- **NEW:** Delegation task threads inherit parent's projectId and receive project context

### Step 7: System Isolation Verification
**Expected deliverable:** Confirm no cross-project data leakage

Verify and test:
- Thread sidebar correctly separates project threads from unassigned threads (line 14: `projectId: null` filter)
- Deleting a project unlinks threads but doesn't delete them (confirmed in `delete-project.ts`)
- CronJobs with `projectId` create threads that inherit the project
- File uploads scoped to project are cleaned up on project delete

### Step 8: Tests for New Components
**Expected deliverable:** Test coverage for all new files

- `projects/page.tsx` — async RSC test with `renderToStaticMarkup`
- `project-card.tsx` — render test with project data
- `update-thread-project.ts` — server action test (mock prisma)
- `setup-delegation-task.ts` — test projectId inheritance
- Integration: sidebar shows projects after creation

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Projects page layout inconsistent with rest of app | Follow existing patterns from `/agents` page for layout and styling |
| Thread-project assignment could break memory scoping | Test that moving a thread recalculates memory retrieval scope |
| No project name uniqueness constraint | Schema has no unique on `name` — decide if this is intentional |
| WebSocket errors in console with orchestrator offline | Add try/catch or connection retry with backoff in WS client |
| Empty NewProjectForm `model` field | Create form doesn't include model selector (settings form does) — minor gap |

## Priority Order

1. **Step 1 + 2** (Critical) — Projects 404 and no creation UI are show-stoppers
2. **Step 5** (Critical) — Delegation task threads lose project context silently
3. **Step 4** (High) — Seed data so projects appear on fresh install
4. **Step 3** (Medium) — Thread-project assignment completes the workflow
5. **Step 6 + 7** (Medium) — Isolation verification ensures correctness
6. **Step 8** (Standard) — Test coverage for all changes

## Future Considerations (Not In Scope)

- **Add `projectId` FK to `Metric` table** — enables project-level usage dashboards
- **Project name uniqueness constraint** — schema has no unique on `name`
- **WebSocket graceful degradation** — retry with backoff when orchestrator offline
- **`retrieveMemories` context enforcement** — make context parameter required (breaking change)
