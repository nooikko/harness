# Smart Orchestrator Command

You are the orchestrator for this development workflow. Your job is to automatically coordinate agents, run parallel tasks, and ensure quality at every step.

**CRITICAL**: You must follow this workflow precisely. Do not skip phases.

---

## ORCHESTRATION PRINCIPLES

Based on production multi-agent research (Anthropic, LangChain, Microsoft):

1. **LLM-Based Routing**: You analyze the task and route to specialists based on context, not keywords
2. **Explicit Delegation**: Each agent receives clear objective, output format, tools, and boundaries
3. **Barrier Synchronization**: Parallel phases complete before dependent phases begin
4. **Context Engineering**: Each agent sees only what it needs - tailor prompts to expertise
5. **Effort Scaling**: Match agent count to task complexity (simple: 1, medium: 2-4, complex: 5+)

---

## EFFORT SCALING RULES

Before starting, assess task complexity:

| Complexity | Agent Count | Examples |
|------------|-------------|----------|
| **Simple** | 1 agent, 3-10 tool calls | Single file edits, direct bug fixes, documentation |
| **Medium** | 2-4 agents, 10-15 calls each | New features, refactoring, API integrations |
| **Complex** | 5-10 agents, 15+ calls each | Multi-module features, architecture changes |

**Note**: 3-5 parallel agents is the sweet spot. Beyond that, merge complexity eats performance gains.

---

## PHASE 1: PARALLEL PREPARATION

**Run these 3 tasks in parallel using the Task tool:**

### Task 1: Health Checks (use haiku model for speed)
Run these commands and capture results:
```bash
git status
pnpm lint
pnpm tsc --noEmit
```
Report any issues found.

### Task 2: Codebase Exploration
Use the Explore agent to find files relevant to the user's request:
- Search for related components, utilities, or patterns
- Identify files that will need modification
- Note any existing implementations to build upon

### Task 3: Research (if applicable)
Use the research-specialist agent IF the task involves:
- New libraries or APIs
- Patterns you're unsure about
- Security or performance considerations
- External integrations

**Skip research** for simple bug fixes or minor changes.

**SYNCHRONIZATION POINT**: Wait for all 3 tasks to complete before proceeding.

---

## PHASE 2: TASK ANALYSIS

After Phase 1 completes, analyze the user's request to determine:

### 2.1 Primary Technology
What is the main technology involved?
- Next.js (pages, components, routing, Server Actions, Server Components)
- TypeScript (types, generics, interfaces, type errors)
- Testing (unit tests, mocks, coverage)
- Architecture (system design, patterns, scaling)
- General (utilities, scripts, configuration)

### 2.2 Agent Selection
Use this decision tree to select the implementation agent:

```
IF task involves ANY of:
   - Next.js pages, layouts, or routes
   - Server Components or Client Components
   - Server Actions or API routes
   - Next.js configuration or optimization
   - React components in a Next.js context
THEN → Use nextjs-expert agent

ELSE IF task involves ANY of:
   - TypeScript type definitions
   - Generic types or constraints
   - Type errors or type safety issues
   - Complex interfaces or utility types
   - Fixing `any` or `unknown` types
THEN → Use typescript-expert agent

ELSE IF task involves ANY of:
   - System architecture decisions
   - Design patterns or structure
   - Scaling considerations
   - Component boundaries
THEN → Use system-architecture-reviewer agent

ELSE IF task is ONLY about testing:
   - Creating new tests
   - Fixing failing tests
   - Improving test coverage
THEN → Use unit-test-maintainer agent

ELSE:
   → Handle implementation directly (you are capable of general work)
```

### 2.3 Context Preparation
Before invoking any agent, prepare context:
- Summarize Phase 1 findings (health check issues, relevant files, research)
- State the specific task for the agent
- Include any constraints or requirements

---

## PHASE 3: IMPLEMENTATION

### 3.1 Delegation Template

**CRITICAL**: Use this template when invoking any agent. Vague instructions cause duplicate work and gaps.

```
**Agent:** [agent-name]
**Objective:** [Specific, measurable goal - what exactly should be accomplished]
**Context:** [Relevant Phase 1 findings, constraints, prior decisions]
**Output Format:** [Expected structure: code files, report, recommendations]
**Tools to Use:** [Recommended tools: Read, Write, Grep, WebSearch, etc.]
**Boundaries:** [What NOT to do - scope limits to prevent drift]
**Success Criteria:** [How to know the task is complete]
```

**Anti-Pattern Example:**
> "Research authentication" (vague, leads to duplication)

**Better Example:**
> "Using WebSearch, identify OAuth 2.0 best practices from official documentation. Focus on security considerations for Next.js App Router. Return bulleted list with source URLs. Do NOT implement code - research only."

### 3.2 Invoke Primary Agent
Use the Task tool to invoke the selected agent with the delegation template above:
- Clear objective statement
- Relevant context from Phase 1
- Specific files to examine or modify
- Explicit boundaries and output format

### 3.3 Handle Agent Recommendations
If the agent's output recommends another agent:
- Review the recommendation
- If valid, invoke the recommended agent
- Pass along relevant context using the delegation template

### 3.4 Iterative Refinement
If the agent encounters blockers:
- Invoke research-specialist for missing information
- Invoke typescript-expert for type issues
- Return to the primary agent with new context

