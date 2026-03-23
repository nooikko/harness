# Workspace Orchestration System

**Status:** Spec + Plan
**Date:** 2026-03-22
**Scope:** New workspace plugin, delegation rework, project directory linking, UI changes

---

## Problem

The delegation system works for single parent-to-sub-agent tasks but breaks down for multi-agent orchestration. When a user says "get comprehensive test coverage," the parent agent should break that into tasks, spawn reviewers and workers, evaluate results, re-delegate failures, and keep cycling autonomously until the objective is met or it needs human input.

**Current failure modes (mapped to MASFT taxonomy):**

| Failure | What happens |
|---------|-------------|
| Step repetition (lost state) | Parent loses the plan — it only exists in conversation history which gets long and lossy |
| Task derailment (objective drift) | No periodic re-affirmation of the original goal after 3-4 delegation rounds |
| Unaware of termination | No explicit "done" criteria — parent doesn't know when to stop |
| Premature termination | Validator auto-accepts on last iteration; parent can't say "not done yet" |

**Root causes:**
1. No persistent plan state — parent relies on conversation history
2. No enforcement of orchestration behavior — parent can respond without updating the plan
3. Global semaphore (3 max) blocks concurrent multi-agent work
4. Sub-agents can't delegate (no depth support)
5. Delegation results are unstructured text — no inline summary in parent thread
6. Sub-agents run in tmpdir — no access to target project's Claude config, hooks, or pre-commit checks

---

## Design Decisions

### Approach: Structured Autonomy (Option C from brainstorming)

Claude is the orchestrator. It operates on structured state and the system enforces key behaviors. Not a rigid state machine (too inflexible), not just better prompts (too unreliable).

### Agent Hierarchy

```
Human
  -> Parent Agent (orchestrator — owns plan, strategic decisions)
      -> Reviewer Agent (quality gate — owns worktree, reviews code)
          -> Worker Agent (implementer — writes code, commits)
```

Not hardcoded to three tiers. Any agent at any level can delegate further, subject to a configurable max depth. The three-tier pattern is what naturally emerges for coding tasks.

### Parent as Quality Gatekeeper

The parent isn't a project manager ticking boxes. It's the senior engineer who:
1. Reviews the actual output from reviewers
2. Evaluates against the objective and standards
3. Pushes back with specific critique
4. Re-delegates with feedback

Before results reach the parent, they must pass automated checks (pre-commit: typecheck, lint, build, coverage gate). The parent only spends tokens on intent/quality/completeness judgment.

### Autonomous Operation with Periodic Check-ins

The parent runs autonomously toward the objective. It checks in at natural milestones: "phase 1 complete, here's what I found, moving to phase 2." The user can steer or let it run. If genuinely stuck, it escalates.

### Project Directory Linking

Projects get a `workingDirectory` field. Sub-agents spawned for workspace tasks resolve `cwd` from thread -> project -> `workingDirectory`. This means sub-agents pick up the target project's `.claude/` config, hooks, MCP servers, and pre-commit checks.

---

## Schema Changes

### New: WorkspacePlan

```prisma
model WorkspacePlan {
  id          String   @id @default(cuid())
  threadId    String   @unique
  thread      Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  objective   String   @db.Text
  status      String   @default("planning") // planning | active | paused | completed | failed
  planData    Json     // structured task graph
  maxDepth    Int      @default(3)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
}
```

**planData shape:**

```typescript
type PlanData = {
  tasks: PlanTask[];
};

type PlanTask = {
  id: string;                        // e.g. "t1"
  title: string;
  description: string;
  status: "pending" | "delegated" | "in_review" | "accepted" | "rejected" | "failed";
  dependsOn: string[];               // task IDs that must complete first
  acceptanceCriteria: string;
  assignedTaskId: string | null;      // OrchestratorTask.id when delegated
  assignedThreadId: string | null;    // sub-agent thread ID
  result: string | null;             // summary of completed work
  reviewNotes: string | null;        // parent's review feedback
  depth: number;                      // 0 = direct child of parent, 1 = grandchild, etc.
};
```

