name: engine
description: Taskmaster-driven execution engine. Reads unblocked tasks, dispatches parallel agents in worktrees, validates, merges, and loops until all tasks are complete.

# Execution Engine

Runs the taskmaster task list by repeatedly: surveying unblocked tasks, dispatching parallel agents in isolated worktrees, and looping until done.

Hooks handle enforcement automatically — validation (pre-commit), formatting (biome), naming (kebab-case), commit messages (conventional), and post-merge checks all fire without the skill or agents needing to know about them.

## Engine Loop

```
while unblocked tasks exist:
  1. SURVEY   → task-master list + task-master next
  2. BATCH    → group parallelizable tasks, present to user
  3. DISPATCH → launch agents in worktrees (Task tool, isolation: "worktree")
  4. REVIEW   → inspect results, merge successes, flag failures
  5. UPDATE   → mark done in taskmaster, loop to step 1
```

## Step 1: SURVEY

```bash
npx task-master list
npx task-master next
```

Find tasks where status = "pending" and all dependencies are "done".

## Step 2: BATCH

Present unblocked tasks to the user with ID, title, and priority.

**Batch rules:**
- Max 3 parallel agents per batch
- High priority first
- Tasks that modify the same files should NOT be in the same batch

Ask user to approve the batch. They may reorder, skip, or adjust.

## Step 3: DISPATCH

For each approved task:

### 3a. Get details and mark in-progress
```bash
npx task-master show <id>
npx task-master set-status --id=<id> --status=in-progress
```

### 3b. Launch agent in worktree

Use `Task` tool with `isolation: "worktree"` and `subagent_type: "general-purpose"`.

**Agent prompt template:**

```
You are implementing a task for the Harness project.

## Task #{id}: {title}

{description}

## Implementation Details

{details}

## Test Strategy

{testStrategy}

## Instructions

- Read CLAUDE.md at the project root for all coding conventions
- Read .taskmaster/docs/prd.md for architecture and design decisions
- Read existing code in the modules you'll touch to match patterns
- Hooks enforce conventions automatically — focus on the implementation
- When done, commit your changes with message: "feat(task-{id}): {short description}"
- The pre-commit hook will validate typecheck/lint/build — fix any failures it reports
```

<HARD-GATE>
Do NOT write code in the agent prompt. Describe WHAT to build, not HOW. The agent reads CLAUDE.md, the PRD, and existing code — it makes its own implementation decisions. If you find yourself writing code snippets, type definitions, or implementation details in the prompt, STOP. That is micromanagement. Pass through the taskmaster description/details verbatim and let the agent work.
</HARD-GATE>

### 3c. Parallel dispatch

Launch all batch agents in a **single message** with multiple Task tool calls.

## Step 4: REVIEW

When agents return:

**Success** (agent committed, worktree has changes):
```bash
git -C <worktree-path> log --oneline main..HEAD
git -C <worktree-path> diff --stat main..HEAD
git merge <branch-name>
```
The post-merge hook automatically validates after merge.

**Failure** (agent couldn't commit or hit errors):
- Read agent output to understand why
- For fixable issues: dispatch a follow-up agent into the same worktree
- For structural issues: report to user, reset task to pending

## Step 5: UPDATE

```bash
# Successful tasks
npx task-master set-status --id=<id> --status=done

# Failed tasks
npx task-master set-status --id=<id> --status=pending
```

Loop back to Step 1. New tasks may be unblocked.

## Stopping Conditions

- All tasks are done or deferred
- User says stop
- A batch fails in a way that blocks all remaining tasks

## Error Recovery

- **Merge conflict**: Pause, ask user to resolve, continue
- **Post-merge validation fails**: Revert merge (`git revert -m 1 HEAD`), mark task pending
- **Dependency cycle**: `npx task-master fix-dependencies`

## Between Sessions

Taskmaster state persists. Run `/engine` next session to pick up where you left off.
