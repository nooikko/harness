# Development Workflow Best Practices

**IMPORTANT**: UNDER NO CIRCUMSTANCE UTILIZE `any` OR `unknown` TYPE. DO NOT UPDATE LINTING CONFIGS TO ALLOW THEM. DO NOT ALLOW THEM IN THE CODE BASE.
**IMPORTANT**: UNDER NO CIRCUMSTANCE UTILIZE `any` OR `unknown` TYPE. DO NOT UPDATE LINTING CONFIGS TO ALLOW THEM. DO NOT ALLOW THEM IN THE CODE BASE.
**IMPORTANT**: UNDER NO CIRCUMSTANCE UTILIZE `any` OR `unknown` TYPE. DO NOT UPDATE LINTING CONFIGS TO ALLOW THEM. DO NOT ALLOW THEM IN THE CODE BASE.

## COMMAND: Systematic development workflow with quality gates

### WORKFLOW SEQUENCE:

1. **CHECK CURRENT STATE**
   - Ensure clean git state: `git status` should show no uncommitted changes
   - If git is dirty, either commit, stash, or discard changes before proceeding
   - Identify the current work item or feature to implement
   - Break down complex features into manageable subtasks if needed

2. **PRE-IMPLEMENTATION CHECK**
   - **CRITICAL**: Before implementing ANY functionality, search for existing implementations
   - **Use code search tools**: Query the codebase to find similar functionality
     - Use Grep for pattern matching: `function authenticate`, `class User`
     - Use Glob for file patterns: `**/*.service.ts`, `**/auth/**`
     - Search for keywords related to your feature
   - Look for existing utilities, helpers, or components that could be reused
   - Check if the feature might already be partially implemented elsewhere
   - If duplication is found, refactor/extend existing code instead of creating new
   - Document any existing code that was discovered and reused

3. **REVIEW EXISTING RESEARCH**
   - **MANDATORY**: Before ANY implementation, thoroughly review the AI_RESEARCH directory
   - **CRITICAL**: Read ALL relevant research files in AI_RESEARCH/ that relate to the current work
   - Look for existing research on:
     - The specific technology/framework being used
     - Similar features or patterns already researched
     - API specifications and best practices
     - Version-specific information and breaking changes
     - Security considerations and gotchas
     - Performance patterns and optimization techniques
   - **MUST NOT IGNORE**: Any research findings that contradict or supplement planned implementation
   - If existing research is found, incorporate those findings into the implementation plan
   - If no relevant research exists, proceed to step 4 but document the gap for future research
   - **CRITICAL**: This prevents duplicate research and ensures we build on existing knowledge

4. **RESEARCH CURRENT STANDARDS**
   - **MANDATORY**: Before implementation, use research tools to gather current information
   - **ONLY IF**: No relevant research exists in AI_RESEARCH/ or existing research is outdated
   - Research areas to cover:
     - **Best Practices**: Current industry standards for the technology/pattern being implemented
     - **Library Versions**: Latest stable versions and any breaking changes since knowledge cutoff
     - **Integration Patterns**: How similar features are integrated in modern applications
     - **Security Considerations**: Current security best practices for the feature
     - **Performance Patterns**: Modern optimization techniques relevant to the work
   - Use WebSearch and WebFetch tools to gather current information
   - Document research findings before starting implementation
   - If research reveals the approach needs adjustment, update the implementation plan accordingly
   - **CRITICAL**: This step ensures implementations use current standards, not outdated patterns

5. **IMPLEMENTATION WORKFLOW**
   - Set work item to `in-progress` when starting work
   - Verify no duplicate functionality exists (see PRE-IMPLEMENTATION CHECK)
   - Implement the requirements fully
   - Write tests that cover the implementation
   - Run tests to ensure they pass
   - Mark work as `done` when implementation and basic tests are complete
   - Document significant findings and decisions

6. **COMPLETION CRITERIA**

   **Work can ONLY be considered complete when ALL of the following are validated:**
   - Full implementation matches requirements
   - All tests are PASSING (`pnpm test` shows no failures)
   - Tests are RELEVANT (actually test the implemented functionality)
   - Tests are THOROUGH (comprehensive coverage of the feature)
   - Tests cover EDGE CASES (boundary conditions, empty inputs, nulls, extremes)
   - Tests cover MAIN CASES (primary use cases and happy paths)
   - Tests cover NEGATIVE CASES (error handling, invalid inputs, failures)
   - Code BUILDS successfully (`pnpm build` completes without errors)
   - Linting FULLY PASSES (`pnpm lint` runs with ZERO errors/warnings)
     - First run `pnpm lint:fix` to auto-fix what can be fixed
     - Then run `pnpm lint` to verify NO remaining issues
     - **CRITICAL**: Code cannot be committed if `pnpm lint` shows ANY issues

   **IMPORTANT**: Completion requires VALIDATION that we're comfortable not revisiting this work.

7. **GIT COMMIT AFTER COMPLETION**
   - **MANDATORY**: Once work meets ALL completion criteria above, commit the changes
   - **PRE-COMMIT VALIDATION**: Before staging files, verify linting passes
     - Run `pnpm lint` one final time
     - If ANY issues are reported, fix them before proceeding
     - Only proceed to commit when `pnpm lint` shows ZERO issues
   - Stage all changes: `git add .`
   - Create a descriptive commit message that summarizes what was accomplished
   - Commit format: `feat: {brief description of what was accomplished}`
   - Example: `feat: implement user authentication with JWT tokens`
   - Include details about major components added, tests written, and any significant decisions
   - This ensures clean git history and easy rollback if needed

8. **PROGRESSION RULES**
   - Start each work item with a clean git state (no uncommitted changes)
   - Always check for existing functionality before implementing new code
   - Work on subtasks sequentially within a feature when applicable
   - Don't move to next work item until current work meets ALL completion criteria
   - If tests fail or are inadequate, stay on current work and improve them
     - THIS MEANS IF THE TESTS YOU WROTE FOR THIS CODE ARE FAILING, YOU CANNOT MOVE FORWARD UNTIL THEY ARE FIXED
     - This excludes tests that were already failing when you started the work
   - If `pnpm lint` reports ANY issues, stay on current work and fix them
     - THIS MEANS IF LINTING FAILS, YOU CANNOT COMMIT OR MOVE FORWARD UNTIL ALL ISSUES ARE RESOLVED
     - Run `pnpm lint:fix` first, then manually fix any remaining issues
   - Log all significant findings and issues
   - Commit changes ONLY after entire work item is validated as complete
   - When in doubt about completion criteria, err on the side of thoroughness

9. **CONTINUOUS WORKFLOW**
   - After completing and committing work, continue to the next available work item
   - The workflow should be:
     1. Complete current work (including all validation and git commit)
     2. Identify the next work item
     3. If work is available, immediately begin the workflow from step 1 (CHECK CURRENT STATE)
     4. Continue this loop until no more work is available
   - **STOP CONDITIONS**:
     - No more pending work items
     - Critical error that requires user intervention
     - Explicit user request to stop
   - **BETWEEN WORK ITEMS**: After each commit, briefly summarize what was completed before moving to the next work

### EXECUTION:
Follow the workflow above systematically. After completing and committing each work item, continue to the next available work without stopping. The goal is to work through ALL available work in a continuous session. Only stop when there is no more work available or a critical issue requires user intervention. Work validation is critical - completed work should not need revisiting. Remember: NO work can be committed if `pnpm lint` shows ANY issues - all linting must pass cleanly before proceeding.

$ARGUMENTS