### Modified: Project

```prisma
model Project {
  // ... existing fields
  workingDirectory  String?           // absolute path to linked local directory
}
```

### Modified: OrchestratorTask

```prisma
model OrchestratorTask {
  // ... existing fields
  planId            String?           // FK to WorkspacePlan (null for non-workspace delegation)
  planTaskId        String?           // which plan task this maps to (e.g. "t1")
  parentTaskId      String?           // parent OrchestratorTask.id (for depth tracking)
  depth             Int     @default(0)
}
```

### Modified: Thread

Add relation for WorkspacePlan:

```prisma
model Thread {
  // ... existing fields
  workspacePlan     WorkspacePlan?
}
```

---

## New Plugin: @harness/plugin-workspace

### MCP Tools

| Tool | Purpose |
|------|---------|
| `workspace__create_plan` | Parse objective into structured task graph. Returns plan for user approval before activating. |
| `workspace__update_plan` | Update task statuses, add/remove tasks, modify criteria. Called by parent after evaluating results. |
| `workspace__get_plan` | Read current plan state. Filtered by depth — sub-agents only see their relevant scope. |
| `workspace__complete_plan` | Mark plan as completed, generate summary. |
| `workspace__escalate` | Flag for human attention — "I'm stuck" or "this needs a decision." |
| `workspace__report` | Structured status report from reviewer/worker back to parent. Includes: what was done, files changed, test results, concerns. |
| `workspace__list_agents` | Paginated list of available agents with role/goal/soul. Use to discover specialists for task assignment. |
| `workspace__search_agents` | Keyword search over agent name/role/goal/soul/identity. Find the right specialist for a task. |

### Hooks

**`onBeforeInvoke`** — When thread has an active WorkspacePlan:
- Inject current plan state (structured, not conversation dump)
- Re-state the original objective (drift prevention)
- Include orchestration instructions: "evaluate incoming results, update the plan, delegate next tasks or re-delegate failures"
- Include what just happened: "Task X completed/failed, here's the summary"

**`onAfterInvoke`** — Enforcement nudge:
- Check if the parent updated the plan during its turn (did it call `workspace__update_plan`?)
- If not, and there are pending results to act on, log a warning (future: auto-nudge)

**`onPipelineComplete`** — For sub-agent threads tied to a workspace task:
- Run pre-commit validation gate (resolve project -> workingDirectory -> run checks)
- If checks fail, bounce back to sub-agent with error output before delivering to parent
- If checks pass, deliver result upstream with "passed automated checks" signal

### Plugin Registration Order

Workspace plugin registers AFTER identity and context (needs prompt injection to work with them), BEFORE delegation (workspace modifies how delegation behaves for workspace tasks).

```
identity -> activity -> context -> workspace -> delegation -> ...
```

---

## Delegation Plugin Rework

### Changes Required

**1. Per-plan semaphore instead of global**

Current: single global semaphore, `maxConcurrentAgents` (default 3).
New: workspace tasks get their own semaphore keyed by `planId`. Non-workspace delegation still uses the global semaphore. Default per-plan limit: 5 (configurable on the plan).

**2. N-depth delegation**

Current: sub-agents can technically delegate but hit the global semaphore.
New: track `depth` on OrchestratorTask. Each delegation increments depth. Max depth from WorkspacePlan (default 3). Non-workspace delegation: max depth 1 (current behavior).

**3. cwd passthrough**

Current: sub-agents run with `cwd: os.tmpdir()`.
New: for workspace tasks, resolve `cwd` from thread -> project -> `workingDirectory`. Pass to `claude -p` invocation. This means sub-agents pick up the target project's `.claude/` config.

**4. Pre-commit validation gate**

