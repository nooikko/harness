# Pre-Commit Coverage Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce 80% line + branch coverage on changed files and reject barrel re-export files at pre-commit time.

**Architecture:** A Python script (`scripts/coverage-gate.py`) runs two checks in sequence: (1) barrel file detection that instantly rejects pure re-export files, (2) Vitest coverage gate using `--related` to test only files affected by the diff, then parsing coverage JSON to enforce thresholds. Enforced via both Husky pre-commit and Claude Code PreToolUse hook.

**Tech Stack:** Python 3, Vitest 4, @vitest/coverage-v8, Husky

---

### Task 1: Install @vitest/coverage-v8

**Files:**
- Modify: `package.json` (root, line 32)
- Modify: `apps/web/package.json`
- Modify: `apps/orchestrator/package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/logger/package.json`

**Step 1: Install the coverage provider at root and per-package**

Run:
```bash
pnpm add -Dw @vitest/coverage-v8
pnpm --filter web add -D @vitest/coverage-v8
pnpm --filter orchestrator add -D @vitest/coverage-v8
pnpm --filter ui add -D @vitest/coverage-v8
pnpm --filter @harness/logger add -D @vitest/coverage-v8
```

**Step 2: Verify coverage works**

Run:
```bash
pnpm --filter @harness/logger vitest run --coverage
```
Expected: Tests pass and a coverage summary table prints to stdout.

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml apps/web/package.json apps/orchestrator/package.json packages/ui/package.json packages/logger/package.json
git commit -m "chore: install @vitest/coverage-v8 across workspace"
```

---

### Task 2: Add coverage config to all vitest configs

**Files:**
- Modify: `vitest.config.ts` (root, lines 1-12)
- Modify: `apps/web/vitest.config.ts` (lines 1-12)
- Modify: `apps/orchestrator/vitest.config.ts` (lines 1-10)
- Modify: `packages/ui/vitest.config.ts` (lines 1-11)
- Modify: `packages/logger/vitest.config.ts` (lines 1-8)

**Step 1: Update root vitest.config.ts**

Replace full file contents with:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/web",
      "apps/orchestrator",
      "packages/ui",
      "packages/logger",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/*.config.ts",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/prisma/generated/**",
        "**/.next/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
      ],
    },
  },
});
```

**Step 2: Update apps/web/vitest.config.ts**

Replace full file contents with:
```ts
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    name: "web",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
```

**Step 3: Update apps/orchestrator/vitest.config.ts**

Replace full file contents with:
```ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "orchestrator",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
```

**Step 4: Update packages/ui/vitest.config.ts**

Replace full file contents with:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "ui",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
```

**Step 5: Update packages/logger/vitest.config.ts**

Replace full file contents with:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "logger",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
```

**Step 6: Verify coverage runs end-to-end**

Run:
```bash
pnpm vitest run --coverage
```
Expected: All tests pass, coverage summary prints, `coverage/coverage-final.json` is created at root.

**Step 7: Add coverage output to .gitignore**

Check if `coverage/` is already in `.gitignore`. If not, append it:
```bash
echo "coverage/" >> .gitignore
```

**Step 8: Commit**

```bash
git add vitest.config.ts apps/web/vitest.config.ts apps/orchestrator/vitest.config.ts packages/ui/vitest.config.ts packages/logger/vitest.config.ts .gitignore
git commit -m "chore: add coverage config to all vitest configs"
```

---

### Task 3: Refactor packages/ui/src/index.ts from barrel to direct exports

The current file is a pure barrel (`export * from "./utils"`). The barrel detector (Task 5) will reject this. Refactor it to directly export the `cn` function.

**Files:**
- Modify: `packages/ui/src/index.ts` (lines 1-4)
- Test: `packages/ui/src/utils.test.ts` (already exists, verify it still passes)

**Step 1: Rewrite packages/ui/src/index.ts**

Replace full file contents with:
```ts
// Shared UI utilities
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};
```

This moves the `cn` function from `utils.ts` directly into `index.ts` so the file contains actual logic, not just re-exports.

**Step 2: Update the test import**

Modify `packages/ui/src/utils.test.ts` line 2 — change the import from `./utils` to the package root to verify the public API works:
```ts
import { describe, expect, it } from "vitest";
import { cn } from "./index";
```

**Step 3: Delete packages/ui/src/utils.ts**

It is now dead code since its content has been moved to `index.ts`.

**Step 4: Run tests**

Run:
```bash
pnpm --filter ui test
```
Expected: 4 tests pass.

**Step 5: Check if anything else imports from utils.ts directly**

Run:
```bash
grep -r "from.*ui.*utils" apps/ packages/ --include="*.ts" --include="*.tsx" || echo "No direct imports found"
```
Expected: No hits (the `ui` package is imported as `"ui"` which resolves to `src/index.ts`).

**Step 6: Run full typecheck**

Run:
```bash
pnpm typecheck
```
Expected: All packages pass.

