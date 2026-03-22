---
id: react-form-useTransition-server-action-pattern
trigger: when building form components that submit to server actions
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# React Form with useTransition Server Action Pattern

## Action
When building form components, structure them with useCallback event handlers that call startTransition with server actions, reset form state after successful submission, and use isPending to disable the submit button during request.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern consistently applied in: CreateTaskDialog, ProjectChatInput, ProjectSettingsForm
- Structure: useState for form fields → useTransition hook → useCallback handlers that call startTransition(async () => { await serverAction(); router.refresh(); resetState(); })
- All forms disable submit button when isPending is true
- All forms reset state after successful submission
- Last observed: 2026-03-15

## Implementation Notes
- Import useTransition and useCallback from React
- Create state for each form field
- Import server action functions
- Wrap async calls in startTransition to manage loading state
- Always call router.refresh() after mutations to keep UI in sync
- Reset form fields to initial state after successful submission
- Use isPending to disable form buttons and inputs during submission
