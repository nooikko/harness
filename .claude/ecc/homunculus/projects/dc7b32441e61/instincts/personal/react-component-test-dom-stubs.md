---
id: react-component-test-dom-stubs
trigger: when vitest React component tests fail with "is not a function" or component mock errors, or DOM assertions fail on split text
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# React Component Testing Requires DOM API and Component Stubs Before Import

## Action
Stub missing DOM APIs (scrollIntoView, etc.) and mock external component libraries with vi.mock() at the top level before importing the component under test.

## Evidence
- Observed 8+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051 on 2026-03-15 (continuing from previous observations)
- Pattern 1: scrollIntoView stub required for cmdk-based components: `Element.prototype.scrollIntoView = vi.fn();`
- Pattern 2: Third-party component libraries like cmdk need full vi.mock() before component import
- Pattern 3: Mock setup must occur before `import('../component')` statement to take effect
- Pattern 4: When search components highlight matched text with `<mark>` tags, DOM text assertions must use function matchers: `screen.getByText((content, el) => el?.textContent === 'expected')`
- Symptoms: TypeError about missing methods, cmdk filtering behavior not matching test expectations, DOM matching failures on split text
- Last observed: 2026-03-15T22:51:01Z

## Solution Pattern
1. Add DOM API stubs: `Element.prototype.scrollIntoView = vi.fn();`
2. Mock component libraries early: `vi.mock('@harness/ui', async () => { const React = await import('react'); return { ... }; });`
3. Only then import the component: `const { ComponentName } = await import('../component');`
4. Order matters: stubs and mocks must be declared before the component is imported
5. For text with HTML children (e.g., `<span>Test<mark>ed</mark></span>`), use function matcher: `screen.getByText((content, el) => el?.textContent === 'Tested')`

## Common Issues
- Placing mock after component import doesn't work (module already loaded)
- forgetting to stub DOM APIs that cmdk or other libraries use
- Incomplete component mock stubs (missing all expected exports)
