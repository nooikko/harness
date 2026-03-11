---
name: do
description: Smart orchestrator for complex development tasks. Use when the user wants to implement features, fix bugs, or perform multi-step development work. Understands the codebase before classifying, uses task-specific investigation, and routes complex work to superpowers skills.
argument-hint: "<task description>"
user-invocable: true
disable-model-invocation: false
---

# Smart Orchestrator

You are the orchestrator for development tasks. Your job: understand before classifying, classify before investigating, and delegate with thoroughness baked into the prompt.

**Core Principles:**

1. **Understand Before Classifying** — Never assess complexity until you have mapped the affected code, dependencies, tests, and history.
2. **Task-Type Routing** — Route by what the task IS (bug, feature, refactor), not what technology it touches.
3. **Thoroughness In The Template** — Every delegation includes explicit step-by-step instructions. Never rely on Claude's judgment about how deep to go.
4. **Proportional Verification** — Run affected tests for trivial changes, targeted type-checking for moderate ones. No unconditional full builds.
5. **Superpowers For Complexity** — Complex tasks route to the superpowers skill chain. Do not reimplement what already exists.

---

## PHASE 1: UNDERSTAND

Dispatch 1-2 Explore agents with the recon template below. For narrow/specific tasks (e.g., "fix the typo in X"), use thoroughness "quick." For vague/broad tasks (e.g., "make the auth system more robust"), use thoroughness "very thorough."

### Explore Agent Recon Template

```
You are mapping the landscape around a task. Do NOT try to solve anything.
Do NOT diagnose problems or propose solutions. Reconnaissance only.

Task description: $ARGUMENTS

Your job:

1. LOCATE — Find the code/files the user is referring to. Search broadly:
   filenames, function names, error messages, UI text. If the task
   description is vague, search multiple interpretations.

2. UNDERSTAND INTENT — Read the surrounding code and figure out what
   it was MEANT to do. Check comments, docstrings, commit messages,
   caller expectations, design docs, PR descriptions. Distinguish
   between "what the code does" and "what the code was supposed to do."

3. MAP INTERACTIONS — For each file involved, identify: downstream
   consumers (who calls this?), upstream dependencies (what does this
   call?), shared state (database, context, global stores), API
   boundaries (does this cross a package/service boundary?).

4. IDENTIFY TECH STACK — Read the actual code in the affected area.
   Note frameworks, libraries, patterns, and conventions used HERE,
   not what the project uses in general. A monorepo may use different
   stacks in different areas.

5. FIND ALL TESTS — Search for tests related to affected code:
   - Unit tests in __tests__/ folders adjacent to source
   - Integration tests that may live in separate directories
   - E2e tests (Playwright, Cypress) that exercise affected flows
   - Test infrastructure: MSW handlers, test containers, fixtures,
     factories, seed data
   - Note: absence of tests is itself an important finding

6. CHECK HISTORY — Look at recent git activity on affected files.
   Was this area recently changed? Is there an open PR touching it?
   Are there related issues or TODOs in the code?

Report back with:
- Files involved (with paths)
- Original intent of the code (what it was supposed to do)
- Tech stack in the affected area (what you actually found, not assumed)
- Test coverage (what exists, what's missing, where tests live)
- Dependencies (upstream and downstream)
- Complexity signals (how many files, cross-boundary?, shared state?)
```

**SYNCHRONIZATION POINT**: Wait for all Explore agents to return before proceeding to Phase 2.

---

## PHASE 2: CLASSIFY

Based on what the Understand phase FOUND (not what the user asked for), classify the task along two dimensions.

### Task Type

| Signal | Type |
|--------|------|
| Wrong behavior, error, regression | **Bug** |
| New capability, UI, endpoint, integration | **Feature** |
| Restructure, rename, consolidate, optimize | **Refactor** |
| "How does X work", "What's the best way to" | **Research** |
| Config change, dependency update, cleanup | **Chore** |

### Complexity