**Step 7: Commit**

```bash
git add packages/ui/src/index.ts packages/ui/src/utils.test.ts
git rm packages/ui/src/utils.ts
git commit -m "refactor(ui): inline cn utility, remove barrel re-export"
```

---

### Task 4: Create scripts/coverage-gate.py — barrel detection

Build the coverage gate script in two parts. This task implements the barrel detector.

**Files:**
- Create: `scripts/coverage-gate.py`

**Step 1: Write a test for barrel detection**

Create `scripts/test-coverage-gate.py` — a self-contained test for the barrel detection logic:

```python
#!/usr/bin/env python3
"""Tests for the barrel detection logic in coverage-gate.py."""
import subprocess
import sys
import tempfile
import os

PASS = 0
FAIL = 0


def assert_eq(label, actual, expected):
    global PASS, FAIL
    if actual == expected:
        PASS += 1
        print(f"  PASS: {label}")
    else:
        FAIL += 1
        print(f"  FAIL: {label}")
        print(f"    expected: {expected}")
        print(f"    actual:   {actual}")


def test_is_barrel():
    """Import and test the is_barrel function directly."""
    # Add scripts dir to path so we can import
    sys.path.insert(0, os.path.dirname(__file__))
    from importlib import import_module
    mod = import_module("coverage-gate")
    is_barrel = mod.is_barrel

    # Pure re-export files
    assert_eq("export star is barrel", is_barrel('export * from "./utils";\n'), True)
    assert_eq("export star no semicolon", is_barrel('export * from "./utils"\n'), True)
    assert_eq("named re-export is barrel", is_barrel('export { foo } from "./bar";\n'), True)
    assert_eq("type re-export is barrel", is_barrel('export type { Foo } from "./bar";\n'), True)
    assert_eq("multiple re-exports is barrel", is_barrel(
        'export * from "./a";\nexport * from "./b";\n'
    ), True)
    assert_eq("re-export with comments is barrel", is_barrel(
        '// Re-exports\nexport * from "./utils";\n'
    ), True)

    # Files with real logic
    assert_eq("function is not barrel", is_barrel(
        'export const foo = () => 42;\n'
    ), False)
    assert_eq("mixed export and logic is not barrel", is_barrel(
        'export * from "./a";\nexport const foo = 42;\n'
    ), False)
    assert_eq("import + logic is not barrel", is_barrel(
        'import { x } from "./y";\nexport const z = x + 1;\n'
    ), False)
    assert_eq("empty file is not barrel", is_barrel(""), False)
    assert_eq("only comments is not barrel", is_barrel("// just a comment\n"), False)


if __name__ == "__main__":
    print("Running barrel detection tests...")
    test_is_barrel()
    print(f"\nResults: {PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL > 0 else 0)
```

**Step 2: Run the test — it should fail (module not found)**

Run:
```bash
python3 scripts/test-coverage-gate.py
```
Expected: FAIL — `coverage-gate` module doesn't exist yet.

**Step 3: Create scripts/coverage-gate.py with barrel detection**

```python
#!/usr/bin/env python3
"""
Pre-commit coverage gate.

Two checks:
1. Barrel file detection — rejects files that are purely re-exports
2. Coverage enforcement — runs vitest --related on staged files, enforces 80% line + branch coverage

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
    r"\.d\.ts$",
    r"\.test\.tsx?$",
    r"\.spec\.tsx?$",
    r"prisma/generated/",
    r"\.next/",
    r"node_modules/",
    r"dist/",
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


def get_staged_files() -> list[str]:
    """Get list of staged .ts/.tsx files."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "--", "*.ts", "*.tsx"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]


def check_barrels(staged_files: list[str]) -> list[str]:
    """Check staged files for barrel patterns. Returns list of barrel file paths."""
    barrels = []
    for filepath in staged_files:
        if not os.path.isfile(filepath):
            continue
        with open(filepath, "r") as f:
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


def run_coverage(testable_files: list[str], project_dir: str) -> dict | None:
    """Run vitest with coverage on files related to the testable files."""
    cmd = [
        "pnpm", "vitest", "run",
        "--coverage",
        "--reporter=json",
        "--coverage.reporter=json",
    ]
    for f in testable_files:
        cmd.extend(["--related", f])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300,
        cwd=project_dir,
    )

    # Find coverage JSON file
    coverage_path = os.path.join(project_dir, "coverage", "coverage-final.json")
    if not os.path.isfile(coverage_path):
        print(f"Warning: coverage file not found at {coverage_path}", file=sys.stderr)
        print(f"vitest stdout: {result.stdout[:500]}", file=sys.stderr)
        print(f"vitest stderr: {result.stderr[:500]}", file=sys.stderr)
        return None

    with open(coverage_path, "r") as f:
        return json.load(f)


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
    os.chdir(project_dir)

    # Get staged files
    staged_files = get_staged_files()
    if not staged_files:
        print("No staged .ts/.tsx files found. Skipping coverage gate.")
        return 0

    # --- Check 1: Barrel detection ---
    barrels = check_barrels(staged_files)
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
```

