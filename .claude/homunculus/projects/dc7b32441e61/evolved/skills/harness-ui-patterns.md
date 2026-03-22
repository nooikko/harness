---
name: harness-ui-patterns
description: UI conventions for the harness Next.js web app — layouts, server actions, type narrowing, component patterns
evolved_from:
  - admin-page-layout-standardization
  - modal-dialog-trigger-customization
  - selector-dropdownmenu-preference
  - suspense-wrapped-async-server-components
  - loose-server-types-union-narrowing
  - server-action-validation-revalidate
  - component-prop-refactoring-test-sync
  - prop-type-test-fixture-sync
---

# Harness UI Patterns

Auto-triggered when writing components in `apps/web/src/`.

## Patterns

### Page Layout
- List/grid pages: header with title + action button, then content area
- Consistent padding/spacing across admin and chat routes
- Use `Card` from `ui` for content sections

### Server Actions
- Always `"use server"` at top
- Validate input before DB operations
- Call `revalidatePath()` after mutations
- Return `{ success, error? }` shape for client consumption

### Async Server Components
- Wrap with `<Suspense fallback={<Skeleton />}>` at the page level
- The async component itself does the data fetching
- Keep loading states co-located with the page that uses them

### Type Narrowing (Server → Client)
- Prisma/server returns loose `string` for enum fields
- Client components need strict union types for Select/handlers
- Use `as` cast at the boundary: `status: value as TaskStatus`
- Extract typed defaults as standalone constants (avoids `noUncheckedIndexedAccess` issues with Record lookups)

### Component Props
- When adding a prop to a component, update all consumers AND test fixtures
- Test fixtures must match the component's current prop interface
- Use `Partial<Props>` in test helpers for optional override pattern

### Selectors
- Simple item selection: use `Select` from `ui` (not `DropdownMenu`)
- `DropdownMenu` is for action menus (edit, delete, etc.)
- Dialogs/modals: accept `trigger` prop for customizable trigger presentation
