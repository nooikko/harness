---
name: External API + Local Verification Workflow
description: When researching external library APIs, fetch documentation then verify with local source code grep
type: workflow
---

# External API + Local Verification Workflow

This is a systematic approach used when understanding new external libraries or APIs:

1. **Fetch official documentation** from GitHub using WebFetch
2. **Search local repository** using Bash grep for corresponding implementations
3. **Extract and compare** implementation details against documented signatures

## Context

This pattern emerged from YouTube.js API investigation where:
- Official API signatures were fetched from GitHub raw files
- Local source repository was then grepped for implementation details
- Pattern repeated across multiple API surfaces (Innertube, Music, Session, Format, VideoInfo, Player)

## When to Use

- Integrating with external libraries where docs don't fully explain implementation
- Need to map public API signatures to internal code structure
- Understanding how abstraction layers work in complex libraries
- Cross-referencing documentation with actual source behavior

## When NOT to Use

- Simple documentation lookups (just use WebFetch)
- Working with familiar codebases (use existing knowledge)
- Quick bug fixes in known code (don't need deep research)
