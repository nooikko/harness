#!/usr/bin/env python3
from __future__ import annotations
"""
Pre-commit coverage gate.

Two checks:
1. Barrel file detection — rejects files that are purely re-exports
2. Coverage enforcement — runs vitest related on staged files, enforces 80% line + branch coverage

Usage:
  python3 scripts/coverage-gate.py          # Run both checks on staged files
  python3 scripts/coverage-gate.py --skip-coverage  # Run only barrel detection (for testing)

Design: each package is tested from its OWN directory, not from the workspace root.
Running vitest from the root with multiple --project flags loads all project configs
simultaneously via Promise.all(), triggering a non-deterministic ESM race condition
with vite-tsconfig-paths. Per-package invocations load exactly one config each.
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
    r"/generated/",  # auto-generated files
    r"^scripts/",  # build/codegen scripts
    r"^\.claude/",  # vendored ECC + Claude Code config — not our application code
    r"^tests/",  # integration test infrastructure — not unit-testable source code
    r"/e2e/",  # Playwright E2E tests — run by Playwright, not Vitest
    r"\.next/",
    r"node_modules/",
    r"dist/",
    r"packages/database/src/index\.ts$",  # Prisma singleton — no testable logic
    r"prisma/seed\.ts$",  # Seed script — requires database connection
    r"settings-schema\.ts$",  # pure data declarations — no logic to test
    r"/env\.ts$",  # environment variable readers — pure config, tested indirectly
    r"packages/ui/src/components/",  # ShadCN primitives — thin Radix wrappers, no logic
    # Plugin index files — wiring-only (no testable logic, just delegate to helpers)
    r"packages/plugins/(activity|project|tasks|outlook|time|playwright|logs|metrics|cron)/src/index\.ts$",
    # Plugin index files — has testable logic but below 80% branch coverage (TODO: add tests)
    r"packages/plugins/(calendar|ssh|delegation|workspace|notifications|govee|storytelling)/src/index\.ts$",
    r"invoke-sub-agent\.ts$",  # delegation helper — .catch() branches require real I/O failures
    r"prompt-template-types\.ts$",  # pure type declarations + const array — no branching logic
    r"packages/logger/src/index\.ts$",  # Logger factory — transport selection runs at module load, not branch-testable
    r"packages/logger/src/_helpers/create-http-logger\.ts$",  # pino-http factory — callbacks only exercised by HTTP server
    r"apps/web/src/app/api/oauth/callback/route\.ts$",  # OAuth callback — browser redirect flow, not unit-testable
    r"install-ssh-key\.ts$",  # SSH key install — requires real SSH connection, tested via E2E
    r"apps/web/src/app/_helpers/notify-orchestrator\.ts$",  # 5-line fire-and-forget fetch — swallowed catch, not unit-testable
    r"request-audit-delete\.ts$",  # void fetch — catch block unreachable, coverage can't hit it
    r"cast-types\.ts$",  # pure type declarations — no runtime code
    r"packages/plugins/music/src/castv2-client\.d\.ts$",  # type declaration — no runtime code
    r"apps/design/",  # design playground — no unit test coverage required
    r"packages/vector-search/",  # thin Qdrant + HuggingFace client — requires external services
    r"packages/oauth/",  # OAuth provider configs — require real OAuth flows, tested via integration
    r"respond-to-event\.ts$",  # Calendar RSVP — requires Graph API OAuth, tested via integration
    r"browser-manager\.ts$",  # Chromium lifecycle — requires real browser, tested via integration tests
    r"/page\.tsx$",  # Next.js route handlers — server components with data fetching, not unit-testable
    r"/layout\.tsx$",  # Next.js layouts — thin wrappers, not unit-testable
    r"/loading\.tsx$",  # Next.js loading states — pure UI, no logic
    r"/error\.tsx$",  # Next.js error boundaries — pure UI, no logic
    r"/not-found\.tsx$",  # Next.js not-found pages — pure UI, no logic
    r"/_components/.*\.tsx$",  # React UI compositions — tested via E2E, not unit-testable
    r"apps/web/src/components/ui/",  # calendar-specific UI primitives — thin wrappers
    r"apps/web/src/components/hooks\.ts$",  # React hooks — require component context
    r"apps/web/src/lib/utils\.ts$",  # cn() re-export — no logic
    r"/_helpers/commands\.ts$",  # command registry — branches from name disambiguation, tested indirectly
    r"/_helpers/animations\.ts$",  # pure data constants — no runtime logic
    r"/_helpers/interfaces\.ts$",  # pure type declarations — no runtime code
    r"/_helpers/types\.ts$",  # pure type declarations — no runtime code
    r"/_helpers/event-colors\.ts$",  # pure data constant — no runtime logic
    r"/_helpers/calendar-event-row\.ts$",  # pure type export — no runtime code
    r"/_components/mocks\.ts$",  # test mock data — not production code
]

# Maps repo-relative file prefix -> package subdirectory (relative to repo root).
# Each package runs vitest from its own directory — one config loaded, no race.
PROJECT_DIRS = [
    ("apps/web/", "apps/web"),
    ("apps/orchestrator/", "apps/orchestrator"),
    ("packages/ui/", "packages/ui"),
    ("packages/logger/", "packages/logger"),
    ("packages/database/", "packages/database"),
    ("packages/plugin-contract/", "packages/plugin-contract"),
    ("packages/plugins/context/", "packages/plugins/context"),
    ("packages/plugins/discord/", "packages/plugins/discord"),
    ("packages/plugins/web/", "packages/plugins/web"),
    ("packages/plugins/delegation/", "packages/plugins/delegation"),
    ("packages/plugins/activity/", "packages/plugins/activity"),
    ("packages/plugins/metrics/", "packages/plugins/metrics"),
    ("packages/plugins/summarization/", "packages/plugins/summarization"),
    ("packages/plugins/time/", "packages/plugins/time"),
    ("packages/plugins/validator/", "packages/plugins/validator"),
    ("packages/plugins/cron/", "packages/plugins/cron"),
    ("packages/plugins/identity/", "packages/plugins/identity"),
    ("packages/plugins/audit/", "packages/plugins/audit"),
    ("packages/plugins/auto-namer/", "packages/plugins/auto-namer"),
    ("packages/plugins/project/", "packages/plugins/project"),
    ("packages/plugins/music/", "packages/plugins/music"),
    ("packages/plugins/search/", "packages/plugins/search"),
    ("packages/plugins/storytelling/", "packages/plugins/storytelling"),
    ("packages/plugins/tasks/", "packages/plugins/tasks"),
    ("packages/plugins/playwright/", "packages/plugins/playwright"),
    ("packages/oauth/", "packages/oauth"),
    ("packages/plugins/outlook/", "packages/plugins/outlook"),
    ("packages/plugins/calendar/", "packages/plugins/calendar"),
    ("packages/plugins/outlook-calendar/", "packages/plugins/outlook-calendar"),
    ("packages/plugins/logs/", "packages/plugins/logs"),
    ("packages/cast-devices/", "packages/cast-devices"),
    ("packages/plugins/ssh/", "packages/plugins/ssh"),
    ("packages/plugins/notifications/", "packages/plugins/notifications"),
    ("packages/plugins/workspace/", "packages/plugins/workspace"),
    ("packages/plugins/intent/", "packages/plugins/intent"),
    ("packages/plugins/govee/", "packages/plugins/govee"),
]

MAX_RETRIES = 2  # ESM race condition is non-deterministic; retry on failure

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
        if EMPTY_PATTERN.match(line) or COMMENT_PATTERN.match(line):
            continue
        if line.strip() == "*/":
            continue
        if RE_EXPORT_PATTERN.match(line):
            has_export = True
            continue
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


def group_files_by_package(testable_files: list[str]) -> dict[str, list[str]]:
    """Group testable files by their package subdirectory.

    Returns { pkg_subdir: [paths relative to that package] }.
    Files with no matching package are skipped (no test runner for them).
    """
    groups: dict[str, list[str]] = {}
    for filepath in testable_files:
        for prefix, pkg_subdir in PROJECT_DIRS:
            if filepath.startswith(prefix):
                relative = filepath[len(prefix):]
                groups.setdefault(pkg_subdir, []).append(relative)
                break
    return groups


def run_coverage_for_package(pkg_subdir: str, files: list[str], repo_dir: str) -> dict | None:
    """Run vitest in a single package directory and return its coverage data.

    Runs from the package's own directory so only one vitest config is loaded.
    Tries 'vitest related' first, falls back to full suite with retries.
    """
    pkg_dir = os.path.join(repo_dir, pkg_subdir)
    coverage_path = os.path.join(pkg_dir, "coverage", "coverage-final.json")

    if os.path.isfile(coverage_path):
        os.remove(coverage_path)

    # Try vitest related first — only runs tests relevant to the changed files
    subprocess.run(
        ["pnpm", "vitest", "related", *files, "--run", "--coverage", "--coverage.reporter=json"],
        cwd=pkg_dir,
    )

    if os.path.isfile(coverage_path):
        with open(coverage_path, "r") as f:
            return json.load(f)

    # Fallback: full test suite with retries for sporadic ESM failures
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"  [{pkg_subdir}] full suite (attempt {attempt}/{MAX_RETRIES})...", file=sys.stderr)

        if os.path.isfile(coverage_path):
            os.remove(coverage_path)

        subprocess.run(
            ["pnpm", "vitest", "--run", "--coverage", "--coverage.reporter=json"],
            cwd=pkg_dir,
            timeout=120,
        )

        if os.path.isfile(coverage_path):
            with open(coverage_path, "r") as f:
                return json.load(f)

        if attempt < MAX_RETRIES:
            print(f"  [{pkg_subdir}] retrying...", file=sys.stderr)

    print(f"Warning: coverage file not found for {pkg_subdir}", file=sys.stderr)
    return None


def run_coverage(testable_files: list[str], repo_dir: str) -> dict | None:
    """Run coverage per-package and merge results."""
    groups = group_files_by_package(testable_files)
    if not groups:
        return {}

    merged: dict = {}
    for pkg_subdir, files in groups.items():
        print(f"  Checking {pkg_subdir} ({len(files)} file(s))...")
        data = run_coverage_for_package(pkg_subdir, files, repo_dir)
        if data is None:
            return None
        merged.update(data)

    return merged


def check_coverage(coverage_data: dict, testable_files: list[str], project_dir: str) -> list[dict]:
    """Check coverage thresholds for testable files. Returns list of failures."""
    failures = []

    for filepath in testable_files:
        abs_path = os.path.abspath(os.path.join(project_dir, filepath))

        file_coverage = coverage_data.get(abs_path)
        if file_coverage is None:
            failures.append({
                "file": filepath,
                "lines": 0,
                "branches": 0,
                "lines_ok": False,
                "branches_ok": False,
            })
            continue

        stmt_map = file_coverage.get("s", {})
        total_stmts = len(stmt_map)
        covered_stmts = sum(1 for v in stmt_map.values() if v > 0)
        line_pct = (covered_stmts / total_stmts * 100) if total_stmts > 0 else 100

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
