# AgentConfig UI Changes

## Summary

Added UI toggles for `memoryEnabled` and `reflectionEnabled` AgentConfig fields to the agent edit form, plus a new server action to persist them.

## Files Changed

### New File
- `apps/web/src/app/(chat)/chat/_actions/update-agent-config.ts` — Server action that upserts an AgentConfig record given `agentId`, `memoryEnabled`, `reflectionEnabled`. Follows the same pattern as `update-agent.ts` (try/catch, revalidatePath, return `{ success }` or `{ error }`).

### Modified Files
- `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx` — Added `agentConfig` prop (nullable), two new state variables (`memoryEnabled`, `reflectionEnabled`), an "Agent Configuration" section with two checkboxes below a `<Separator />`, and `Promise.all` in the submit handler to save both agent fields and config simultaneously. Imports `Separator` from `@harness/ui` and `updateAgentConfig` from the new action.
- `apps/web/src/app/(chat)/agents/[agent-id]/page.tsx` — Added `prisma.agentConfig.findUnique` query alongside the existing agent query, passes result as `agentConfig` prop to `EditAgentForm`.
- `apps/web/src/app/(chat)/agents/_components/__tests__/edit-agent-form.test.tsx` — Added `mockUpdateAgentConfig` mock, `fakeAgentConfig` fixture, updated all render calls to pass `agentConfig` prop, fixed the "toggles enabled" test to use `getByLabelText('Enabled')` instead of `getByRole('checkbox')` (now ambiguous with 3 checkboxes).

## Design Decisions
- Used plain HTML checkboxes (no Switch component exists in the UI package) matching the existing "Enabled" checkbox pattern already in the form.
- `heartbeatEnabled` and `heartbeatCron` are intentionally excluded from the UI per instructions.
- Config defaults when no AgentConfig record exists: `memoryEnabled=true`, `reflectionEnabled=false` (matching schema defaults).
- Both agent update and config update fire in parallel via `Promise.all` on submit.

## Verification
- `pnpm typecheck` passes (all 41 tasks)
- `pnpm lint` passes (all 21 tasks)
- Changes are unstaged as requested
