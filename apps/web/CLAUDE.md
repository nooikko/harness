# Web App (Dashboard)

## Server Component Architecture

This app uses Next.js 16 App Router with React Server Components and Suspense streaming. The core principle: **components own their own data**.

### Pages Are Thin Shells

Pages should only await what is required for routing decisions (params, auth, 404 checks). Everything else streams via Suspense children.

```tsx
// CORRECT — page resolves params, renders shell, streams data via children
const ThreadPage = async ({ params }) => {
  const { id } = await params;
  const thread = await prisma.thread.findUnique({ where: { id } });
  if (!thread) notFound(); // Must fire before streaming for correct 404 status

  return (
    <div>
      <Header thread={thread} />
      <Suspense fallback={<Skeleton />}>
        <MessageList threadId={id} />
      </Suspense>
    </div>
  );
};
```

```tsx
// WRONG — page fetches all data, blocks entire render
const ThreadPage = async ({ params }) => {
  const { id } = await params;
  const thread = await prisma.thread.findUnique({ where: { id } });
  const messages = await fetchMessages(id); // Blocks everything
  return <ThreadDetail thread={thread} messages={messages} />;
};
```

### Components Own Their Data

Async server components fetch their own data. Do not pass pre-fetched data through wrapper components.

```tsx
// CORRECT — component fetches its own data, wrapped in Suspense by parent
export const MessageList = async ({ threadId }) => {
  const messages = await fetchMessages(threadId);
  return <ScrollArea>...</ScrollArea>;
};
```

```tsx
// WRONG — parent fetches data and passes it down
export const MessageList = ({ messages }) => {
  return <ScrollArea>...</ScrollArea>;
};
```

### Break Components Apart Instead of Promise.all

When a page needs multiple independent data sources, do not combine them with `Promise.all` in a single component. Break them into separate async components with their own Suspense boundaries. Each streams as soon as its data is ready.

```tsx
// CORRECT — each section streams independently
<Suspense fallback={<ChartSkeleton />}>
  <UsageOverTimeChart />
</Suspense>
<Suspense fallback={<TableSkeleton />}>
  <UsageByModelTable />
</Suspense>
```

```tsx
// WRONG — all data waits for the slowest query
const [chartData, tableData] = await Promise.all([
  fetchUsageOverTime(),
  fetchUsageByModel(),
]);
return <><Chart data={chartData} /><Table data={tableData} /></>;
```

`Promise.all` is only appropriate when a single component genuinely needs all the data before it can render anything meaningful.

### Suspense Boundary Placement

- Wrap async children in `<Suspense>` with a skeleton/spinner fallback
- Use `key` prop on Suspense to reset when dynamic params change: `<Suspense key={os}>`
- Layouts can wrap `{children}` in Suspense for page-level loading states
- `notFound()` must fire before streaming begins (in the page, not inside a Suspense child)

### Server-Only Data Components

Async components that fetch data should import `'server-only'` to prevent accidental client bundling. Export a named skeleton component alongside for Suspense fallbacks.

### Server Actions

Place server actions in `_actions/` directories with `'use server'` directive. Always authenticate inside the action — do not rely on layout or middleware guards alone, since server actions are public endpoints.

### Serialization

When passing data from server to client components, only pass the fields the client needs. Map Prisma results to simple shapes before passing as props.

## File Organization

Follows the root CLAUDE.md conventions:
- `_components/` for sub-components private to the route
- `_helpers/` for isolated logic (one export per file)
- `_actions/` for server actions
- `__tests__/` for tests adjacent to what they test

## Testing Async Server Components

Use `renderToStaticMarkup` for async server components (they cannot use `render` from Testing Library). Mock database at module level with `vi.mock('database', ...)`, then `await` the component function directly.

Note: `renderToStaticMarkup` renders Suspense fallbacks, not async children. Test page-level responsibilities (header, fallback, 404) separately from child component responsibilities (data rendering).
