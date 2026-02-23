#!/usr/bin/env python3
"""Tests for the barrel detection logic in coverage-gate.py."""
import os
import sys

PASS_COUNT = 0
FAIL_COUNT = 0


def assert_eq(label, actual, expected):
    global PASS_COUNT, FAIL_COUNT
    if actual == expected:
        PASS_COUNT += 1
        print(f"  PASS: {label}")
    else:
        FAIL_COUNT += 1
        print(f"  FAIL: {label}")
        print(f"    expected: {expected}")
        print(f"    actual:   {actual}")


def test_is_barrel():
    """Import and test the is_barrel function directly."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    # Python doesn't like hyphens in module names, so use importlib
    import importlib
    mod = importlib.import_module("coverage-gate")
    is_barrel = mod.is_barrel

    # Pure re-export files — should be detected as barrels
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

    # Files with real logic — should NOT be detected as barrels
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


def test_is_excluded():
    """Test the file exclusion logic."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import importlib
    mod = importlib.import_module("coverage-gate")
    is_excluded = mod.is_excluded

    assert_eq("config file excluded", is_excluded("vitest.config.ts"), True)
    assert_eq("d.ts excluded", is_excluded("types/global.d.ts"), True)
    assert_eq("test file excluded", is_excluded("src/foo.test.ts"), True)
    assert_eq("spec file excluded", is_excluded("src/foo.spec.tsx"), True)
    assert_eq("prisma generated excluded", is_excluded("prisma/generated/client.ts"), True)
    assert_eq(".next excluded", is_excluded(".next/types/app.ts"), True)
    assert_eq("normal source not excluded", is_excluded("src/utils.ts"), False)
    assert_eq("component not excluded", is_excluded("src/app/page.tsx"), False)


def test_check_coverage():
    """Test coverage threshold checking with mock Istanbul data."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import importlib
    mod = importlib.import_module("coverage-gate")
    check_coverage = mod.check_coverage

    project_dir = "/fake/project"

    # File with 100% coverage — should pass
    full_coverage = {
        "/fake/project/src/good.ts": {
            "s": {"0": 1, "1": 1, "2": 1, "3": 1, "4": 1},
            "b": {"0": [1, 1], "1": [1, 1]},
        }
    }
    failures = check_coverage(full_coverage, ["src/good.ts"], project_dir)
    assert_eq("100% coverage passes", len(failures), 0)

    # File with 50% line coverage — should fail
    half_coverage = {
        "/fake/project/src/half.ts": {
            "s": {"0": 1, "1": 0, "2": 1, "3": 0},
            "b": {"0": [1, 1]},
        }
    }
    failures = check_coverage(half_coverage, ["src/half.ts"], project_dir)
    assert_eq("50% line coverage fails", len(failures), 1)
    assert_eq("50% line pct reported", failures[0]["lines"], 50)
    assert_eq("50% line not ok", failures[0]["lines_ok"], False)

    # File with good lines but bad branches — should fail
    bad_branches = {
        "/fake/project/src/branchy.ts": {
            "s": {"0": 1, "1": 1, "2": 1, "3": 1, "4": 1},
            "b": {"0": [1, 0], "1": [0, 0], "2": [1, 0]},
        }
    }
    failures = check_coverage(bad_branches, ["src/branchy.ts"], project_dir)
    assert_eq("good lines bad branches fails", len(failures), 1)
    assert_eq("lines ok with bad branches", failures[0]["lines_ok"], True)
    assert_eq("branches not ok", failures[0]["branches_ok"], False)

    # File not in coverage data at all — should fail with 0%
    failures = check_coverage({}, ["src/missing.ts"], project_dir)
    assert_eq("missing file fails", len(failures), 1)
    assert_eq("missing file 0% lines", failures[0]["lines"], 0)
    assert_eq("missing file 0% branches", failures[0]["branches"], 0)

    # File with no branches — should pass (100% by default)
    no_branches = {
        "/fake/project/src/simple.ts": {
            "s": {"0": 1, "1": 1},
            "b": {},
        }
    }
    failures = check_coverage(no_branches, ["src/simple.ts"], project_dir)
    assert_eq("no branches defaults to 100%", len(failures), 0)


if __name__ == "__main__":
    print("Running barrel detection tests...")
    test_is_barrel()
    print("\nRunning exclusion tests...")
    test_is_excluded()
    print("\nRunning coverage check tests...")
    test_check_coverage()
    print(f"\nResults: {PASS_COUNT} passed, {FAIL_COUNT} failed")
    sys.exit(1 if FAIL_COUNT > 0 else 0)
