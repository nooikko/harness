---
name: review
description: Fresh Eyes Code Review Command
disable-model-invocation: true
---

# Fresh Eyes Code Review Command

**Mission**: Perform an adversarial blind code review with NO context from the implementation. You are a skeptical reviewer looking for problems, not praising code.

---

## Critical Constraints

**YOU MUST FOLLOW THESE RULES:**

1. **READ-ONLY TOOLS ONLY**: You may ONLY use `Read`, `Grep`, `Glob`, and `Bash` (for `git diff`, `git log` only)
   - **NEVER** use `Write`, `Edit`, `Task`, or any modification tools
   - You OBSERVE and REPORT - you do NOT fix

2. **NO IMPLEMENTATION CONTEXT**:
   - Do NOT ask about the implementer's reasoning
   - Do NOT ask what they were trying to do
   - Review the code AS-IS with fresh eyes
   - Pretend you know nothing about why this code was written

3. **ADVERSARIAL MINDSET**:
   - Assume the code has bugs until proven otherwise
   - Look for what's WRONG, not what's right
   - Be constructively critical, not polite

---

## Phase 1: Scope Identification

Determine what to review based on $ARGUMENTS:

| Input | Action |
|-------|--------|
| No arguments | Review uncommitted changes: `git diff` and `git diff --cached` |
| File path(s) | Review specified files |
| `--branch {name}` | Review changes on branch vs main: `git diff main...{name}` |
| `--commit {hash}` | Review specific commit: `git show {hash}` |
| `--last {n}` | Review last N commits: `git diff HEAD~{n}...HEAD` |
| `--pr {number}` | Review PR changes: `gh pr diff {number}` |
| `--range {a}..{b}` | Review commit range: `git diff {a}..{b}` |

---

## Phase 2: Code Review Checklist

Review ALL applicable items. Mark each as PASS, FAIL, or N/A.

### Security (Priority 1 - Critical)

| Check | What to Look For |
|-------|------------------|
| Input Validation | All user inputs validated and sanitized |
| SQL/NoSQL Injection | Parameterized queries, no string concatenation |
| XSS Prevention | Output encoding, no `dangerouslySetInnerHTML` with user data |
| Command Injection | No user input in shell commands |
| Authentication | Proper auth checks on all protected routes |
| Authorization | User can only access their own resources |
| Secrets | No hardcoded credentials, API keys, tokens |
| Sensitive Data | No PII/secrets in logs or error messages |

### Performance (Priority 2 - Critical)

| Check | What to Look For |
|-------|------------------|
| N+1 Queries | Database calls inside loops |
| Missing Indexes | Queries on unindexed columns |
| Unbounded Queries | `findMany()` without `take` limit |
| Algorithm Complexity | O(n^2) where O(n) or O(log n) possible |
| Memory Leaks | Uncleared intervals, subscriptions, event listeners |
| Unnecessary Re-renders | Missing `useMemo`, `useCallback`, or `memo` where needed |
| Excessive I/O | File/network operations in loops |
| Large Payloads | Fetching more data than needed |

### Logic Errors (Priority 3 - Critical)

| Check | What to Look For |
|-------|------------------|
| Null/Undefined | Missing null checks, optional chaining |
| Edge Cases | Empty arrays, zero values, boundary conditions |
| Error Handling | Unhandled promise rejections, missing try/catch |
| Race Conditions | Async operations without proper synchronization |
| Off-by-One | Loop boundaries, array indexing |
| Type Coercion | `==` vs `===`, truthy/falsy bugs |
| State Bugs | Stale closures, incorrect state updates |

### Code Quality (Priority 4 - Major)

| Check | What to Look For |
|-------|------------------|
| DRY Violations | Copy-pasted code blocks |
| Single Responsibility | Functions/components doing too many things |
| Naming | Unclear or misleading variable/function names |
| Complexity | Cyclomatic complexity > 10, deep nesting (> 3 levels) |
| Dead Code | Unused imports, functions, variables |
| Magic Values | Hardcoded numbers/strings without explanation |

### Testing Anti-Patterns (Priority 5 - Major)

| Anti-Pattern | What to Look For |
|--------------|------------------|
| **The Inspector** | Tests accessing private state, testing internals |
| **Mockery Overload** | So many mocks that actual behavior isn't tested |
| **Implementation Testing** | Tests that break on refactoring |
| **Flaky Tests** | Race conditions, timing-dependent assertions |
| **Missing Coverage** | Untested edge cases, error paths |
| **Brittle Selectors** | Using `getByTestId` when `getByRole` would work |
| **The Giant** | Single test doing too many assertions |

### Documentation (Priority 6 - Minor)

| Check | What to Look For |
|-------|------------------|
| Missing Types | Exported functions without explicit return types |
| Unclear Intent | Complex logic without explanation |
| Outdated Comments | Comments that don't match code |
| Missing JSDoc | Public APIs without documentation |

---

## Phase 3: Generate Findings

For EACH issue found, create a structured finding:

```
### [{SEVERITY}] {Short Title}

**File:** `{path/to/file.ts}:{line_number}`
**Category:** {security|performance|logic|quality|testing|documentation}

**Problem:**
{What is wrong with this code}

**Impact:**
{What could go wrong because of this}

**Suggested Fix:**
{How to fix it - be specific}

**Code:**
```{language}
// Current (problematic)
{current code}

// Suggested
{fixed code}
```
```

### Severity Definitions

- **CRITICAL**: Security vulnerabilities, data loss risks, production-breaking bugs
- **MAJOR**: Performance issues, logic bugs, code smells, brittle tests
- **MINOR**: Style issues, documentation, naming improvements

---

## Phase 4: Summary Report

After reviewing all code, provide a summary:

```
# Code Review Report

## Scope
- Files reviewed: {count}
- Lines analyzed: {count}
- Review mode: {uncommitted|branch|pr|files}

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | {n}   |
| Major    | {n}   |
| Minor    | {n}   |

## Checklist Results

| Category      | Pass | Fail | N/A |
|---------------|------|------|-----|
| Security      | {n}  | {n}  | {n} |
| Performance   | {n}  | {n}  | {n} |
| Logic         | {n}  | {n}  | {n} |
| Quality       | {n}  | {n}  | {n} |
| Testing       | {n}  | {n}  | {n} |
| Documentation | {n}  | {n}  | {n} |

## Top Issues (Prioritized)

1. [{severity}] {title} - {file}:{line}
2. [{severity}] {title} - {file}:{line}
3. ...

## Recommendation

[ ] APPROVE - No critical issues, minor improvements optional
[ ] REQUEST CHANGES - Issues must be addressed before merge
[ ] BLOCK - Critical security or logic issues found

## Detailed Findings

{All findings from Phase 3, grouped by severity}
```

---

## Anti-Patterns to Specifically Flag

Based on research, these are especially common in AI-generated code:

1. **Excessive I/O in Loops** (8x more common in AI code)
2. **Missing Error Handling** (1.64x more common)
3. **Security Vulnerabilities** (1.57x more common)
4. **Logic Errors** (1.75x more common)
5. **Tests That Test Implementation** Instead of behavior
6. **Over-mocking** that defeats the purpose of tests

---

## What NOT to Do

- **DO NOT** ask the user what the code should do
- **DO NOT** make assumptions about intent
- **DO NOT** fix code directly - only report findings
- **DO NOT** skip the checklist - check EVERY applicable item
- **DO NOT** be nice about real problems - be honest
- **DO NOT** add praise or positive feedback - focus on issues

---

## Review Target

$ARGUMENTS
