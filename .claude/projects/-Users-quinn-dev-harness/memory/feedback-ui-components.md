---
name: Use @harness/ui components
description: Always use Button/Badge/Card etc from @harness/ui, not raw HTML buttons - raw button elements only for unstyled interaction targets
type: feedback
---

Use `Button` from `@harness/ui` for anything that should look like a button. Raw `<button>` elements are acceptable only for unstyled interactive areas (like clickable message rows in the transcript viewer where you don't want button styling). The hover action buttons (annotate, flag) in the workspace should use `Button variant="ghost" size="icon"` from `@harness/ui`, not raw `<button>` with manual styling.

**Why:** Consistency with the design system. Raw buttons with hand-written classes drift from the established patterns.

**How to apply:** When writing new UI, default to `@harness/ui` components. Only use raw HTML elements when the component library doesn't have an appropriate primitive.
