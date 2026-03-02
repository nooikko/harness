# Research: Git Worktree as Agent Workspace Isolation Mechanism

Date: 2026-03-01

## Summary

Git worktrees are a strong but partial isolation solution for concurrent AI agents. They provide complete filesystem-level isolation at the working directory level — each agent's file edits, index state, and HEAD pointer are fully independent. However, they do not solve runtime isolation: database state, TCP ports, environment variables, and process conflicts remain shared problems that require separate solutions. For Harness's use case (5 concurrent chat agents scoping their work to independent directory trees), worktrees are necessary but need augmentation for the runtime dimension.

## Prior Research

No prior AI_RESEARCH files on this topic.

## Current Findings

---

### 1. What Git Worktrees Isolate (Confirmed from Official Docs)

Source: https://git-scm.com/docs/git-worktree

Each linked worktree gets its own:

- **Working directory** — complete copy of the tracked file tree at the checked-out commit. Each agent's file edits are fully independent.
- **Index / staging area** — `git add`, `git commit`, and `git status` all operate independently per worktree.
- **HEAD pointer** — each worktree can be on a different branch or commit without collision.
- **refs/bisect/**, **refs/rewritten/**, **refs/worktree/** — bisect and rebase state are per-worktree.
- **Per-worktree config** — when `extensions.worktreeConfig = true` is set, `$GIT_DIR/worktrees/<id>/config.worktree` holds overrides that don't bleed across worktrees.

Critically for agents: a branch checked out in one worktree **cannot** be checked out in another worktree simultaneously. Git enforces a one-branch-per-worktree rule to prevent race conditions on the branch reference. This is a safety guarantee, not a limitation to work around.

**What is shared across all worktrees:**

- The object database (`.git/objects/`) — all commits, blobs, trees. This is the efficiency win: no duplication of history.
- All `refs/` except the per-worktree namespaces above — so `refs/heads/`, `refs/remotes/`, `refs/tags/` are globally visible.
- Repository configuration in `.git/config` (unless `extensions.worktreeConfig` is enabled).
- Hooks (`.git/hooks/`).
- Remote configuration.

---

### 2. Worktree Isolation Gaps

Sources:
- https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/
- https://developers.openai.com/codex/app/worktrees/

**node_modules / package manager state**

This is the most acute gap for Harness. Each worktree is a fresh directory — `.gitignore`d directories like `node_modules/`, `dist/`, `.next/`, and `.env` do not exist in the new worktree. The agent will try to run code with zero dependencies unless setup runs on creation.

However, pnpm mitigates the disk overhead significantly through its global store + hardlink model. When `pnpm install` runs in a new worktree, pnpm hardlinks packages from the global content-addressable store (`~/.pnpm-store/`) rather than copying them. Packages already in the store cost nearly zero additional disk space. The only real overhead is the symlink structure in `node_modules/.pnpm/` and the workspace package symlinks — which is far smaller than a full npm/yarn install. The constraint is that the global store must be on the same filesystem as the worktree for hardlinks to work; this is satisfied when all worktrees are under `.claude/worktrees/` on the same disk.

Harness's `worktree-setup.py` already handles this correctly by running `pnpm install` immediately after `git worktree add`.

**Database state**

All worktrees share the same PostgreSQL instance and the same `DATABASE_URL`. Two concurrent agents writing to the same `Thread` record, creating `Message` rows in the same thread, or running schema migrations simultaneously will collide. This is a fundamental architectural gap that worktrees cannot address — it requires either:
- Agent-scoped thread isolation by design (each agent works in different threads)
- Separate database schemas per agent
- Optimistic locking / transaction isolation at the application layer

For Harness's specific case (5 chat sessions each on their own `threadId`), database conflicts are unlikely as long as the application correctly scopes DB operations to the thread. The shared DB is not a problem if agents never touch the same rows.

**TCP ports and running processes**

Every dev server defaults to the same port (Next.js: 3000, PostgreSQL: 5432). Worktrees cannot assign different ports automatically. If each agent needs to run a development server, they will collide on port binding. Solutions require explicit port assignment per worktree or using the production/shared database and not running dev servers per-agent.

For Harness orchestrator use (agents that modify code and run tests, not dev servers), this is less acute — the issue only surfaces if agents run `pnpm dev` or start the orchestrator simultaneously.

**Environment variables**

`.env` files are gitignored and do not transfer to new worktrees. Each worktree needs its own `.env` or environment injection. For Harness agents performing code tasks (not running the full app), this is manageable: `pnpm typecheck` and `pnpm test` don't require runtime env vars.

**Shared `.git/config` modifications**

If an agent modifies `.git/config` (e.g., adding a remote, changing core settings), all worktrees see the change immediately. This is a low-risk concern for coding agents but worth noting.

**Submodules**

Official docs note submodule support is incomplete in multiple-worktree scenarios. Harness does not use submodules, so this is not applicable.

---

### 3. Disk Overhead: Worktree vs. Full Clone

Source: https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/

Full clone: duplicates the entire `.git/` object database. For a 500MB repository, 5 clones = ~2.5GB just for history.

Worktree: shares the object database entirely. Five worktrees only duplicate the working tree (tracked files at checkout). For a typical TypeScript monorepo with ~50MB of source files, five worktrees add ~250MB of tracked files plus the `node_modules` symlink structure.

With pnpm's hardlinks: the actual byte cost of five `pnpm install` runs is close to zero for packages already in the global store. The only real cost is the symlink graph (~10-50MB per worktree in pnpm's layout).

Caveat from real-world usage: Cursor users reported 9.82GB consumed in a 20-minute session with a 2GB codebase. The culprit is build artifacts (`.next/`, `dist/`, `build/`) accumulating in each worktree. Adding these to `.gitignore` or configuring agents not to run builds mitigates this.

**Practical estimate for Harness:** 5 worktrees with pnpm install ≈ 5 × (tracked source files ~50MB + pnpm symlinks ~30MB) = ~400MB total overhead, well within normal disk budgets.

---

### 4. Detached HEAD vs. Named Branch for Agent Worktrees

Sources:
- https://git-scm.com/docs/git-worktree
- https://developers.openai.com/codex/app/worktrees/

**Named branch** (`git worktree add -b worktree/<id> <path>`):
- Creates a branch reference that persists in `refs/heads/`
- Can be merged, pushed, PRed against main
- Branch is tied to that worktree; no other worktree can check it out
- Naming convention `worktree/<id>` (Harness current approach) is correct — the `worktree/` prefix namespaces them away from feature branches
- Recommended when the agent's work should be reviewable or mergeable

**Detached HEAD** (`git worktree add --detach <path>` or `git worktree add -d <path>`):
- No branch reference created; HEAD points directly to a commit SHA
- Cannot be accidentally checked out elsewhere
- Commit history is accessible but not tied to any branch name
- Work can still be captured with `git branch <name>` after the fact
- OpenAI Codex uses detached HEAD by default to "prevent branch pollution"
- Recommended for throwaway/exploratory sessions where output may be discarded

**For Harness:** Named branches (`worktree/<name>`) are the right choice. The existing hook creates `worktree/<name>` branches, which:
1. Makes agent work easily reviewable (`git log worktree/<name>`)
2. Enables cherry-pick or merge back to main after review
3. The `worktree/` namespace keeps them visually separated in `git branch -a`
4. The one-branch-per-worktree constraint prevents any ambiguity

---

### 5. Sparse Checkout + Worktrees for Scoped Agent Visibility

Source: https://git-scm.com/docs/git-sparse-checkout

Git supports per-worktree sparse checkout since git 2.41 (mid-2023). Sparse checkout settings are stored in `$GIT_DIR/worktrees/<id>/info/sparse-checkout` when `extensions.worktreeConfig` is enabled. Setting sparse-checkout patterns in one worktree does not affect others.

**Pattern:**
```bash
git worktree add --no-checkout .claude/worktrees/agent-foo worktree/agent-foo
cd .claude/worktrees/agent-foo
git sparse-checkout init --cone
git sparse-checkout set apps/web packages/ui  # scope to specific packages
git checkout
```

This gives an agent a worktree containing only `apps/web` and `packages/ui`, preventing accidental edits to unrelated packages.

**Important caveat:** There is a reported incompatibility with Claude Code's `--worktree` flag and sparse checkouts — Claude Code appears to require a full working tree. For Harness agents running as sub-agents inside the orchestrator (which does not use the `--worktree` flag), sparse checkout is viable. For Claude Code CLI sessions specifically targeting a worktree, full checkout is safer.

---

### 6. Branch Naming Conventions Observed in Production Systems

Synthesized from multiple sources:

| System | Convention | Rationale |
|--------|-----------|-----------|
| Harness (current) | `worktree/<name>` | Namespaced, readable, maps to worktree directory |
| Cursor | `feat-reporting`, `bug-2174` | Short, descriptive, mirrors feature/issue |
| Agent Interviews | `FEATURE_NAME-{i}` | Parallel variants of same feature |
| Nick Mitchinson | `.trees/{task-id}` | Task-ID-based, kept inside repo dir |
| OpenAI Codex | Detached HEAD (no branch) | Throwaway-first; branch created only if needed |

The Harness `worktree/<name>` convention is well-chosen. A refinement would be appending a timestamp or short UUID for uniqueness when names could collide: `worktree/<agentId>-<timestamp>`.

---

### 7. Lifecycle: Create, Use, Merge/Discard, Cleanup

**Create**
```bash
# Named branch (recommended for Harness)
git worktree add -b worktree/<id> .claude/worktrees/<id> [base-commit]

# Detached (OpenAI Codex style — throwaway)
git worktree add -d .claude/worktrees/<id>

# Then: install dependencies
pnpm install --filter '...'
```

**Use**
- Agent's working directory is `.claude/worktrees/<id>/`
- All file operations, commits, and tests are isolated
- Commits accumulate on `worktree/<id>` branch

**Merge/Apply work back**
```bash
# Option A: Merge into main
git checkout main
git merge worktree/<id>

# Option B: Cherry-pick specific commits
git cherry-pick <commit-sha>

# Option C: Apply as patch (OpenAI Codex "Apply" sync)
git diff main...worktree/<id> | git apply
```

**Cleanup**
```bash
# Step 1: Remove worktree (must cd to main repo first)
cd /Users/quinn/dev/harness
git worktree remove .claude/worktrees/<id>

# Step 2: Delete the branch
git branch -d worktree/<id>   # -D if commits were discarded without merge

# Step 3: Prune stale metadata (if directory was deleted manually)
git worktree prune

# Step 4: Remove any .env or leftover artifacts
# (already gone with worktree remove, which removes the directory)
```

**Automatic pruning:** Git's `gc.worktreePruneExpire` config controls when stale administrative files in `.git/worktrees/<id>/` are garbage-collected. Default is 3 months. For agent worktrees that should be ephemeral, set this lower or run `git worktree prune` in the session-end lifecycle.

**OpenAI Codex's production lifecycle policy (from their docs):**
- Protected if conversation is pinned or worktree is in sidebar
- Auto-deleted after 4 days OR when count exceeds 10
- Snapshot taken before deletion for potential restoration

---

### 8. Programmatic Management in Python/Node (Harness-Relevant)

The existing `worktree-setup.py` is well-structured. Here is a complementary teardown pattern:

```python
import subprocess
import os

def remove_worktree(project_dir: str, worktree_name: str, delete_branch: bool = True) -> None:
    worktree_path = os.path.join(project_dir, ".claude", "worktrees", worktree_name)
    branch_name = f"worktree/{worktree_name}"

    # Remove worktree (git removes the directory and .git/worktrees/<id>/)
    subprocess.run(
        ["git", "worktree", "remove", "--force", worktree_path],
        check=True,
        cwd=project_dir,
    )

    # Optionally delete the branch (use -D if work was not merged)
    if delete_branch:
        subprocess.run(
            ["git", "branch", "-D", branch_name],
            cwd=project_dir,
            capture_output=True,  # Don't fail if branch doesn't exist
        )

    # Prune any stale administrative files
    subprocess.run(["git", "worktree", "prune"], check=True, cwd=project_dir)
```

For a session-end hook that cleans up agent worktrees after the Claude Code session completes, this teardown function should be called from a `WorktreeRemove` or session-end lifecycle event.

---

### 9. Can Two Agents in Separate Worktrees Simultaneously Write to node_modules Without Conflict?

**Yes, with pnpm, with caveats.**

Each worktree has its own `node_modules/` directory (it is not shared). When two agents run `pnpm install` simultaneously:

- pnpm uses a global content-addressable store (`~/.pnpm-store/`) with file locking
- Each worktree gets its own symlink graph pointing into that store
- pnpm supports concurrent installs into different directories safely
- The global store uses atomic writes; two concurrent `pnpm install` calls will serialize at the store level if they need to write the same file

**Risk:** If two agents run `pnpm install` at exactly the same moment and both need to add a new package not yet in the store, they may temporarily conflict on the store write. In practice pnpm handles this correctly. The risk is negligible for the Harness case where `pnpm install` is called once at worktree creation, not continuously.

---

### 10. Specific Answers to the Research Questions

**Does a git worktree give each agent a truly isolated filesystem view?**
Yes, for all tracked files. The working directory and index are fully per-worktree. Untracked/gitignored files (node_modules, .env, dist) require explicit setup per worktree.

**What's the disk overhead of a worktree vs. a full clone?**
A worktree shares the object store entirely. Overhead is only the tracked source files (typically 10-100MB for a monorepo) plus pnpm's symlink graph. A full clone duplicates the entire `.git/` object database. Worktrees are 10-50x more disk-efficient than clones for the same isolation level, except when build artifacts accumulate.

**Can two agents in separate worktrees simultaneously write to node_modules without conflict?**
Yes. Each worktree's `node_modules/` is independent. pnpm's global store is concurrent-safe with file locking.

**What's the right branch naming convention for agent workspaces?**
`worktree/<id>` (Harness's current convention) is correct. Refine with `worktree/<agentId>-<unix-timestamp>` for guaranteed uniqueness.

**Is `git worktree add --detach` better than a named branch for agents?**
Named branch is better for Harness because agent work should be reviewable and potentially merged. Detached HEAD is better for truly throwaway sessions (e.g., running a benchmark or bisect). Since Harness agents are creating features and fixing bugs, named branches are appropriate.

---

### 11. Is Worktree Sufficient for Harness, or Does It Need Augmentation?

**Worktrees solve:**
- File collision between concurrent agents (complete)
- Git state collision (complete — one branch per worktree)
- node_modules conflicts (solved by per-worktree install + pnpm hardlinks)
- Index/staging conflicts (complete)

**Worktrees do NOT solve — augmentation needed:**
- **Database isolation**: Harness needs thread-scoped DB operations. If each agent is scoped to a unique `threadId`, the shared PostgreSQL instance is fine — no augmentation needed beyond the existing per-thread scoping in the orchestrator.
- **Port conflicts**: If agents run dev servers, explicit port assignment is needed. For agents that only run tests and typecheck (not `pnpm dev`), no augmentation needed.
- **Environment variables**: `.env` must be copied or symlinked into each worktree at creation time. The `worktree-setup.py` hook should be extended to copy `.env` files from the project root if present.
- **Shared `.git/config` protection**: Low risk; no augmentation needed unless agents are authorized to modify remotes.
- **Cleanup lifecycle**: The current hook creates worktrees but there is no teardown hook. A session-end teardown script is missing from the implementation.

**Verdict:** Worktrees are sufficient for Harness's stated use case (5 concurrent coding agents, each scoped to their own working directory and branch). The two gaps that need addressing are:
1. `.env` file propagation in `worktree-setup.py`
2. A session-end teardown hook for `git worktree remove` + `git branch -D`

The database problem does not require worktree augmentation — it is already handled by Harness's thread-scoped data model.

---

## Key Takeaways

- Worktrees share the `.git` object store and all of `refs/heads/` — they are not sandboxes, they are isolated checkout views of a shared repository.
- The one-branch-per-worktree constraint is a safety feature that prevents race conditions on branch references. It means every agent must be on a unique branch.
- Named branches (`worktree/<id>`) are better than detached HEAD for Harness because work should be reviewable and mergeable.
- pnpm's hardlink store makes `pnpm install` per-worktree disk-efficient — each install costs roughly the size of the symlink graph, not a full package download.
- OpenAI Codex uses detached HEAD by default and auto-cleans worktrees after 4 days or 10 worktrees. This lifecycle policy is worth adopting for Harness.
- Build artifacts (`.next/`, `dist/`) are the primary disk space concern — agents should avoid running full builds unless necessary.
- Sparse checkout + worktrees can scope an agent's view to specific packages, but may conflict with Claude Code CLI's `--worktree` flag; safe for orchestrator sub-agents.

## Sources

- https://git-scm.com/docs/git-worktree (official git documentation)
- https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/ (Upsun DevCenter)
- https://developers.openai.com/codex/app/worktrees/ (OpenAI Codex official docs)
- https://dev.to/arifszn/git-worktrees-the-power-behind-cursors-parallel-agents-19j1 (Cursor implementation analysis)
- https://nx.dev/blog/git-worktrees-ai-agents (Nx Blog)
- https://www.nrmitchi.com/2025/10/using-git-worktrees-for-multi-feature-development-with-ai-agents/ (Practical multi-agent workflow)
- https://docs.agentinterviews.com/blog/parallel-ai-coding-with-gitworktrees/ (Parallel agent patterns)
- https://pnpm.io/motivation (pnpm hardlink/store documentation)
- https://pnpm.io/faq (pnpm FAQ on hardlinks and filesystem)
- https://github.com/orgs/pnpm/discussions/6800 (pnpm hardlink discussion)
- https://git-scm.com/docs/git-sparse-checkout (sparse-checkout docs)
