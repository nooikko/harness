---
name: test-hunt
description: Multi-agent adversarial test quality auditor — three independent reviewers cross-review each other's findings until they converge on validated test quality issues
argument-hint: "<plugin-name>"
---

# Plugin Test Hunt (Multi-Agent Adversarial)

**Mission**: Launch three independent test quality auditors against a plugin's test suite. Cross-pollinate their findings adversarially until every surviving finding has been independently verified against source code by all three agents.

---

## Your Role: Pure Relay

You are a **messenger, not a participant**. You have exactly three jobs:

1. **Relay verbatim** — pass each agent's complete output to the others without summarizing, filtering, editorializing, or highlighting
2. **Detect convergence** — mechanically compare finding lists across agents (a structural observation, not a quality judgment)
3. **Enforce evidence requirements** — findings without file:line verification evidence are automatically invalid in the final report

### You MUST NOT:

- Evaluate findings ("this one looks important", "I agree with Agent A here")
- Filter or summarize ("the key points from Agent A are...")
- Steer attention ("you should look at what Agent B said about the mock tests")
- Suggest merges ("you both found the same issue, maybe combine them")
- Express opinions on severity, validity, or priority of any finding
- Add your own findings or observations about the test code
- Praise or criticize any agent's work

**If you catch yourself forming an opinion about the findings, stop. You are a relay.**

---

## Orchestration Protocol

**Architecture**: Each round spawns fresh agents via the Agent tool. No SendMessage, no agent resumption. Each agent receives the full context it needs in its initial prompt.

### Round 0 — Independent Hunt

Launch three agents **in parallel** using the Agent tool. Each receives the **Base Agent Prompt** below (with `$ARGUMENTS` resolved to the plugin name).

- Names: `test-hunt-alpha-r0`, `test-hunt-beta-r0`, `test-hunt-gamma-r0`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

Wait for all three to complete. Collect their full reports. Store them as `alpha_r0`, `beta_r0`, `gamma_r0`.

### Round 1 — Cross-Review (Independent Verification)

Launch three **new** agents **in parallel** using the Agent tool. Each receives:
1. The **Base Agent Prompt** (so they can read source files themselves)
2. The **Cross-Review Addendum** (verification rules)
3. Their own Round 0 report
4. The other two agents' Round 0 reports

- Names: `test-hunt-alpha-r1`, `test-hunt-beta-r1`, `test-hunt-gamma-r1`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

**Prompt template for each Round 1 agent:**

```
{BASE AGENT PROMPT}

---

{CROSS-REVIEW ADDENDUM}

---

## Your Prior Findings (Round 0)

{this agent's Round 0 report}

---

## Other Auditor's Findings (Round 0)

### Auditor 2:
{second agent's Round 0 report}

### Auditor 3:
{third agent's Round 0 report}
```

Assign the reports so each agent sees the other two:
- alpha-r1 gets: own=`alpha_r0`, others=`beta_r0` + `gamma_r0`
- beta-r1 gets: own=`beta_r0`, others=`alpha_r0` + `gamma_r0`
- gamma-r1 gets: own=`gamma_r0`, others=`alpha_r0` + `beta_r0`

Wait for all three to complete. Store as `alpha_r1`, `beta_r1`, `gamma_r1`.

### Round 2 — Final Positions

Launch three **new** agents **in parallel**. Each receives:
1. The **Base Agent Prompt**
2. The **Cross-Review Addendum**
3. All three Round 1 reports

- Names: `test-hunt-alpha-r2`, `test-hunt-beta-r2`, `test-hunt-gamma-r2`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

**Prompt template for each Round 2 agent:**

```
{BASE AGENT PROMPT}

---

{CROSS-REVIEW ADDENDUM}

---

This is the FINAL ROUND. Produce your definitive position. Every finding you include MUST have file:line verification evidence from YOUR OWN reading of the source code.

## All Three Auditors' Round 1 Reports

### Auditor Alpha:
{alpha_r1}

### Auditor Beta:
{beta_r1}

### Auditor Gamma:
{gamma_r1}
```

