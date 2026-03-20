---
id: selector-dropdownmenu-preference
trigger: when building a selector/dropdown UI component for simple item selection
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Prefer DropdownMenu over Popover+Command for Simple Selectors

## Action
Use DropdownMenu with DropdownMenuItem for simple list-based selection UIs instead of Popover with Command+CommandItem patterns.

## Evidence
- Observed 3 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern: model-selector.tsx (baseline, already using DropdownMenu); agent-selector.tsx refactored from Popover+Command to DropdownMenu; new-chat-area.tsx refactored from Popover+Command to DropdownMenu
- Last observed: 2026-03-14 02:29:21
- Reason: DropdownMenu is simpler for basic selections, less boilerplate, cleaner imports, adequate functionality without the search/filtering complexity of Command

## When Not to Apply
- If the selector needs full-text search or complex filtering, Command+Popover may still be appropriate
