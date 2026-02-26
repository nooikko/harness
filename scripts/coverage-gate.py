#!/usr/bin/env python3
"""
Pre-commit coverage gate.

Two checks:
1. Barrel file detection — rejects files that are purely re-exports
2. Coverage enforcement — runs vitest related on staged files, enforces 80% line + branch coverage

Usage:
  python3 scripts/coverage-gate.py          # Run both checks on staged files
  python3 scripts/coverage-gate.py --skip-coverage  # Run only barrel detection (for testing)
"""
import json
import os
import re
import subprocess
import sys

# --- Configuration ---
COVERAGE_THRESHOLD = 80  # percent, applies to both lines and branches

EXCLUDED_PATTERNS = [
    r"\.config\.ts$",
    r"\.setup\.ts$",
    r"\.d\.ts$",
    r"\.test\.tsx?$",
    r"\.spec\.tsx?$",
    r"prisma/generated/",
    r"\.next/",
    r"node_modules/",
    r"dist/",
    r"packages/database/src/index\.ts$",  # Prisma singleton — no testable logic
    r"prisma/seed\.ts$",  # Seed script — requires database connection
]

# --- Barrel Detection ---

# Matches lines that are purely re-exports
RE_EXPORT_PATTERN = re.compile(
    r"^\s*export\s+(?:\*|(?:type\s+)?\{[^}]*\})\s+from\s+[\"'][^\"']+[\"'];?\s*$"
)
COMMENT_PATTERN = re.compile(r"^\s*(?://|/\*|\*)")
EMPTY_PATTERN = re.compile(r"^\s*$")


def is_barrel(content: str) -> bool:
    """Check if file content is a pure barrel (only re-exports, no logic)."""
    lines = content.split("\n")
    has_export = False

    for line in lines:
        # Skip empty lines and comments
        if EMPTY_PATTERN.match(line) or COMMENT_PATTERN.match(line):
            continue
        # Skip closing block comments
        if line.strip() == "*/":
            continue
        # Check if it's a re-export
        if RE_EXPORT_PATTERN.match(line):
            has_export = True
            continue
        # Any other non-empty line means it's not a barrel
        return False

    return has_export