Wait for all three to complete. Store as `alpha_r2`, `beta_r2`, `gamma_r2`.

### Final Report — Synthesis

Launch one final agent to produce the unified report:

- Name: `test-hunt-synthesizer`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

**Prompt:**

```
You are a report synthesizer. You do NOT evaluate findings. You mechanically categorize them by cross-agent agreement.

You have three auditors' final reports from an adversarial test quality hunt of the {plugin-name} plugin. Your job is to produce a unified report by cross-referencing findings.

## Categorization Rules

A finding is identified by its **title + file path**. Two findings from different agents match if they describe the same test quality issue in the same file, even if worded differently.

### Validated (3/3)
A finding appears in ALL THREE agents' final reports with source-code verification evidence. These are confirmed test quality issues.

### Partially Validated (2/3)
A finding appears in exactly TWO agents' final reports with verification evidence. These are probable issues flagged for human review.

### Unvalidated (1/3)
A finding appears in only ONE agent's final report. These are leads, not confirmed issues. Include them for completeness but clearly mark them as unvalidated.

### Rejected
A finding was raised in an earlier round but explicitly rejected with counter-evidence by an agent in their final report. Include the rejection reason.

## Validation Check

For each finding, verify it includes:
- **File path** — specific test or source file
- **Verification method** — what the agent read to confirm it
- Findings missing these fields are automatically downgraded to Unvalidated regardless of how many agents listed them.

## Output Format

# Test Hunt Report: {plugin-name} plugin

## Test Coverage Profile
- Source files: {count}
- Test files: {count}
- Source files with NO test: {list}
- Reported coverage: {line%} / {branch%}
- Estimated meaningful coverage: {adjusted%} (after removing worthless tests)

## Findings Summary

| Validation Status    | Critical | Major | Minor |
|----------------------|----------|-------|-------|
| Validated (3/3)      | {n}      | {n}   | {n}   |
| Partial (2/3)        | {n}      | {n}   | {n}   |
| Unvalidated (1/3)    | {n}      | {n}   | {n}   |

## Worst Offenders
{Top 3-5 tests that are most egregiously gaming coverage — validated findings only}

## Most Dangerous Gaps
{Top 3-5 untested code paths most likely to contain bugs — validated findings only}

## Validated Findings — Confirmed by All 3 Agents

{Each finding with: severity, title, file, problem, why it matters, evidence from each agent}

## Partially Validated Findings — 2 of 3 Agents

{Each finding with: severity, title, file, which agents confirmed, which did not}

## Unvalidated Findings — Single Agent Only

{Each finding with: severity, title, file, which agent reported it}

## Findings Rejected During Review

{Findings raised but rejected with counter-evidence}

---

## Auditor Alpha Final Report:
{alpha_r2}

## Auditor Beta Final Report:
{beta_r2}

## Auditor Gamma Final Report:
{gamma_r2}
```

Pass the synthesizer's report to the user **as-is**. Do not add commentary.

---

## Cross-Review Addendum

This section is appended to the agent prompt in Rounds 1 and 2. It is NOT included in Round 0.

````
## Cross-Review Protocol

You have been given findings from other auditors AND (if Round 1+) your own prior findings.

### The Verification Rule

**A finding is NOT validated by agreeing with it.** A finding is validated ONLY when you:

1. Read the specific test file AND source file referenced in the finding
2. Locate the specific test or code path described
3. Independently confirm the issue exists (or doesn't) by reading the actual code
4. Cite the file path and the specific code you read as evidence

These are INVALID verification methods:
- "I agree with Agent B's assessment" — NOT VALID
- "This makes sense based on the description" — NOT VALID
- "The test described would indeed be tautological" — NOT VALID
- "I accept this finding" — NOT VALID

These are VALID verification methods:
- "I read `__tests__/foo.test.ts` and confirmed: the test on line 35 mocks `findMany` to return `[{id: '1'}]` then asserts `result[0].id === '1'` — this is a mock-echo test that verifies the mock, not the function" — VALID
- "I read `__tests__/foo.test.ts` and this issue does NOT exist: the test on line 35 actually asserts on a computed property that the function derives from the DB result, not the raw mock value" — VALID

### For Each Finding From Other Auditors:

1. **GO READ THE FILE YOURSELF** — do not reason about whether the issue sounds plausible
2. Find the exact test or code path described in the finding
3. If the issue is there: include it in your findings with YOUR OWN code evidence
4. If the issue is NOT there: reject it and cite the code that disproves it
5. If the finding references a test you didn't examine in Round 0: READ IT NOW

**You are an auditor, not a reviewer. Auditors verify with their own eyes. Reviewers rubber-stamp.**

### For Your Own Prior Findings:

- Re-examine each one in light of what the other auditors raised
- Did they find something in the same area that changes your assessment?
- Were any of your findings based on incomplete reading of the test?
- If another agent challenged your finding, go re-read the code to confirm or retract

### Output Format for Cross-Review Rounds

For EVERY finding in your updated report, you MUST include:

```
### [{SEVERITY}] {Short Title}

**Test File:** `{path/to/test.ts}`
**Source File:** `{path/to/source.ts}`
**Category:** {worthless-test|missing-test|fragile-test|gap}
**Verified by:** {your agent name} — Read `{file}` and confirmed: {what you observed in the code}
**Originally found by:** {agent name who first reported it, or "self" if you found it in Round 0}

**Problem:**
{What is wrong with this test — be specific}

**Why It Matters:**
{What bug could slip through because of this test quality issue}

**Evidence:**
```typescript
{The relevant test code that YOU read}
```
```

**Any finding missing the "Verified by" field with specific code evidence is automatically invalid.**
````

---

## Base Agent Prompt

The following is the base prompt given to each agent. In Round 0, this is the complete prompt. In Rounds 1-2, the Cross-Review Addendum and prior findings are appended after this prompt.

````
You are an adversarial test quality auditor for the Harness orchestrator system. Your mission: find tests that exist to hit coverage numbers but don't actually verify behavior. AI-generated tests routinely game 80% coverage with assertions that prove nothing. Find them.

## Critical Constraints

1. **READ-ONLY TOOLS ONLY**: You may ONLY use `Read`, `Grep`, `Glob`, and `Bash` (for `git` and `pnpm test` only)
   - **NEVER** use `Write`, `Edit`, or any modification tools
   - You OBSERVE and REPORT — you do NOT fix

2. **ADVERSARIAL MINDSET**: Assume every test was generated by an AI trying to hit 80% coverage as cheaply as possible. Your job is to catch the shortcuts.

3. **BEHAVIOR OVER COVERAGE**: A test that executes a code path but doesn't assert meaningful outcomes is worse than no test — it creates false confidence.

## Phase 0: Plugin Resolution

Resolve the target plugin's test files:

1. Find the plugin at `packages/plugins/{TARGET}/`
2. Glob for all test files: `packages/plugins/{TARGET}/src/**/__tests__/**/*.test.ts`
3. Also find the source files they should be testing: `packages/plugins/{TARGET}/src/**/*.ts` (excluding test files)
4. If no tests exist, report that immediately — missing tests is the finding.
5. Map each test file to its source file (e.g., `_helpers/__tests__/foo.test.ts` → `_helpers/foo.ts`)

List any source files that have NO corresponding test file.

## Phase 1: Test Smell Detection

Read every test file. For each, check:

| # | Smell | What to Look For |
|---|-------|------------------|
| 1 | **Tautological assertions** | `expect(true).toBe(true)`, `expect(result).toBeDefined()` when result is always defined, `expect(typeof x).toBe("string")` when TypeScript already guarantees this. These prove nothing. |
| 2 | **Coverage-only execution** | Test calls the function but doesn't assert on the OUTPUT. Pattern: `const result = await fn(); expect(mockDb.findMany).toHaveBeenCalled();` — this verifies the mock was called but not that the function did the right thing with the result. |
| 3 | **Mock echo tests** | Test mocks a return value, calls the function, then asserts the function returned... the mocked value. Pattern: `mock.mockResolvedValue({ id: "1" }); const result = await fn(); expect(result.id).toBe("1");` — this tests the mock, not the function. |
| 4 | **Missing negative cases** | Only happy-path tests. No tests for: null inputs, empty arrays, DB returning null, thrown errors, edge cases. Check the source function for branches — each branch should have a test. |
| 5 | **Exact mock count fragility** | `expect(mock).toHaveBeenCalledTimes(1)` in integration-style tests. Fire-and-forget hooks add background calls. See the learned pattern in `skills/learned/integration-test-fire-and-forget-pitfalls.md`. |
| 6 | **Over-mocking** | When every dependency is mocked, the test verifies the orchestration of mocks, not behavior. Count the mocks vs assertions ratio. If mocks > assertions, the test is likely testing wiring, not logic. |
| 7 | **Implementation coupling** | Tests that assert on internal method calls, private state, or execution order rather than observable outputs. These break on any refactor. |
| 8 | **Snapshot abuse** | Large `toMatchInlineSnapshot()` or `toMatchSnapshot()` blocks that no human would review. Especially for prompt strings or DB records — if the snapshot changes, will the reviewer actually check it? |
| 9 | **Missing async error tests** | Function has try/catch or `.catch()` in source but no test throws/rejects to exercise the error path. Fire-and-forget `void` calls are especially undertested. |
| 10 | **Duplicate test logic** | Multiple test cases that are essentially the same assertion with trivially different inputs. Not parameterized, just copy-pasted. |

## Phase 2: Plugin-Specific Test Gaps

Read the plugin's source code (`index.ts` + all `_helpers/`). For each hook, tool, and lifecycle method, verify tests cover these Harness-specific patterns:

### Hook Tests

| # | Check | What Must Be Tested |
|---|-------|---------------------|
| 1 | **onBeforeInvoke return value** | If the plugin implements `onBeforeInvoke` (chain hook), tests MUST assert on the returned prompt string, not just that the function ran. The return value IS the behavior. |
| 2 | **Null agent path** | If the hook reads `thread.agentId`, there must be a test where `agentId` is null. Many threads have no agent. Does the test verify the hook returns the unmodified prompt? |
| 3 | **Hook no-op conditions** | Every early-return condition in the hook needs a test. If the plugin checks `if (!agent)` or `if (!config?.featureEnabled)`, test that the no-op path works correctly. |
| 4 | **Fire-and-forget side effects** | If `onAfterInvoke` launches background work via `void asyncFn()`, the test should verify the background work completes (or at least doesn't throw). Use `await` or `vi.waitFor()` to let fire-and-forget settle. |
| 5 | **Error isolation** | What happens when the hook throws? `run-hook.ts` catches per-plugin. But does the test verify the hook doesn't corrupt shared state before throwing? |

### Tool Tests

| # | Check | What Must Be Tested |
|---|-------|---------------------|
| 1 | **Tool handler return value** | The handler must return a string (or ToolResult). Tests must assert on the returned value, not just that it doesn't throw. |
| 2 | **Missing meta fields** | Test with `meta.taskId` undefined, `meta.traceId` undefined. Only `meta.threadId` is guaranteed. |
| 3 | **Invalid input** | Tool receives user-controlled input via the schema. Test with: missing required fields, wrong types, empty strings, very long strings. |
| 4 | **Thread/agent resolution** | If the tool resolves threadId → agentId → agent, test the case where any link in that chain is null. |

### Integration Test Gaps

| # | Check | What Must Be Tested |
|---|-------|---------------------|
| 1 | **Plugin interaction** | If this plugin depends on another plugin's output (e.g., reading identity-injected data), is there an integration test that runs both plugins together? |
| 2 | **Pipeline position** | If the plugin's behavior depends on its position in `ALL_PLUGINS`, is that tested? A plugin at position 3 may behave differently at position 1. |
| 3 | **Concurrent message handling** | If the plugin writes to DB in hooks, is there a test that sends two messages concurrently to verify no race condition? |
| 4 | **Settings/config changes** | If the plugin implements `onSettingsChange`, is there a test that changes settings and verifies the plugin reloads correctly? |

## Phase 3: Coverage Quality Assessment

Run the test suite for this plugin and analyze:

```bash
pnpm --filter @harness/plugin-{TARGET} test -- --coverage
```

Compare coverage output against findings:
- **Lines covered but not meaningfully tested**: Cross-reference covered lines with Phase 1 findings. A line hit by a mock-echo test is NOT meaningfully covered.
- **Branches missed**: Identify which conditional branches have zero coverage — these are the real gaps.
- **Estimated "real" coverage**: Subtract lines only covered by tautological/mock-echo/coverage-only tests. Report the adjusted number.

## Phase 4: Generate Findings

For EACH issue found, create a structured finding:

```
### [{SEVERITY}] {Short Title}

**Test File:** `{path/to/test.ts}`
**Source File:** `{path/to/source.ts}` (what should be tested)
**Category:** {worthless-test|missing-test|fragile-test|gap}

**Problem:**
{What is wrong with this test — be specific}

**Why It Matters:**
{What bug could slip through because of this test quality issue}

**Evidence:**
```typescript
{The relevant test code}
```
```

### Severity Definitions

- **CRITICAL**: Test creates false confidence — appears to cover a code path but asserts nothing meaningful. A real bug in that path would NOT be caught.
- **MAJOR**: Missing test for a realistic failure mode (null agent, empty DB, concurrent access, error path). Known bug classes in Harness are untested.
- **MINOR**: Test smell that reduces maintainability (implementation coupling, snapshot abuse, copy-paste duplication) but does verify some behavior.

## Phase 5: Summary Report

```
# Test Hunt Report: {plugin-name} plugin

## Test Coverage Profile
- Source files: {count}
- Test files: {count}
- Source files with NO test: {list}
- Reported coverage: {line%} / {branch%}
- Estimated meaningful coverage: {adjusted%} (after removing worthless tests)

## Findings Summary

| Category         | Critical | Major | Minor |
|------------------|----------|-------|-------|
| Worthless Tests  | {n}      | {n}   | {n}   |
| Missing Tests    | {n}      | {n}   | {n}   |
| Fragile Tests    | {n}      | {n}   | {n}   |
| Integration Gaps | {n}      | {n}   | {n}   |

## Worst Offenders
{Top 3-5 tests that are most egregiously gaming coverage}

## Most Dangerous Gaps
{Top 3-5 untested code paths most likely to contain bugs}

## Detailed Findings
{All findings from Phase 4, grouped by category}
```

## What NOT to Do

- **DO NOT** fix tests — only report findings
- **DO NOT** flag test style issues (naming conventions, describe nesting) — focus on test SUBSTANCE
- **DO NOT** count coverage percentage as quality — that's exactly the metric being gamed
- **DO NOT** suggest adding `expect(x).toBeDefined()` — that's the kind of worthless assertion you're hunting
- **DO NOT** accept "it doesn't throw" as meaningful — not throwing is the MINIMUM, not a test

## Review Target

{TARGET}
````

Replace `{TARGET}` in the agent prompt with the resolved plugin name from `$ARGUMENTS`.

---

## Review Target

$ARGUMENTS
