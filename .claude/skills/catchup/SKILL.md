---
name: catchup
description: Session Catchup Command
disable-model-invocation: true
---

# Session Catchup Command

Resume work by loading relevant context from persistent memory and recent activity.

## Session Modes

This command supports two modes:

1. **Specific Session Resume**: `/catchup session-feature-a1b2c3`
   - Loads ONLY the specified session's context
   - Filters memory entries by session ID prefix
   - Ideal for resuming a specific parallel session

2. **General Catchup**: `/catchup` or `/catchup {topic}`
   - Loads all relevant context regardless of session
   - Shows recent activity across all sessions
   - Useful for getting oriented to overall project state

## Instructions

### Step 1: Determine Mode

Parse $ARGUMENTS to determine mode:
- If starts with `session-`, use **Specific Session Mode**
- Otherwise, use **General Catchup Mode**

### Step 2: Check Persistent Memory

**For Specific Session Mode:**
```
1. Search for session metadata: `aim_search_nodes` with session ID
2. Load session-specific entities (prefixed with session ID)
3. Get the session's status, pending items, and last work
4. Filter OUT entries from other sessions
```

**For General Catchup Mode:**
```
1. Use `aim_search_nodes` with keywords from user's request
2. Use `aim_list_databases` to see available memory contexts
3. Load relevant entities and their observations
4. Show session breakdown: which sessions have been active
```

### Step 3: Review Recent Git Activity

```bash
git log --oneline -10
git status
git diff --stat HEAD~3
```

For Specific Session Mode, look for commits containing the session ID in the message.

### Step 4: Check for In-Progress Work

- Look for uncommitted changes
- Check for open TODO items in code
- Review any WIP branches
- Identify which session owns the uncommitted work (if determinable)

### Step 5: Summarize Context

**For Specific Session Mode:**
```
## Session Resume: {session-id}
Branch: {branch from session metadata}
Status: {completed|wip|blocked}

### Session Context
- [What this session was working on]
- [Pending items from this session]

### Files This Session Modified
- [Files changed by this session]

### Continue From
- [Specific point to resume work]
```

**For General Catchup Mode:**
```
## Project Catchup

### Active Sessions
- session-feature-a1b2c3: OAuth login (wip)
- session-bugfix-x9y8z7: Fix memory leak (completed)

### Recent Activity
- [Recent commits across all sessions]
- [Current branch and state]

### Relevant Memories
- [Loaded entities and observations]

### Uncommitted Work
- [Any pending changes and their likely owner]
```

## Avoiding Cross-Contamination

**When resuming a specific session:**
- Only load memory entries prefixed with that session ID
- Focus git log on commits mentioning the session ID
- Ignore context from other parallel sessions
- Report if you detect context that might be from another session

**When doing general catchup:**
- Clearly label which session each piece of context comes from
- Help user understand what each parallel session was doing
- Recommend which session to resume if user has a specific goal

## User Request

$ARGUMENTS
