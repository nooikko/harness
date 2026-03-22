---
id: ui-component-reference-before-building
trigger: when implementing new UI components in the harness web app
confidence: 0.7
domain: code-style, workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# UI Component Reference Pattern Before Building

## Action
Before implementing new UI components, read 2-3 existing similar components to understand styling conventions, component composition patterns, and design system usage in the codebase.

## Evidence
- Observed 6+ times across multiple sessions
- Session 2464ac8f-58a5-496a-b12e-600dcb754571: Planning file upload UI, read thinking-block.tsx, tool-call-block.tsx, collapsible-block.tsx
- Session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-17): Before Phase 5 (admin error dashboard), sequentially read:
  - `admin/threads/page.tsx` - admin list page structure
  - `admin/agent-runs/page.tsx` - admin list page with header/table pattern
  - `admin/_components/admin-sidebar.tsx` - navigation sidebar structure
- Pattern applies to both component libraries and page layouts
- These reads establish: container sizing (max-w-5xl), page header layout (title + description), navigation patterns, table/list styling
- Last observed: 2026-03-17T01:39:13Z

## Why This Matters
Harness uses a consistent design system with established patterns. Reading reference components before building new ones ensures:
1. Visual consistency (matching padding, borders, colors, icon sizes)
2. Code patterns (reusing CollapsibleBlock vs reimplementing, similar className structures)
3. Component reuse (discovering existing components that solve similar problems)
4. Design system compliance (shadcn/ui styling conventions and Tailwind patterns)

This prevents duplicating functionality and maintains cohesive UI design.
