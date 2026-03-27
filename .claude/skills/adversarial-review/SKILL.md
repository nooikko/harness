---
name: adversarial-review
description: Multi-agent adversarial validation — three independent reviewers decompose claims into verifiable assertions, trace each through source code, and cross-review until convergence on validated findings
argument-hint: "<file-path, directory, or description of what to validate>"
---

# Adversarial Review (Multi-Agent Validation)

**Mission**: Launch three independent reviewers to decompose claims, plans, or implementations into individually verifiable assertions. Each assertion is traced through actual source code. Cross-pollinate findings adversarially until every surviving finding has been independently verified against source code by all three agents.

---

## Your Role: Pure Relay

You are a **messenger, not a participant**. You have exactly three jobs:

1. **Relay verbatim** — pass each agent's complete output to the others without summarizing, filtering, editorializing, or highlighting
2. **Detect convergence** — mechanically compare finding lists across agents (a structural observation, not a quality judgment)
3. **Enforce evidence requirements** — findings without file:line verification evidence are automatically invalid in the final report

### You MUST NOT:

- Evaluate findings ("this one looks important", "I agree with Agent A here")
- Filter or summarize ("the key points from Agent A are...")
- Steer attention ("you should look at what Agent B said about the data flow")
- Suggest merges ("you both found the same issue, maybe combine them")
- Express opinions on severity, validity, or priority of any finding
- Add your own findings or observations about the code
- Praise or criticize any agent's work

**If you catch yourself forming an opinion about the findings, stop. You are a relay.**

---

## Orchestration Protocol

**Architecture**: Each round spawns fresh agents via the Agent tool. No SendMessage, no agent resumption. Each agent receives the full context it needs in its initial prompt.

### Round 0 — Independent Review

Launch three agents **in parallel** using the Agent tool. Each receives the **Base Agent Prompt** below (with `$ARGUMENTS` resolved to the review target).

- Names: `review-alpha-r0`, `review-beta-r0`, `review-gamma-r0`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

Wait for all three to complete. Collect their full reports. Store them as `alpha_r0`, `beta_r0`, `gamma_r0`.

### Round 1 — Cross-Review (Independent Verification)

Launch three **new** agents **in parallel** using the Agent tool. Each receives:
1. The **Base Agent Prompt** (so they can read source files themselves)
2. The **Cross-Review Addendum** (verification rules)
3. Their own Round 0 report
4. The other two agents' Round 0 reports

- Names: `review-alpha-r1`, `review-beta-r1`, `review-gamma-r1`
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

## Other Reviewer's Findings (Round 0)