| Signal | Level |
|--------|-------|
| Single-line change, correct value stated in request, no test implications | **Trivial** |
| 1-5 files, single package, existing test coverage, no API boundary crossings | **Moderate** |
| ANY of: 5+ files, crosses package boundaries, needs new tests, architectural decision required | **Complex** |

Classify as the highest matching level. A task is complex if it exhibits ANY complex signal.

### Adversarial Challenger (Trivial Only)

When you classify a task as **trivial**, dispatch a challenger agent before proceeding. Use the Explore agent with this prompt:

```
The orchestrator classified this task as TRIVIAL. Here is the Understand report:

$UNDERSTAND_REPORT

Your job: argue why this might be harder than "trivial." Consider:
- Could this change break downstream consumers?
- Are there edge cases the orchestrator missed?
- Is the "obvious fix" actually obvious, or does it mask a deeper issue?
- Would this benefit from a test even if one doesn't exist?

If you genuinely agree it's trivial, say so. Don't manufacture complexity.
But if there's a real reason to upgrade, state it with evidence.
```

**Rules:**
- If the challenger upgrades the classification, reclassify to **moderate** and proceed with moderate routing.
- If the challenger agrees it is trivial, proceed as trivial.

---

## PHASE 3: INVESTIGATE & EXECUTE

Route based on the classification from Phase 2. Rows are evaluated top-to-bottom; the first match wins.

**Variable substitution:** In all templates below, replace `$UNDERSTAND_REPORT` with the synthesized output from Phase 1 Explore agents before dispatching.

### Routing Table

| Type + Complexity | Route |
|-------------------|-------|
| Any trivial | Handle directly: make the change, run affected tests |
| Bug (moderate) | Bug investigation template, then implement and verify |
| Feature (moderate) | Feature investigation template, then implement and verify |
| Refactor (moderate) | Refactor investigation template, then implement and verify |
| Chore (moderate) | Handle directly with verification |
| Research (any) | Invoke `/research` skill |
| Any complex | Invoke superpowers chain |

---

### Bug Investigation Template

Dispatch an Explore agent with this template before implementing:

```
You are investigating a bug. Do NOT fix anything yet.

Context from Understand phase:
$UNDERSTAND_REPORT

Your investigation:

1. REPRODUCE — Identify the exact code path that produces wrong behavior.
   Trace from entry point to the point where behavior diverges from intent.

2. ROOT CAUSE — Trace backward from the symptom. Don't stop at the first
   wrong-looking thing. Ask: "Why is THIS wrong?" recursively until you
   reach the actual cause. The first thing that looks wrong is often a
   symptom, not the cause.

3. CORRECT BEHAVIOR — Using the original intent from the Understand
   report, define what correct behavior looks like. Be specific:
   what inputs, what outputs, what side effects.

4. DOWNSTREAM EFFECTS — If we fix the root cause, what else changes?
   Are there callers relying on the buggy behavior? Would fixing this
   break something else?

5. TEST PLAN — What tests would verify the fix AND prevent regression?
   Do any existing tests need updating?

Report: root cause, correct behavior, downstream effects, test plan.
Do NOT write code yet.
```

### Feature Investigation Template

Dispatch an Explore agent with this template before implementing:

```
You are investigating how to implement a feature. Do NOT write code yet.

Context from Understand phase:
$UNDERSTAND_REPORT

Your investigation:

1. EXISTING PATTERNS — Find the closest analog in the codebase.
   How was a similar feature built? What patterns, utilities, and
   conventions does this area of the code use?

2. INTEGRATION POINTS — What existing interfaces, types, or APIs
   need to change? What new ones are needed? Map the contract
   between this feature and its consumers.

3. APPROACH — Propose 2-3 implementation approaches that follow
   existing patterns. For each: trade-offs, effort, risk.

4. EDGE CASES — Empty states, error conditions, auth boundaries,
   concurrency, mobile/desktop differences, accessibility.

5. TEST PLAN — What tests verify the feature works? What tests
   verify it doesn't break existing functionality?

Report: recommended approach, integration points, edge cases, test plan.
Do NOT write code yet.
```

### Refactor Investigation Template

Dispatch an Explore agent with this template before implementing:

```
You are investigating a refactoring task. Do NOT change code yet.

Context from Understand phase:
$UNDERSTAND_REPORT

Your investigation:

1. CURRENT CONSUMERS — Map every caller of the code being changed.
   Miss one and you'll break something silently.

2. CURRENT BEHAVIOR — Document the existing contract: inputs, outputs,
   side effects, error conditions. This is what must be preserved
   (unless the refactor intentionally changes it).

3. TARGET STATE — What does the code look like after refactoring?
   How specifically does the new structure improve on the old?

4. MIGRATION PATH — Can we change incrementally (preferred) or does
   it require a big-bang change? If incremental, what's the sequence?

5. VERIFICATION — Do tests exist that cover the current behavior?
   If not, they must be written BEFORE refactoring begins.

Report: consumer map, current contract, target state, migration plan,
test coverage assessment. Do NOT change code yet.
```

---

### Implementation Delegation

After investigation completes, delegate implementation based on complexity:

**Moderate tasks:** Dispatch an implementer agent. Select the agent based on what the Understand phase FOUND in the affected code:

| Affected Code Contains | Agent |
|------------------------|-------|
| Next.js pages, routes, Server Components, Server Actions | nextjs-expert |
| Type definitions, generics, type safety issues | typescript-expert |
| Test-only changes (new tests, fixing tests) | unit-test-maintainer |
| Everything else | general-purpose |

Provide the investigation report as context. The implementer agent should:
1. Implement the changes following the investigation's recommended approach
2. Write or update tests per the investigation's test plan
3. Self-review the changes before reporting back

**Complex tasks:** Invoke the superpowers chain via the Skill tool in sequence:
1. `brainstorming` — explore solution space
2. `writing-plans` — create detailed implementation plan
3. `subagent-driven-development` — execute the plan with coordinated agents
4. `finishing-a-development-branch` — polish, verify, prepare for merge

**Research tasks:** Invoke the `/research` skill via the Skill tool, passing the task description.

---

## PHASE 4: VERIFY

Verification is proportional to what was done. No unconditional full-project builds.

| Complexity | Verification |
|------------|-------------|
| Trivial | Run affected test files only |
| Moderate | Run affected tests + `tsc --noEmit` on changed packages |
| Complex | Handled by superpowers chain (verification-before-completion skill) |

**Retry policy:** If verification fails, fix the issue and retry. Maximum 2 retry loops. After 2 failures, report findings to the user with what failed and what was attempted rather than continuing to loop.

**Completion summary:** After verification passes, report to the user:
- What was accomplished (task type and what changed)
- Files created or modified
- Tests added or updated
- Any follow-up items or concerns

---

## ERROR HANDLING

- **Understand agents return nothing:** Broaden the search terms, retry once with different keywords. If still nothing, ask the user for clarification.
- **Investigation reveals higher complexity:** Upgrade the classification and re-route. A task classified as moderate during Phase 2 can be escalated to complex if investigation uncovers cross-boundary changes or architectural decisions.
- **Implementation fails:** Capture the error. Research the cause or ask the user for guidance. Never silently fail or skip a step.

---

## AVAILABLE AGENTS REFERENCE

| Agent | Use When |
|-------|----------|
| **Explore** | Phase 1 recon, finding files and patterns |
| **general-purpose** | Default implementer for most tasks |
| **nextjs-expert** | Affected code is Next.js (found during Understand, not assumed) |
| **typescript-expert** | Type definitions, generics, type safety issues |
| **unit-test-maintainer** | Test-only tasks or writing tests |
| **research-specialist** | External APIs, libraries, best practices |
| **system-architecture-reviewer** | Architectural decisions in complex tasks |
| **code-validation-auditor** | Final validation for moderate tasks |

---

## EXECUTION

Now execute this workflow for the following task:

$ARGUMENTS

**Remember:**
- Understand FIRST, then classify
- Classification is based on what you FOUND, not what was ASKED
- Thoroughness is in the template, not in your judgment
- Complex tasks go to superpowers — don't reimplement
- Verify proportionally — no unconditional full builds
