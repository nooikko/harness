#!/usr/bin/env python3
"""
WorktreeCreate hook: Set up git worktrees for Claude Code.

Replaces default git worktree behavior:
- Creates worktree with branch worktree/<name>
- Runs pnpm install in the new worktree
- Prints absolute worktree path to stdout (required by Claude Code)
"""
import json
import os
import subprocess
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    print("Error: Invalid JSON input", file=sys.stderr)
    sys.exit(1)

worktree_name = input_data.get("name", "")
if not worktree_name:
    print("Error: No worktree name provided", file=sys.stderr)
    sys.exit(1)

project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
worktree_base = os.path.join(project_dir, ".claude", "worktrees")
worktree_path = os.path.join(worktree_base, worktree_name)
branch_name = f"worktree/{worktree_name}"

os.makedirs(worktree_base, exist_ok=True)

# Create git worktree
try:
    subprocess.run(
        ["git", "worktree", "add", "-b", branch_name, worktree_path],
        check=True,
        capture_output=True,
        text=True,
        cwd=project_dir,
    )
except subprocess.CalledProcessError as e:
    # Branch may already exist — try without -b
    try:
        subprocess.run(
            ["git", "worktree", "add", worktree_path, branch_name],
            check=True,
            capture_output=True,
            text=True,
            cwd=project_dir,
        )
    except subprocess.CalledProcessError as e2:
        print(f"Error creating worktree: {e2.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

# Install dependencies
print(f"Installing dependencies in worktree...", file=sys.stderr)
try:
    subprocess.run(
        ["pnpm", "install"],
        check=True,
        capture_output=True,
        text=True,
        cwd=worktree_path,
        timeout=120,
    )
except subprocess.CalledProcessError as e:
    print(f"Warning: pnpm install failed: {e.stderr.strip()}", file=sys.stderr)
except FileNotFoundError:
    print("Warning: pnpm not found — skipping install", file=sys.stderr)
except subprocess.TimeoutExpired:
    print("Warning: pnpm install timed out", file=sys.stderr)

# Print absolute path to stdout (required by Claude Code)
print(os.path.abspath(worktree_path))
sys.exit(0)