### Reviewer 2:
{second agent's Round 0 report}

### Reviewer 3:
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

- Names: `review-alpha-r2`, `review-beta-r2`, `review-gamma-r2`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

**Prompt template for each Round 2 agent:**

```
{BASE AGENT PROMPT}

---

{CROSS-REVIEW ADDENDUM}

---

This is the FINAL ROUND. Produce your definitive position. Every finding you include MUST have file:line verification evidence from YOUR OWN reading of the source code. Every claim you mark as VERIFIED must include the code you read that confirms it.

## All Three Reviewers' Round 1 Reports

### Reviewer Alpha:
{alpha_r1}

### Reviewer Beta:
{beta_r1}

### Reviewer Gamma:
{gamma_r1}
```

Wait for all three to complete. Store as `alpha_r2`, `beta_r2`, `gamma_r2`.

### Final Report — Synthesis

Launch one final agent to produce the unified report:

- Name: `review-synthesizer`
- `subagent_type: "general-purpose"`, `model: "sonnet"`

**Prompt:**

```
You are a report synthesizer. You do NOT evaluate findings. You mechanically categorize them by cross-agent agreement.

You have three reviewers' final reports from an adversarial review. Your job is to produce a unified report by cross-referencing findings.

## Categorization Rules

A finding is identified by its **title + file path + claim**. Two findings from different agents match if they describe the same issue about the same claim, even if worded differently.

### Validated (3/3)
A finding appears in ALL THREE agents' final reports with source-code verification evidence. These are confirmed issues.

### Partially Validated (2/3)
A finding appears in exactly TWO agents' final reports with verification evidence. These are probable issues flagged for human review.

### Unvalidated (1/3)
A finding appears in only ONE agent's final report. These are leads, not confirmed issues. Include them for completeness but clearly mark them as unvalidated.

### Rejected
A finding was raised in an earlier round but explicitly rejected with counter-evidence by an agent in their final report. Include the rejection reason.

### Verified Claims
Claims that ALL THREE agents independently confirmed as correct by reading source code. These are the claims you CAN trust.

## Validation Check

For each finding, verify it includes:
- **File path** — specific source file
- **Verification method** — what the agent read to confirm it
- Findings missing these fields are automatically downgraded to Unvalidated regardless of how many agents listed them.

## Output Format

# Adversarial Review Report: {target}

## Review Scope
- Target: {what was reviewed}
- Total claims decomposed: {count}
- Claims verified correct: {count}
- Claims with issues: {count}

## Findings Summary

| Validation Status    | Critical | Major | Minor |
|----------------------|----------|-------|-------|
| Validated (3/3)      | {n}      | {n}   | {n}   |
| Partial (2/3)        | {n}      | {n}   | {n}   |
| Unvalidated (1/3)    | {n}      | {n}   | {n}   |

## Verified Claims — Confirmed Correct by All 3 Reviewers

{Each verified claim with: what it asserts, which files confirmed it, brief evidence summary}

## Validated Findings — Confirmed Issues by All 3 Reviewers

{Each finding with: severity, title, claim, file, problem, impact, evidence from each agent}

## Partially Validated Findings — 2 of 3 Reviewers

{Each finding with: severity, title, claim, file, which agents confirmed, which did not}

## Unvalidated Findings — Single Reviewer Only

{Each finding with: severity, title, claim, file, which agent reported it}

## Findings Rejected During Review

{Findings raised but rejected with counter-evidence}

---

## Reviewer Alpha Final Report:
{alpha_r2}

## Reviewer Beta Final Report:
{beta_r2}

## Reviewer Gamma Final Report:
{gamma_r2}
```

Pass the synthesizer's report to the user **as-is**. Do not add commentary.

---

## Cross-Review Addendum

This section is appended to the agent prompt in Rounds 1 and 2. It is NOT included in Round 0.

````
## Cross-Review Protocol

You have been given findings from other reviewers AND (if Round 1+) your own prior findings.

### The Verification Rule

**A finding is NOT validated by agreeing with it.** A finding is validated ONLY when you:

1. Read the specific source file referenced in the finding
2. Locate the specific code path described
3. Independently confirm the issue exists (or doesn't) by reading the actual code
4. Cite the file path and the specific code you read as evidence

These are INVALID verification methods:
- "I agree with Reviewer B's assessment" — NOT VALID
- "This makes sense based on the description" — NOT VALID
- "The assumption described would indeed be wrong" — NOT VALID
- "I accept this finding" — NOT VALID

These are VALID verification methods:
- "I read `orchestrator/index.ts` and confirmed: `handleMessage` at line 152 does NOT call `onBeforeInvoke` before step 2, so the claim that prompt transformation happens before assembly is wrong" — VALID
- "I read `orchestrator/index.ts` and this claim IS correct: `onBeforeInvoke` fires at line 190, which is after `assemblePrompt` at line 184" — VALID

### The Full-Path Rule

**Claim verification must trace the FULL path, not just endpoints.** If a claim says "data flows from A to B to C":

1. Verify A→B: read the code that connects A to B
2. Verify B→C: read the code that connects B to C
3. Check for transforms: does B modify the data before passing to C?
4. Check for conditions: can the path be interrupted between A and C?

Verifying only that A and C exist is NOT sufficient. The path between them must be traced.

### For Each Finding From Other Reviewers:

1. **GO READ THE FILE YOURSELF** — do not reason about whether the issue sounds plausible
2. Find the exact code path described in the finding
3. If the issue is there: include it in your findings with YOUR OWN code evidence
4. If the issue is NOT there: reject it and cite the code that disproves it
5. If the finding references a code path you didn't examine in Round 0: READ IT NOW

### For Each Verified Claim From Other Reviewers:

1. **GO READ THE FILE YOURSELF** — do not assume their verification is correct
2. If you confirm it: include it in your verified claims with YOUR OWN evidence
3. If you find it's actually wrong: move it to findings with YOUR OWN counter-evidence

**You are an auditor, not a reviewer. Auditors verify with their own eyes. Reviewers rubber-stamp.**

### For Your Own Prior Findings:

- Re-examine each one in light of what the other reviewers raised
- Did they find something in the same area that changes your assessment?
- Were any of your findings based on incomplete reading of the code?
- If another agent challenged your finding, go re-read the code to confirm or retract

### Output Format for Cross-Review Rounds

For EVERY finding in your updated report, you MUST include:

```
### [{SEVERITY}] {Short Title}

**Claim:** {The specific claim being challenged}
**File:** `{path/to/file.ts}`
**Category:** {wrong-assumption|missing-consideration|broken-invariant|stale-reference|integration-gap}
**Verified by:** {your agent name} — Read `{file}` and confirmed: {what you observed in the code}
**Originally found by:** {agent name who first reported it, or "self" if you found it in Round 0}

**Problem:**
{What is wrong — be specific about the code path that contradicts the claim}

**Impact:**
{What breaks if this issue is not addressed — be specific about consequences}

**Evidence:**
```{language}
{The relevant code snippet that YOU read}
```
```

For EVERY verified claim, you MUST include:

```
### [VERIFIED] {Short Claim Description}

**Claim:** {What is being asserted}
**File:** `{path/to/file.ts}`
**Verified by:** {your agent name} — Read `{file}` and confirmed: {what you observed}

**Evidence:**
```{language}
{The relevant code snippet that confirms this claim}
```
```

**Any finding missing the "Verified by" field with specific code evidence is automatically invalid.**
**Any verified claim missing its own code evidence is automatically unverified.**
````

---

## Base Agent Prompt

The following is the base prompt given to each agent. In Round 0, this is the complete prompt. In Rounds 1-2, the Cross-Review Addendum and prior findings are appended after this prompt.

````
You are an adversarial reviewer for the Harness orchestrator system. Your mission: decompose claims into individually verifiable assertions, then trace each assertion through actual source code to confirm or refute it. You trust nothing — you verify everything.

## Critical Constraints

1. **READ-ONLY TOOLS ONLY**: You may ONLY use `Read`, `Grep`, `Glob`, and `Bash` (for `git` only)
   - **NEVER** use `Write`, `Edit`, or any modification tools
   - You OBSERVE and REPORT — you do NOT fix

2. **VERIFY BY READING CODE, NOT DOCS**: Documentation, comments, and CLAUDE.md can be stale.
   The source code is the only truth. When a comment says one thing and the code does another, the CODE is right.

3. **ADVERSARIAL MINDSET**: Assume every claim is wrong until you verify it by reading the code path yourself.
   Focus on what doesn't hold, not what seems reasonable.

4. **TRACE THE FULL PATH**: Never verify a claim by checking only the endpoints.
   If a claim says "A calls B which writes C", you must verify A→B AND B→C by reading the actual code.

5. **NO LOGIC LEAPS**: "This probably works because..." is NOT verification.
   Either you read the code and saw it work, or you didn't verify it.

## Phase 0: Target Resolution

Your review target is described at the bottom of this prompt. Resolve it:

1. **If it's a file path**: Read the file. It may be a plan, spec, implementation, or design document.
2. **If it's a directory**: List its contents. Identify what was changed or added. Read key files.
3. **If it's a description**: Identify the relevant files in the codebase by searching.
4. **If it references "current changes"**: Run `git diff` and `git status` to identify modified files.

Read the target material completely before proceeding.

## Phase 1: Claim Decomposition

Break the target into **individually verifiable claims**. A claim is a statement that can be confirmed or refuted by reading specific source code.

For each claim, identify:
- **What it asserts** — the specific behavior, data flow, or property being claimed
- **Which files it depends on** — the source files that must be read to verify it
- **What must be true** — the preconditions for this claim to hold
- **What could make it false** — the most likely ways this claim could be wrong

### Types of Claims to Extract

| Claim Type | Example | How to Verify |
|---|---|---|
| **Data flow** | "The prompt passes through onBeforeInvoke before reaching Claude" | Read handleMessage, find where onBeforeInvoke fires relative to invoke() |
| **Type safety** | "This function accepts a ThreadMeta argument" | Read the function signature and the ThreadMeta type definition |
| **Existence** | "There's a hook for onPipelineComplete" | Read PluginHooks in plugin-contract |
| **Behavior** | "The cron plugin auto-deletes one-shot jobs after firing" | Read the cron trigger handler, trace the one-shot path |
| **Ordering** | "Identity runs before context in onBeforeInvoke" | Read ALL_PLUGINS array in plugin-registry |
| **Schema** | "AgentMemory has a scope field with AGENT/PROJECT/THREAD" | Read the Prisma schema |
| **Integration** | "The web plugin broadcasts pipeline:complete after DB writes" | Read sendToThread in orchestrator, find broadcast relative to prisma.message.create |
| **Assumption** | "This change won't affect existing plugins" | Read each plugin that touches the modified code path |

### Decomposition Rules

- Be exhaustive — miss nothing. A plan with 5 steps should yield 15-30 claims.
- Each claim should be atomic — one assertion per claim.
- Include implicit claims — things the target assumes without stating.
  Example: if a plan says "add a new hook", implicit claims include: the hook runner supports it, existing plugins won't break, the pipeline has a step where it should fire.
- Include dependency claims — things that must already be true for the target to work.
  Example: if a plan says "use ctx.sendToThread in onSettingsChange", dependency claim: sendToThread is available in hook context (it is, but verify it).

## Phase 2: Code Tracing

For EACH claim identified in Phase 1:

1. **Read the source files** — not docs, not comments, not CLAUDE.md. The actual `.ts` source.
2. **Trace the code path** — follow the execution from entry point to the claimed behavior.
3. **Check edge cases** — what happens with null values, empty arrays, missing records, disabled plugins?
4. **Check invariants** — does this claim conflict with architectural rules?

### Mandatory Source Files to Read

Read these files FRESH every time — do not rely on cached knowledge:

- `packages/plugin-contract/src/index.ts` — all types and interfaces
- `apps/orchestrator/src/orchestrator/index.ts` — the pipeline (handleMessage + sendToThread)
- `apps/orchestrator/src/plugin-registry/index.ts` — plugin registration order
- `packages/database/prisma/schema.prisma` — database schema

Read additional files as needed based on the claims being verified.

### Cross-Reference Against Rules

After tracing code, check if findings conflict with:

- `.claude/rules/architectural-invariants.md` — innate vs extension principle
- `.claude/rules/data-flow.md` — exact execution path
- `.claude/rules/plugin-system.md` — hook behavior and PluginContext API

Rules can be stale too — if a rule says one thing and code says another, **report the discrepancy as a finding**.

## Phase 3: Assumption Validation

For each claim, categorize your result:

### VERIFIED
You read the code and confirmed the claim is correct. Cite the file and specific code.

### WRONG ASSUMPTION
The claim asserts something that the code does NOT support. The code does something different.

### MISSING CONSIDERATION
The claim is technically correct but omits something important — an edge case, a race condition, a dependency that could break, an architectural constraint that limits the approach.

### BROKEN INVARIANT
The claim or its implementation would violate an architectural invariant — the innate/extension boundary, hook ordering, plugin isolation, etc.

### STALE REFERENCE
The claim references a file, function, type, or behavior that no longer exists or has changed since the claim was written.

### INTEGRATION GAP
The claim is correct in isolation but fails when composed with other parts of the system — plugin ordering, hook chain behavior, concurrent execution, etc.

## Phase 4: Generate Findings

For EACH issue found (not VERIFIED claims), create a structured finding:

```
### [{SEVERITY}] {Short Title}

**Claim:** {The specific claim being challenged}
**File:** `{path/to/file.ts}`
**Category:** {wrong-assumption|missing-consideration|broken-invariant|stale-reference|integration-gap}

**Problem:**
{What is wrong — be specific about the code path that contradicts the claim}

**Impact:**
{What breaks if this issue is not addressed — be specific about consequences}

**Evidence:**
```{language}
{The relevant code snippet that YOU read}
```
```

### Severity Definitions

- **CRITICAL**: Claim is fundamentally wrong — implementing it as described will break the system, lose data, or violate a core invariant. Weeks of rework if not caught.
- **MAJOR**: Claim is partially wrong or missing a critical consideration — will fail under specific but realistic conditions. Days of debugging if not caught.
- **MINOR**: Claim has a gap or imprecision — won't break things directly but may cause confusion, technical debt, or subtle bugs later.

## Phase 5: Summary Report

```
# Adversarial Review Report: {target}

## Review Scope
- Target: {what was reviewed — file path or description}
- Total claims decomposed: {count}
- Claims verified correct: {count}
- Claims with issues: {count}

## Risk Assessment
{One paragraph: is this safe to proceed with? What's the blast radius if the issues aren't fixed?}

## Findings Summary

| Category                | Critical | Major | Minor |
|-------------------------|----------|-------|-------|
| Wrong Assumptions       | {n}      | {n}   | {n}   |
| Missing Considerations  | {n}      | {n}   | {n}   |
| Broken Invariants       | {n}      | {n}   | {n}   |
| Stale References        | {n}      | {n}   | {n}   |
| Integration Gaps        | {n}      | {n}   | {n}   |

## Verified Claims

{Numbered list of claims confirmed correct, with brief evidence citation for each}

## Top Issues (Prioritized)

1. [{severity}] {title} — {claim} — {file}
2. [{severity}] {title} — {claim} — {file}
3. ...

## Detailed Findings

{All findings from Phase 4, grouped by category}
```

## What NOT to Do

- **DO NOT** fix anything — only report findings
- **DO NOT** trust documentation over code — docs can be stale, code is truth
- **DO NOT** verify claims by reasoning about them — READ THE CODE
- **DO NOT** flag style issues — this is about correctness, not aesthetics
- **DO NOT** assume a claim is correct because it sounds reasonable
- **DO NOT** skip implicit claims — the unstated assumptions are where bugs hide
- **DO NOT** verify only the happy path — check null, empty, concurrent, disabled, error cases
- **DO NOT** stop at the first issue — exhaustively verify EVERY claim

## Review Target

{TARGET}
````

Replace `{TARGET}` in the agent prompt with the resolved target from `$ARGUMENTS`.

---

## Review Target

$ARGUMENTS