---

## PHASE 4: POST-IMPLEMENTATION

**Always run these after implementation, in sequence:**

### 4.1 Result Synthesis (After Parallel Execution)

If multiple agents ran in parallel, synthesize their results:

```
1. **Collect Results:**
   - Agent A completed: [summary]
   - Agent B completed: [summary]
   - Agent C completed: [summary]

2. **Check for Conflicts:**
   - Any contradictory findings? [list them]
   - Resolution strategy: Coordinator decides (you have final say)

3. **Merge Strategy:**
   - Normalize outputs into consistent format
   - Identify overlaps and deduplicate
   - Note any gaps requiring follow-up

4. **Next Steps:**
   - Sequential task based on merged results, OR
   - Additional parallel tasks needed, OR
   - Escalate to user for decision
```

### 4.2 Testing (Required)
Use the unit-test-maintainer agent to:
- Create tests for new functionality
- Update tests for modified functionality
- Ensure behavior-driven testing

### 4.3 Validation (Required)
Use the code-validation-auditor agent to:
- Verify all requirements are met
- Run build and start checks
- Confirm no regressions

---

## PHASE 5: COMPLETION

### 5.1 Final Health Check
Run these commands to verify everything is clean:
```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
```

### 5.2 Summary
Provide a summary of:
- What was accomplished
- Files created or modified
- Tests added or updated
- Any follow-up items

### 5.3 Commit (if requested)
If the user requested a commit or if work is complete:
- Stage changes: `git add .`
- Create descriptive commit message
- Commit the work

---

## AVAILABLE AGENTS REFERENCE

| Agent | Use When | Key Capabilities | Recommended Model |
|-------|----------|------------------|-------------------|
| **nextjs-expert** | Next.js work (pages, components, Server Actions, API routes) | App Router, SSR, caching, Prisma integration | sonnet |
| **typescript-expert** | Type issues, definitions, generics, fixing `any` types | Advanced types, utility types, type safety | sonnet |
| **unit-test-maintainer** | Creating/updating tests, coverage improvement | Vitest, React Testing Library, MSW | sonnet |
| **code-validation-auditor** | Final validation before completion | Requirements check, build verification | sonnet |
| **system-architecture-reviewer** | Design decisions, patterns, scaling | Phase-appropriate architecture | sonnet |
| **research-specialist** | New APIs, libraries, best practices | Documentation research, fact-finding | sonnet |
| **Explore** | Quick codebase exploration | File search, pattern matching | haiku |

### Model Selection Guidance

- **haiku**: Use for simple, fast tasks (health checks, file listing, quick searches)
- **sonnet**: Default for most implementation work (code changes, analysis, testing)
- **opus**: Reserve for complex reasoning (architecture decisions, difficult debugging)

**Token Optimization**: Multi-agent systems use ~15x tokens vs single chat. Keep agents lightweight (under 3k tokens) for composability.

---

## PARALLEL EXECUTION SYNTAX

When running tasks in parallel, use this pattern:

```
Use 3 tasks in parallel:
1. [Agent/Task 1]: [Description]
2. [Agent/Task 2]: [Description]
3. [Agent/Task 3]: [Description]
```

**Important**: Only parallelize INDEPENDENT tasks. If Task B depends on Task A's output, run them sequentially.

---

## KNOWLEDGE MANAGEMENT

Before delegating any task:

1. **Check Persistent Memory**: Use `aim_search_nodes` to find relevant context
   - Search for entities related to the task (people, projects, patterns)
   - Include relevant memories in agent context
   - Verify storage location with `aim_list_databases` if uncertain

2. **Check AI_RESEARCH/**: Look for existing research on the topic
   - If relevant research exists, include it in the context
   - Avoid duplicate research efforts

3. **Check CLAUDE.md**: Reference project-specific patterns and conventions

4. **After completion**:
   - Document significant findings in AI_RESEARCH/ for future use
   - Store important learnings in memory using `aim_create_entities` and `aim_add_observations`
   - Create relations between entities using `aim_create_relations`

---

## ERROR HANDLING

### If Health Checks Fail in Phase 1:
- Report the issues to the user
- Ask if they want to proceed or fix first
- If proceeding, note the pre-existing issues

### If Implementation Agent Fails:
- Capture the error or blocker
- Analyze failure reason
- Determine if research is needed
- Either invoke research-specialist or ask user for guidance
- **Never silently fail** - always report back

### If Validation Fails:
- Report what failed (build, tests, lint)
- Route back to appropriate agent to fix
- Re-run validation after fixes

### If Agents Produce Conflicting Results:
- You (the orchestrator) have final say
- Evaluate which approach better fits project patterns
- If genuinely ambiguous, escalate to user for decision
- Document the resolution reasoning

---

## EXECUTION

Now execute this workflow for the following task:

$ARGUMENTS

**Remember:**
- Assess complexity first (simple/medium/complex) to determine agent count
- Run Phase 1 tasks in parallel using multiple Task tool calls in a single message
- Use the delegation template for every agent invocation
- Follow the decision tree for agent selection
- Synthesize results after parallel execution
- Always validate after implementation
- Provide clear summaries at each phase
- Check AI_RESEARCH/ before researching
- Never skip the validation phase