def get_staged_files(project_dir: str) -> list[str]:
    """Get list of staged .ts/.tsx files."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "--", "*.ts", "*.tsx"],
        capture_output=True,
        text=True,
        cwd=project_dir,
    )
    if result.returncode != 0:
        return []
    return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]


def check_barrels(staged_files: list[str], project_dir: str) -> list[str]:
    """Check staged files for barrel patterns. Returns list of barrel file paths."""
    barrels = []
    for filepath in staged_files:
        abs_path = os.path.join(project_dir, filepath)
        if not os.path.isfile(abs_path):
            continue
        with open(abs_path, "r") as f:
            content = f.read()
        if is_barrel(content):
            barrels.append(filepath)
    return barrels


# --- Coverage Gate ---

def is_excluded(filepath: str) -> bool:
    """Check if a file should be excluded from coverage checks."""
    for pattern in EXCLUDED_PATTERNS:
        if re.search(pattern, filepath):
            return True
    return False


def get_testable_files(staged_files: list[str]) -> list[str]:
    """Filter staged files to only those that need coverage checks."""
    return [f for f in staged_files if f.endswith((".ts", ".tsx")) and not is_excluded(f)]


MAX_RETRIES = 5  # Node.js ESM race condition is non-deterministic; retry on failure


def detect_projects(testable_files: list[str]) -> list[str]:
    """Detect which vitest projects contain the staged files to scope coverage runs."""
    # Map directory prefixes to vitest project names (from vitest.config.ts)
    project_map = {
        "apps/web/": "dashboard",
        "apps/orchestrator/": "orchestrator",
        "packages/ui/": "ui",
        "packages/logger/": "logger",
        "packages/database/": "database",
        "packages/plugin-contract/": "plugin-contract",
        "packages/plugins/context/": "plugin-context",
        "packages/plugins/discord/": "plugin-discord",
        "packages/plugins/web/": "plugin-web",
        "packages/plugins/delegation/": "plugin-delegation",
        "packages/plugins/metrics/": "plugin-metrics",
    }
    projects: set[str] = set()
    for filepath in testable_files:
        for prefix, project_name in project_map.items():
            if filepath.startswith(prefix):
                projects.add(project_name)
                break
    return sorted(projects)


def run_coverage(testable_files: list[str], project_dir: str) -> dict | None:
    """Run vitest with coverage on files related to the testable files.

    First attempts 'vitest related' to only run relevant tests.
    Falls back to 'vitest --run --coverage' if 'related' mode fails.

    Retries up to MAX_RETRIES times because Node.js ESM loading in
    multi-project vitest workspaces has a non-deterministic race condition
    with vite-tsconfig-paths that causes sporadic startup failures.
    """
    coverage_path = os.path.join(project_dir, "coverage", "coverage-final.json")

    # Scope to only the projects that contain staged files to avoid loading
    # unrelated project configs that may fail in worktree environments
    projects = detect_projects(testable_files)
    project_args = []
    for project in projects:
        project_args.extend(["--project", project])

    # Remove stale coverage data
    if os.path.isfile(coverage_path):
        os.remove(coverage_path)

    # Try vitest related first (faster, only runs relevant tests)
    cmd = [
        "pnpm", "vitest", "related",
        *testable_files,
        "--run",
        "--coverage",
        "--coverage.reporter=json",
        *project_args,
    ]

    subprocess.run(
        cmd,
        timeout=300,
        cwd=project_dir,
    )

    if os.path.isfile(coverage_path):
        with open(coverage_path, "r") as f:
            return json.load(f)

    # Fallback: run full vitest with coverage, with retries for ESM race condition
    fallback_cmd = [
        "pnpm", "vitest",
        "--run",
        "--coverage",
        "--coverage.reporter=json",
        *project_args,
    ]

    for attempt in range(1, MAX_RETRIES + 1):
        print(f"Running full test suite (attempt {attempt}/{MAX_RETRIES})...", file=sys.stderr)

        if os.path.isfile(coverage_path):
            os.remove(coverage_path)

        subprocess.run(
            fallback_cmd,
            timeout=300,
            cwd=project_dir,
        )

        if os.path.isfile(coverage_path):
            with open(coverage_path, "r") as f:
                return json.load(f)

        if attempt < MAX_RETRIES:
            print("ESM race condition detected, retrying...", file=sys.stderr)

    print(f"Warning: coverage file not found after {MAX_RETRIES} attempts at {coverage_path}", file=sys.stderr)
    return None


def check_coverage(coverage_data: dict, testable_files: list[str], project_dir: str) -> list[dict]:
    """Check coverage thresholds for testable files. Returns list of failures."""
    failures = []

    for filepath in testable_files:
        abs_path = os.path.abspath(os.path.join(project_dir, filepath))

        # Find this file in coverage data (keys are absolute paths)
        file_coverage = coverage_data.get(abs_path)
        if file_coverage is None:
            # File not in coverage data — no tests cover it at all
            failures.append({
                "file": filepath,
                "lines": 0,
                "branches": 0,
                "lines_ok": False,
                "branches_ok": False,
            })
            continue

        # Calculate line coverage
        stmt_map = file_coverage.get("s", {})
        total_stmts = len(stmt_map)
        covered_stmts = sum(1 for v in stmt_map.values() if v > 0)
        line_pct = (covered_stmts / total_stmts * 100) if total_stmts > 0 else 100

        # Calculate branch coverage
        branch_map = file_coverage.get("b", {})
        total_branches = sum(len(v) for v in branch_map.values())
        covered_branches = sum(1 for branches in branch_map.values() for v in branches if v > 0)
        branch_pct = (covered_branches / total_branches * 100) if total_branches > 0 else 100

        lines_ok = line_pct >= COVERAGE_THRESHOLD
        branches_ok = branch_pct >= COVERAGE_THRESHOLD

        if not lines_ok or not branches_ok:
            failures.append({
                "file": filepath,
                "lines": round(line_pct),
                "branches": round(branch_pct),
                "lines_ok": lines_ok,
                "branches_ok": branches_ok,
            })

    return failures


# --- Main ---

def main() -> int:
    skip_coverage = "--skip-coverage" in sys.argv
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

    # NOTE: We intentionally do NOT os.chdir(project_dir) here.
    # Node.js ESM loading in multi-project vitest workspaces triggers race
    # conditions when the Python process cwd matches the project root.
    # Instead, we pass project_dir explicitly to functions that need it.

    # Get staged files
    staged_files = get_staged_files(project_dir)
    if not staged_files:
        print("No staged .ts/.tsx files found. Skipping coverage gate.")
        return 0

    # --- Check 1: Barrel detection ---
    barrels = check_barrels(staged_files, project_dir)
    if barrels:
        print("Barrel file detected (re-export only):\n", file=sys.stderr)
        for b in barrels:
            print(f"  {b}", file=sys.stderr)
            print("    Contains only re-exports. Add logic or remove the file.\n", file=sys.stderr)
        print("Barrel files are not allowed. Move exports to their source modules.", file=sys.stderr)
        return 1

    if skip_coverage:
        print("Barrel check passed. Skipping coverage (--skip-coverage).")
        return 0

    # --- Check 2: Coverage gate ---
    testable_files = get_testable_files(staged_files)
    if not testable_files:
        print("No testable staged files after exclusions. Skipping coverage gate.")
        return 0

    print(f"Running coverage check on {len(testable_files)} file(s)...")
    coverage_data = run_coverage(testable_files, project_dir)
    if coverage_data is None:
        print("Could not generate coverage data. Failing as a precaution.", file=sys.stderr)
        return 1

    failures = check_coverage(coverage_data, testable_files, project_dir)
    if failures:
        print(f"\nCoverage check failed for changed files (minimum: {COVERAGE_THRESHOLD}%):\n", file=sys.stderr)
        for f in failures:
            print(f"  {f['file']}", file=sys.stderr)
            line_status = "ok" if f["lines_ok"] else f"need {COVERAGE_THRESHOLD}%"
            branch_status = "ok" if f["branches_ok"] else f"need {COVERAGE_THRESHOLD}%"
            print(f"    Lines:    {f['lines']}% ({line_status})", file=sys.stderr)
            print(f"    Branches: {f['branches']}% ({branch_status})", file=sys.stderr)
            print("", file=sys.stderr)
        print("Add tests for these files before committing.", file=sys.stderr)
        return 1

    print(f"Coverage gate passed. All {len(testable_files)} file(s) meet {COVERAGE_THRESHOLD}% threshold.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