**Step 4: Run the barrel detection tests**

Run:
```bash
python3 scripts/test-coverage-gate.py
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add scripts/coverage-gate.py scripts/test-coverage-gate.py
git commit -m "feat: add coverage-gate script with barrel detection and coverage enforcement"
```

---

### Task 5: Add test:coverage-gate script and update Husky pre-commit

**Files:**
- Modify: `package.json` (root, line 18 — add script after `test:watch`)
- Modify: `.husky/pre-commit` (line 3 — replace `pnpm test`)

**Step 1: Add test:coverage-gate script to root package.json**

In `package.json`, add after the `"test:watch"` line:
```json
    "test:coverage-gate": "python3 scripts/coverage-gate.py",
```

**Step 2: Update .husky/pre-commit**

Replace full file contents with:
```
pnpm lint-staged
pnpm sherif
pnpm test:coverage-gate
```

**Step 3: Verify the script runs**

Run:
```bash
pnpm test:coverage-gate --skip-coverage
```
Expected: "No staged .ts/.tsx files found. Skipping coverage gate." (because nothing is staged right now).

**Step 4: Commit**

```bash
git add package.json .husky/pre-commit
git commit -m "chore: wire coverage-gate into husky pre-commit"
```

---

### Task 6: Update Claude Code PreToolUse hook

**Files:**
- Modify: `.claude/hooks/pre-commit-validate.py` (line 38-42 — add coverage-gate to checks)

**Step 1: Add coverage-gate to the checks list**

In `.claude/hooks/pre-commit-validate.py`, modify the `checks` list at line 38 to add the coverage gate check:

```python
checks = [
    ("typecheck", ["pnpm", "typecheck"]),
    ("lint", ["pnpm", "lint"]),
    ("build", ["pnpm", "build"]),
    ("coverage-gate", ["pnpm", "test:coverage-gate"]),
]
```

The `timeout=120` per-check in the loop (line 52) is sufficient for the coverage gate since vitest `--related` is fast.

**Step 2: Commit**

```bash
git add .claude/hooks/pre-commit-validate.py
git commit -m "chore: add coverage-gate to Claude Code pre-commit validation"
```

---

### Task 7: End-to-end integration test

Verify the full pipeline works in a realistic scenario.

**Step 1: Stage a file and run the coverage gate**

```bash
# Make a trivial change to a tested file
echo "" >> packages/logger/src/index.ts
git add packages/logger/src/index.ts
pnpm test:coverage-gate
```
Expected: Coverage gate passes (logger has good coverage from its tests).

**Step 2: Test barrel detection**

Create a temporary barrel file to verify detection works:
```bash
echo 'export * from "./index";' > /tmp/test-barrel.ts
# Copy it into the repo temporarily
cp /tmp/test-barrel.ts packages/logger/src/barrel-test.ts
git add packages/logger/src/barrel-test.ts
pnpm test:coverage-gate
```
Expected: Fails with "Barrel file detected (re-export only)".

Clean up:
```bash
git reset HEAD packages/logger/src/barrel-test.ts
rm packages/logger/src/barrel-test.ts
```

**Step 3: Test coverage failure**

Create a file with no tests:
```bash
cat > packages/logger/src/untested.ts << 'EOF'
export const untested = (x: number): number => {
  if (x > 0) {
    return x * 2;
  }
  return x;
};
EOF
git add packages/logger/src/untested.ts
pnpm test:coverage-gate
```
Expected: Fails with coverage below 80% for `untested.ts`.

Clean up:
```bash
git reset HEAD packages/logger/src/untested.ts
rm packages/logger/src/untested.ts
```

**Step 4: Unstage everything and run full CI**

```bash
git reset HEAD .
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```
Expected: All pass clean.

**Step 5: Commit (no code changes — this is a verification step only)**

No commit needed. All integration tests are manual verification.

---

### Task 8: Update CLAUDE.md with coverage gate documentation

**Files:**
- Modify: `CLAUDE.md` (add coverage gate section under Git Hooks)

**Step 1: Add coverage gate docs**

In `CLAUDE.md`, under the `## Git Hooks` section, add after the existing pre-commit hooks list:

```markdown
### Coverage Gate

Pre-commit runs `pnpm test:coverage-gate` which enforces:
- **No barrel files** — files that only contain re-exports (`export * from`) are rejected
- **80% line + branch coverage** — on staged `.ts/.tsx` files and their dependencies

Excluded from coverage: `*.config.ts`, `*.d.ts`, `*.test.ts`, `*.spec.ts`, generated files.

To run manually: `pnpm test:coverage-gate`
To skip coverage and only check barrels: `pnpm test:coverage-gate --skip-coverage`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add coverage gate section to CLAUDE.md"
```