Current: validator plugin does LLM-based rubric check.
New: for workspace tasks, run target project's pre-commit checks BEFORE validator. If pre-commit fails, bounce back to sub-agent with error output — don't waste validator tokens on code that doesn't build.

**5. Structured result delivery**

Current: `sendThreadNotification` sends a wall of text.
New: send a structured content block with: task title, status, files changed, test results, reviewer assessment. Rendered as a collapsible card in the parent thread — no navigation required.

**6. Delegation tool schema expansion**

Add optional fields to the `delegate` tool:

```typescript
{
  prompt: string;          // existing
  model: string;           // existing
  maxIterations: number;   // existing
  planId: string;          // NEW — workspace plan this belongs to
  planTaskId: string;      // NEW — which plan task
  parentTaskId: string;    // NEW — parent task (for depth tracking)
  cwd: string;             // NEW — working directory override
}
```

These are auto-populated by the workspace plugin when it delegates — the agent doesn't need to fill them manually.

---

## UI Changes

### Project Settings

- New "Working Directory" field — text input with browse button (or just text input for v1)
- Shows linked path with "Remove" button
- Validation: check directory exists, check it's a git repo (warning if not)

### Thread Header / Menu

- "Start Workspace" button in thread menu — creates WorkspacePlan, parent produces plan for approval
- "Pause / Resume" — toggles plan status (paused plans don't process incoming results)
- "Stop Workspace" — marks plan cancelled, cleans up running tasks
- Status indicator when plan is active: "Workspace: 3/7 tasks done"

### In-Chat: Delegation Result Cards

New content block type: `workspace-task-result`

Shows:
- Task title + status badge (accepted / rejected / failed)
- Files changed summary (collapsible)
- Test results summary
- Reviewer assessment (if went through reviewer)
- "View full thread" deep link
- Expand/collapse for full details

This replaces the current delegation card (which only shows attempt count + link).

### Plan Overview Panel

Accessible from the status indicator in thread header. Shows:
- Original objective
- Task list with statuses, assignments, dependencies
- Progress bar
- Active agents and what they're working on
- Cost so far

---

## Prompt Engineering

### Parent Orchestration Prompt

Injected via `onBeforeInvoke` when plan is active:

```
# Workspace Plan

## Objective
{plan.objective}

## Current Status
{plan.status} — {completedCount}/{totalCount} tasks done

## Task Graph
{formatted task list with statuses, dependencies, results}

## What Just Happened
{latest result/notification that triggered this invocation}

## Your Role
You are managing this workspace plan. For each incoming result:
1. Evaluate the quality and completeness against the acceptance criteria
2. Update the plan (call workspace__update_plan)
3. Take the next action:
   - DELEGATE: spawn the next task(s) whose dependencies are met
   - RE-DELEGATE: send rejected work back with specific feedback
   - ESCALATE: call workspace__escalate if you need human input
   - COMPLETE: call workspace__complete_plan when all tasks are accepted

You can spawn reviewer agents who create worktrees and manage worker agents.
Reviewers enforce code quality. Workers write code and commit.
Sub-agents work in {project.workingDirectory} with that project's configuration.
```

### Reviewer Prompt Template

```
# Your Task
{task.title}: {task.description}

## Acceptance Criteria
{task.acceptanceCriteria}

## Working Directory
{project.workingDirectory}

## Instructions
1. Create a git worktree for this work
2. Spawn worker agents for implementation subtasks
3. Workers must commit their code to the worktree before reporting done
4. Review all worker output for quality, correctness, and architectural fit
5. Run pre-commit checks (typecheck, lint, build, coverage)
6. Report back using workspace__report with your assessment
```

### Worker Prompt Template

```
# Your Task
{specific coding task}

## Working Directory
{worktree path}

## Instructions
Work in the provided directory. This project has its own Claude configuration
and hooks — follow them. Commit your code when done. Your code must pass
all pre-commit checks before you report completion.
```

---

## Implementation Plan

### Phase 1: Schema + Project Directory Linking

**What:** Database changes and project settings UI.

**Steps:**
1. Add `workingDirectory` to Project model in schema.prisma
2. Add WorkspacePlan model to schema.prisma
3. Add `planId`, `planTaskId`, `parentTaskId`, `depth` to OrchestratorTask
4. Add WorkspacePlan relation to Thread
5. Run migration
6. Add "Working Directory" field to project settings form (`project-settings-form.tsx`)
7. Add `update-project` server action support for `workingDirectory`
8. Tests for schema changes and server action

**Dependencies:** None
**Risk:** Low — additive schema changes, nullable fields

### Phase 2: Workspace Plugin (Core)

**What:** New plugin with MCP tools and plan management.

**Steps:**
1. Create `packages/plugins/workspace/` with standard plugin structure
2. Implement `workspace__create_plan` tool — parses objective into task graph JSON
3. Implement `workspace__update_plan` tool — modifies planData
4. Implement `workspace__get_plan` tool — reads plan state (depth-filtered)
5. Implement `workspace__complete_plan` tool — marks plan done, generates summary
6. Implement `workspace__escalate` tool — flags for human attention
7. Implement `workspace__report` tool — structured status report from sub-agents
8. Implement `onBeforeInvoke` hook — injects plan state + orchestration prompt when plan is active
9. Implement `onAfterInvoke` hook — checks for plan update enforcement
10. Register in plugin-registry (after context, before delegation)
11. Tests for each tool and hook

**Dependencies:** Phase 1 (schema)
**Risk:** Medium — prompt engineering quality determines how well the parent orchestrates

### Phase 3: Delegation Plugin Rework

**What:** Fix the delegation system to support workspace orchestration.

**Steps:**
1. **Audit existing delegation code** — read every helper, identify what's broken vs what works
2. **Per-plan semaphore** — replace global semaphore with per-planId tracking. Keep global for non-workspace delegation.
3. **N-depth delegation** — add depth tracking to OrchestratorTask. Enforce maxDepth from plan. Pass depth through delegation options.
4. **cwd passthrough** — resolve workingDirectory from thread -> project. Pass to `invoke-sub-agent.ts` which passes to `claude -p`.
5. **Pre-commit validation gate** — before delivering results upstream, run target project's pre-commit checks. On failure, bounce back with error output.
6. **Expand delegate tool schema** — add `planId`, `planTaskId`, `parentTaskId`, `cwd` optional fields
7. **Structured result delivery** — rework `sendThreadNotification` to send structured content block instead of plain text
8. **Fix result truncation** — current: `invokeResult.output.slice(0, 200)`. New: structured summary with file list, test results, full output available on expand.
9. Tests for each change — especially concurrent delegation, depth limits, cwd resolution

**Dependencies:** Phase 1 (schema), Phase 2 (workspace plugin for planId resolution)
**Risk:** High — delegation is core infrastructure. Rework must not break existing non-workspace delegation. Needs thorough testing.

### Phase 4: UI — Workspace Controls + Result Cards

**What:** Thread workspace activation, plan overview, inline delegation results.

**Steps:**
1. "Start Workspace" button in thread menu — calls server action to create WorkspacePlan
2. "Pause / Resume / Stop" controls
3. Status indicator in thread header when plan is active
4. Plan overview panel (modal or sidebar) — task list, progress, cost
5. New content block: `workspace-task-result` — collapsible card for delegation results in chat
6. Replace current delegation card with the new content block (or keep both — old for non-workspace, new for workspace)
7. Server actions: `create-workspace-plan`, `update-workspace-plan`, `get-workspace-plan`, `cancel-workspace-plan`
8. WebSocket events for plan updates (task status changes, progress)

**Dependencies:** Phase 2 (workspace plugin), Phase 3 (structured results)
**Risk:** Medium — UI work, well-scoped

### Phase 5: Integration Testing + Prompt Tuning

**What:** End-to-end validation and prompt refinement.

**Steps:**
1. Manual E2E test: create project, link directory, start workspace, run a real multi-agent task
2. Tune orchestration prompt based on observed parent behavior — does it update the plan? does it re-delegate failures? does it know when to stop?
3. Tune reviewer/worker prompts — do workers commit? do reviewers actually review?
4. Load test: what happens with 5 concurrent sub-agents?
5. Test edge cases: sub-agent crashes, cost cap hit, user pauses mid-run, user sends message while agents are working
6. Test non-workspace delegation still works (regression)

**Dependencies:** All prior phases
**Risk:** Medium — prompt tuning is iterative and may reveal design gaps

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude doesn't follow orchestration prompt reliably | HIGH | Enforcement hook nudges on missed plan updates. Structured tools make the right action easy. Iterative prompt tuning in Phase 5. |
| Delegation rework breaks existing delegation | HIGH | Phase 3 keeps backward compatibility — non-workspace delegation uses same code paths with null planId. Thorough regression tests. |
| Token cost explosion with multi-agent work | MEDIUM | Per-plan cost cap. Filtered result passing (sub-agents don't get full parent history). Haiku for automated checks, Sonnet/Opus only for judgment calls. |
| Working directory resolution fails (project not linked, dir doesn't exist) | LOW | Validate on plan creation. Clear error: "link a working directory in project settings first." |
| Sub-agents conflict with each other (editing same files) | MEDIUM | Worktree isolation — each reviewer gets its own branch. Parent merges accepted work. Conflicts are the parent's problem to resolve. |
| Context window overflow on long-running plans | MEDIUM | Plan state is structured JSON, not conversation history. Summarization plugin compresses chat. Plan itself stays small. |

---

## Design Decision: Tools Over Prompts

**Principle:** Anything the AI needs to actually function should be built into a tool or a rule, not just a prompt injection.

The orchestration prompt (`onBeforeInvoke`) provides context, but the structured behavior should be enforced through tools:

- `workspace__create_plan` validates the plan structure before accepting it
- `workspace__update_plan` validates status transitions
- `workspace__list_agents` / `workspace__search_agents` lets the parent discover available specialists instead of guessing
- Future: `workspace__activate` tool that bootstraps the entire hierarchy with validated prompt templates for each tier (parent/reviewer/worker), rejecting prompts that contain implementation code for reviewer-tier agents

**Agent Discovery:** The parent agent discovers available specialists via `workspace__search_agents` (keyword search over name/role/goal/soul/identity) and `workspace__list_agents` (paginated browse). This uses the existing `Agent` model — no separate registry needed.

**Prompt Template Validation (future):** The `activate` tool should validate prompt templates:
- Reviewer prompts must not contain implementation code
- Worker prompts must include the working directory
- Parent eval criteria must be specific (reject vague "make it good" criteria)
- Templates are stored on the `planData` so they're inspectable and editable mid-run

---

## What This Does NOT Include

- **New workspace route / IDE layout** — chat IS the workspace
- **File diff viewer** — future enhancement, not v1
- **Git integration as MCP tools** — sub-agents use git via the target project's CLI
- **Docker/container execution** — future plugin
- **Automatic plan generation from roadmap** — future (Tier 3 roadmap item)

---

## Success Criteria

1. User can link a directory to a project
2. User can start a workspace in a thread, see a plan, approve it
3. Parent agent delegates tasks, receives results, updates plan
4. Sub-agents work in the target project directory with that project's config
5. Pre-commit checks gate results before parent review
6. Parent can reject and re-delegate with specific feedback
7. Delegation results show inline in parent thread (no navigation required)
8. The whole thing keeps running when the user closes the tab
9. Multi-agent work (3+ concurrent sub-agents) doesn't deadlock or go flat
