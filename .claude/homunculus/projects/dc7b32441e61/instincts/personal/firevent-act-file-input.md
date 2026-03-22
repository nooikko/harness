---
id: firevent-act-file-input
trigger: when testing HTML file input elements in React components
confidence: 0.5
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# FireEvent + Act for File Input Testing

## Action
Wrap fireEvent.change() calls for file inputs in act() to properly handle React state updates during file selection.

## Evidence
- Observed 2-3 times in session 6148e335-52e0-4235-83b4-e8810fdf5c9e
- Pattern: `await act(async () => { fireEvent.change(fileInput, { target: { files: [...] } }); });`
- Used in multiple file upload test cases (stages files, removes staged files)
- Last observed: 2026-03-15
