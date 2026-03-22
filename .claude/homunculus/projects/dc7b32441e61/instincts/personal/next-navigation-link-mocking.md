---
id: next-navigation-link-mocking
trigger: when writing vitest tests for Next.js components that use usePathname, useRouter, or next/link
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Mock Next.js Navigation and Link Modules in Component Tests

## Action
Mock 'next/navigation' and 'next/link' modules with vi.mock() before importing components that use Next.js navigation hooks or Link components.

## Evidence
- Observed 15+ times in grep search across test suite (session 4856ee0a-a85e-44ce-988d-133f25f77051)
- Test files found: (chat)/page.test.tsx, search-palette.test.tsx, nav-link.test.tsx, layout.test.tsx, admin-sidebar.test.tsx, plugins-nav.test.tsx, create-agent-form.test.tsx, agent-memory-browser.test.tsx, agent-card.test.tsx, plugins/[name]/page.test.tsx, edit-agent-form.test.tsx, chat/[thread-id]/page.test.tsx, admin/layout.test.tsx, cron-jobs/[id]/edit/page.test.tsx, admin/page.test.tsx
- Pattern: vi.mock('next/navigation', ...) must come before component import
- Pattern: vi.mock('next/link', ...) must come before component import
- Last observed: 2026-03-17T02:05:46Z

## Implementation Pattern
1. For usePathname: mock with `vi.fn<() => string>()` to control return value
2. For useRouter: mock with `vi.fn()` and return object with push, back, etc.
3. For Link component: mock with simple anchor element `<a href={href}>{children}</a>`
4. Use mockReturnValue() or mockResolvedValue() to set behavior
5. Place all mocks BEFORE the `await import('../component')` statement

## Example
```typescript
const mockPathname = vi.fn<() => string>();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { NavLink } = await import('../nav-link');
```
