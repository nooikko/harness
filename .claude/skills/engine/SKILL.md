name: engine
description: Taskmaster-driven execution engine. Reads unblocked tasks, dispatches parallel agents in worktrees, validates, merges, and loops until all tasks are complete.

# Execution Engine

Runs the taskmaster task list by repeatedly: surveying unblocked tasks, dispatching parallel agents in isolated worktrees, validating their output, merging successes, and looping until done.

<HARD-GATE>
NEVER skip validation. Every task must pass typecheck, lint, and build before merge. A task that doesn't compile is not done.
</HARD-GATE>

## Engine Loop

```
while unblocked tasks exist:
  1. SURVEY   → read taskmaster, find unblocked tasks
  2. BATCH    → group parallelizable tasks, present to user for approval
  3. DISPATCH → launch agents in worktrees (Task tool, isolation: "worktree")
  4. VALIDATE → each agent runs typecheck + lint + build before completing
  5. REVIEW   → inspect results, merge successes, flag failures
  6. UPDATE   → mark done in taskmaster, loop back to step 1
```

## Step 1: SURVEY

Run these commands to understand current state:

```bash
npx task-master list
npx task-master next
```

Identify all tasks where:
- status = "pending"
- all dependencies are "done" (not pending, not in-progress)

These are the **unblocked** tasks available for this batch.

## Step 2: BATCH

Present unblocked tasks to the user. Group them by what can run in parallel (no shared dependencies between tasks in the same batch).

Show:
- Task ID, title, priority
- Dependencies (all should be done)
- Estimated scope (from task details)

Ask the user: "Ready to dispatch this batch?" They may want to reorder, skip some, or adjust.

**Batch size guidance:**
- Max 3 parallel agents per batch (resource limit)
- Prefer high-priority tasks first
- Tasks that modify the same files should NOT be in the same batch

## Step 3: DISPATCH

For each approved task in the batch:

### 3a. Get full task details
```bash
npx task-master show <id>
```

### 3b. Mark in-progress
```bash
npx task-master set-status --id=<id> --status=in-progress
```

### 3c. Launch agent in worktree

Use the Task tool with `isolation: "worktree"` and `subagent_type: "general-purpose"`.

**Agent prompt template:**

```
You are implementing a task for the Harness project.

## Task #{id}: {title}

{description}

## Implementation Details

{details}

## Test Strategy

{testStrategy}

## Project Conventions

- Read CLAUDE.md at the project root for all coding conventions
- Arrow functions only, no function keyword
- Types co-located with source, never in separate types.ts files
- kebab-case filenames enforced by hook
- Import from module directories, never from _helpers/ directly
- 2-space indent, double quotes, semicolons, trailing commas (ES5)

## Validation Requirements (MANDATORY)

Before you finish, you MUST run ALL of these and they MUST pass:

```bash
pnpm install        # if you added dependencies
pnpm db:generate    # if you modified the Prisma schema
pnpm typecheck      # MUST pass
pnpm lint           # MUST pass
pnpm build          # MUST pass
```

If any validation step fails, fix the issue before completing. Do not complete with failing validation.

## Completion

When done, commit your changes with a descriptive message. The commit message should reference the task: "feat(task-{id}): {short description}"
```

### 3d. Parallel dispatch

Launch all batch agents in a **single message** with multiple Task tool calls. This runs them concurrently.

## Step 4: VALIDATE

When agents return, check each result:

**Success criteria:**
- Agent reports all validation passed (typecheck + lint + build)
- Worktree has commits (changes were made)
- No unresolved errors in agent output

**If an agent fails:**
- Read the agent's output carefully
- Determine if the failure is fixable (typo, missing import) or structural
- For fixable failures: dispatch a follow-up agent into the same worktree to fix
- For structural failures: report to user, mark task as pending again

## Step 5: REVIEW

For each successful worktree:

### 5a. Inspect changes
The Task tool with `isolation: "worktree"` returns the worktree path and branch name. Review what changed:

```bash
git -C <worktree-path> log --oneline main..HEAD
git -C <worktree-path> diff --stat main..HEAD
```

### 5b. Run validation in main context
After merging, re-run validation from the main working directory to catch integration issues:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

### 5c. Merge
If validation passes:
```bash
git merge <branch-name>
```

If there are merge conflicts (e.g., two tasks modified the same file), resolve them before proceeding.

## Step 6: UPDATE

For each successfully merged task:
```bash
npx task-master set-status --id=<id> --status=done
```

For failed tasks:
```bash
npx task-master set-status --id=<id> --status=pending
```
Add context about why it failed so the next attempt knows.

Then **loop back to Step 1**. New tasks may have become unblocked.

## Stopping Conditions

The engine stops when:
- All tasks are done or deferred
- The user says to stop
- A batch fails in a way that blocks all remaining tasks

## Error Recovery

- **Agent timeout**: Mark task pending, retry in next batch
- **Merge conflict**: Pause engine, ask user to resolve, then continue
- **Cascading failure** (build broken after merge): Revert the merge, mark task pending, investigate
- **Dependency cycle**: Run `npx task-master validate-dependencies` and `npx task-master fix-dependencies`

## Between Sessions

At the end of a session, run:
```bash
npx task-master list
```
This shows progress. Next session, the user runs `/engine` again and it picks up where it left off — taskmaster state persists.

## Commit Strategy

- Each task is one commit (or a small series) in its worktree branch
- Merges to main create merge commits for traceability
- After each batch, push to remote if the user wants:
  ```bash
  git push
  ```
