---
name: handoff
description: Session Handoff Command
disable-model-invocation: true
---

# Session Handoff Command

Prepare for session end by documenting progress and saving important context to persistent memory.

## Session Identification

**CRITICAL**: When running multiple Claude sessions in parallel, use session identifiers to prevent cross-contamination.

Generate a unique session ID if one wasn't provided:
- Format: `session-{task-type}-{short-hash}` (e.g., `session-feature-a1b2c3`, `session-review-x9y8z7`)
- Include this ID in ALL memory entries for this session

## Instructions

1. **Determine session identity**:
   - If user provided a session ID in $ARGUMENTS, use that
   - Otherwise, generate one based on the work done: `session-{primary-task}-{random-4-chars}`
   - Store the session ID in memory for this session's continuity

2. **Summarize completed work**:
   - What was accomplished this session
   - Files created or modified
   - Tests added or updated
   - Any commits made

3. **Document any pending items**:
   - Work in progress that needs continuation
   - Blockers or issues encountered
   - Decisions that need user input

4. **Save to persistent memory** using aim tools:
   - **IMPORTANT**: Prefix entity names with session ID: `{session-id}:EntityName`
   - Use `aim_create_entities` for new significant components/patterns
   - Use `aim_add_observations` for updates to existing entities
   - Use `aim_create_relations` to link related entities
   - Context: use "work" for project-specific memories
   - Include a `session-metadata` entity with:
     - Session ID
     - Start time (if known) and end time
     - Branch worked on
     - Primary focus area
     - Status: `completed` | `wip` | `blocked`

5. **Save research** if any new patterns were discovered:
   - Create/update files in AI_RESEARCH/ for reusable knowledge
   - Format: `YYYY-MM-DD-topic-name.md`

6. **Clean up**:
   - Stage completed changes: `git add .`
   - Create commit if work is complete (include session ID in commit message footer)
   - Or document WIP state clearly

## Output Format

Provide a structured handoff summary:
```
## Session: {session-id}
Branch: {branch-name}
Status: {completed|wip|blocked}

## Accomplished
- [What was accomplished]

## Files Changed
- [List of files]

## Saved to Memory
- [Entities/observations stored with session prefix]

## Pending Items
- [Any incomplete work]

## Next Steps
- [Recommended continuation points]

## Resume Command
To resume this specific session:
/catchup {session-id}
```

## Memory Entry Examples

**Session Metadata Entity:**
```
Entity: session-feature-a1b2c3:metadata
Type: session
Observations:
  - "Branch: feature/new-login"
  - "Focus: implementing OAuth login"
  - "Status: wip"
  - "Last commit: abc123"
  - "Pending: unit tests for token refresh"
```

**Session-Scoped Work Entity:**
```
Entity: session-feature-a1b2c3:OAuthLoginComponent
Type: component
Observations:
  - "Created new OAuth login component at apps/internal/src/components/auth/OAuthLogin.tsx"
  - "Uses Clerk's OAuth hooks"
  - "Needs: error handling for token expiry"
```

## User Notes

$ARGUMENTS
