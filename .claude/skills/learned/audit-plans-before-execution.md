---
name: audit-plans-before-execution
description: "Audit implementation plans against existing code to catch over-engineering from wrong assumptions"
user-invocable: false
origin: auto-extracted
---

# Audit Plans Against Existing Infrastructure

**Extracted:** 2026-03-14
**Context:** Multi-plan generation where 4/9 plans were over-scoped due to assumptions about missing infrastructure

## Problem
When generating implementation plans (especially multiple at once), it's easy to assume capabilities don't exist and propose building them from scratch. This leads to over-engineered plans that duplicate existing work: custom parsers when the framework handles it, new plugins when extending an existing one suffices, new UI scaffolding when components are already built.

## Solution
After drafting plans, run a structured audit before execution. Launch parallel exploration agents, one per plan, each checking:

1. **Existing models** — Can an existing DB model be extended, or is a new one truly needed?
2. **Existing server actions** — Are there already actions that handle the proposed operations?
3. **Existing UI components** — Are proposed components already in the shared UI library or elsewhere?
4. **Existing dependencies** — Is the proposed npm package already installed?
5. **Existing plugin tools** — Does an existing plugin already expose similar MCP tools?
6. **Framework capabilities** — Does the framework (react-markdown, Prisma, etc.) already handle what's being custom-built?

Ask each audit agent: "What from this plan already exists, partially exists, or overlaps with existing patterns?"

Then revise plans to eliminate redundant work before handing off for execution.

## When to Use
- After generating implementation plans, before executing them
- When planning features for a codebase you haven't fully explored
- When multiple plans are generated in a batch (assumptions compound)
- Before handing plans to autonomous agents who can't ask clarifying questions
