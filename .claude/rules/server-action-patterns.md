---
paths:
  - "apps/web/**/_actions/**"
---

# Server Action Patterns

Learned conventions for writing Next.js server actions in the harness web app.

---

## Type Definitions

Every server action exports three types and a typed const:

```typescript
type CreateTaskParams = { name: string; projectId?: string };
type CreateTaskResult = { success: true; id: string } | { error: string };
type CreateTask = (params: CreateTaskParams) => Promise<CreateTaskResult>;

export const createTask: CreateTask = async ({ name, projectId }) => {
  // ...
};
```

Mutations use discriminated unions (`{ success: true } | { error: string }`). Read operations return the data directly.

---

## Validation + Revalidation

All data-mutating server actions follow this structure:

```typescript
"use server";

export const updateProject: UpdateProject = async ({ id, name }) => {
  // 1. Validate inputs
  if (!id || !name?.trim()) return { error: "Name is required" };

  try {
    // 2. Database operation
    await prisma.project.update({ where: { id }, data: { name } });

    // 3. Cache invalidation — always after successful mutation
    revalidatePath("/chat");

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};
```

Omitting `revalidatePath()` causes stale UI state. Multi-step operations (like file uploads) validate at each stage with specific error messages.

---

## Orchestrator HTTP Calls

Server actions that call the orchestrator wrap fetch in try/catch with a specific error handling pattern:

```typescript
try {
  const res = await fetch(`${getOrchestratorUrl()}/api/plugins/...`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, error: body.error ?? `Request failed (${res.status})` };
  }

  const result = await res.json();
  revalidatePath("/");
  return { success: true, ...result };
} catch {
  return { success: false, error: "Could not reach orchestrator. Is it running?" };
}
```

Three failure modes tested: HTTP error with JSON body, HTTP error with malformed body, network unreachable.

---

## Form Components

Forms that submit to server actions use `useTransition`:

```typescript
const [isPending, startTransition] = useTransition();

const handleSubmit = useCallback(() => {
  startTransition(async () => {
    const result = await createTask({ name });
    if ("success" in result) {
      router.refresh();
      setName(""); // Reset form state
    }
  });
}, [name]);

// Disable submit during pending
<Button disabled={isPending}>Create</Button>
```

Always call `router.refresh()` after mutations. Reset form fields after success.

---

## Testing Server Actions

Mock global fetch, `revalidatePath`, and `getOrchestratorUrl`:

```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_helpers/get-orchestrator-url", () => ({
  getOrchestratorUrl: () => "http://localhost:4001",
}));
```

Test four cases per action: success + revalidate, HTTP error with body, HTTP error without body (fallback message), and network unreachable (fetch throws).

---

## CRUD Ordering

When building a new entity's server actions, create them in this order: create -> update -> delete -> relation operations (add-dependency, remove-dependency). Each file is a single export matching its kebab-case filename.
