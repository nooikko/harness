# Research: Next.js App Router Suspense, Streaming, and Data Fetching Patterns
Date: 2026-02-23

## Summary

Deep-dive into Next.js App Router Suspense mechanics, streaming behaviour, async vs sync pages,
route params as Promises, the waterfall anti-pattern, and parallel data fetching strategies.
All findings sourced from official Next.js documentation at version 16.1.6 (last updated 2026-02-20).

## Prior Research

See `AI_RESEARCH/2026-02-23-nextjs16-server-first-patterns.md` for general server-first patterns,
Server Actions, URL state, and caching. This file focuses specifically on Suspense + streaming depth.

## Current Findings

### 1. How Suspense Streaming Works in Next.js App Router

**Core mechanism** (from official docs):

> "When you fetch data in Server Components, the data is fetched and rendered on the server for each
> request. If you have any slow data requests, the whole route will be blocked from rendering until
> all the data is fetched. To improve the initial load time and user experience, you can use
> streaming to break up the page's HTML into smaller chunks and progressively send those chunks from
> the server to the client."

The rendering pipeline:
1. React renders Server Components into the React Server Component Payload (RSC Payload) — a compact
   binary format, NOT HTML.
2. Next.js uses the RSC Payload + Client Component JS instructions to produce HTML.
3. Static content (outside Suspense boundaries) is sent immediately in the first flush.
4. Content inside Suspense boundaries streams in as async work resolves — each boundary streams
   independently.
5. On the client: HTML is used for fast non-interactive preview, RSC Payload reconciles the tree,
   then JS hydrates Client Components.

**What "streaming" actually means:** The HTTP response stays open. As each Suspense boundary
resolves on the server, React serialises that chunk and flushes it into the same HTTP response body.
The browser renders each chunk as it arrives. The response always returns HTTP 200 (headers are
already sent before streaming starts — this is why you cannot change the status code mid-stream).

**Two ways to enable streaming:**

1. `loading.tsx` — wraps the ENTIRE page in a single Suspense boundary automatically.
2. Manual `<Suspense>` — wraps individual components for granular, independent streaming.

### 2. Async Page vs Async Children with Suspense

**Async page (await at page level):**

```tsx
// The page does NOT start streaming until ALL awaited data resolves.
// The entire page is blocked behind the slowest fetch.
export default async function Page() {
  const invoices = await fetchInvoices()  // waits...
  const revenue = await fetchRevenue()    // ...then waits again (sequential!)
  return <Dashboard invoices={invoices} revenue={revenue} />
}
```

This is the simplest pattern and is correct when:
- You need data before you can render ANYTHING meaningful
- All data is fast (or you cache it)
- No UX benefit from partial rendering

**Sync page with async children wrapped in Suspense:**

```tsx
// The page shell renders IMMEDIATELY. Slow children stream in independently.
export default function Page() {
  return (
    <main>
      <h1>Dashboard</h1>                             {/* renders immediately */}
      <Suspense fallback={<CardsSkeleton />}>
        <CardWrapper />                               {/* streams in when ready */}
      </Suspense>
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />                              {/* streams in independently */}
      </Suspense>
    </main>
  )
}

// Data fetch lives inside the async child component
async function CardWrapper() {
  const data = await fetchCardData()
  return <Cards data={data} />
}
```

This is the preferred pattern for pages with slow data, because:
- The static shell (headings, layout) is visible immediately
- Each Suspense boundary resolves and streams independently (parallel)
- Users see progressive disclosure rather than a blank page

**The critical distinction:** When a page `await`s data, the async work blocks the ENTIRE render,
including everything outside of future Suspense boundaries. When async work lives INSIDE Suspense
children, the page shell is sent first and each child resolves independently.

### 3. Should page.tsx Files Be Async?

**Official guidance:** Yes, `page.tsx` files are frequently `async` in the documentation examples
when they need to fetch data or access `params`/`searchParams`.

From the official page.tsx API reference (v16.1.6):

```tsx
// Standard async page with params — the official documented pattern
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  return <h1>{post.title}</h1>
}
```

However, pages can also be **synchronous** when they only render structure and delegate all async
work to Suspense-wrapped children:

```tsx
// Synchronous page — valid when all slow work is in children
export default function BlogPage() {
  return (
    <div>
      <header><h1>Welcome to the Blog</h1></header>
      <main>
        <Suspense fallback={<BlogListSkeleton />}>
          <BlogList />                     {/* BlogList is async, fetches inside */}
        </Suspense>
      </main>
    </div>
  )
}
```

**Rule of thumb from docs:** Make the page `async` when you need to access `params`, `searchParams`,
or data that is required to render the page structure. Make it synchronous (and use Suspense
children) when you want to stream slow data independently.

### 4. Route Params and Suspense — How params Work

**Breaking change in Next.js 15+/16:** `params` and `searchParams` are now **Promises**, not
synchronous objects. This is critical.

From the official page.tsx reference:
> "Since the params prop is a promise, you must use async/await or React's use function to access
> the values. In version 14 and earlier, params was a synchronous prop. To help with backwards
> compatibility, you can still access it synchronously in Next.js 15, but this behavior will be
> deprecated in the future."

**Correct pattern for Server Component pages (async):**

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params       // must await params first
  const data = await fetchData(slug)  // then fetch with resolved value
  return <Article data={data} />
}
```

**Correct pattern for Client Component pages (use() hook):**

```tsx
'use client'
import { use } from 'react'

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = use(params)
  const { query } = use(searchParams)
  // ...
}
```

**Should params be passed as promises to children?**

The recommended pattern from the docs is to `await params` in the page and pass the resolved
values down as props (not the raw Promise):

```tsx
// RECOMMENDED: await in page, pass resolved values
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params           // resolve here
  return <Playlists artistID={id} />    // pass resolved string, not a Promise
}
```

The only case to pass a Promise as a prop is when using the `use()` hook + Suspense streaming
pattern (where the Server Component passes an unawaited data promise to a Client Component):

```tsx
// STREAMING PATTERN: pass unawaited data promise to Client Component
export default function Page() {
  const posts = getPosts()   // NOT awaited — returns Promise
  return (
    <Suspense fallback={<Loading />}>
      <Posts posts={posts} />  {/* Client Component uses use(posts) */}
    </Suspense>
  )
}
```

**Important note on `searchParams`:** Using `searchParams` opts the page into **dynamic rendering**
at request time (cannot be statically pre-rendered).

**Type helper:** Next.js 16 provides a global `PageProps` helper for strongly-typed params:

```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  // ... autocomplete for valid param keys
}
```

### 5. The Waterfall Anti-Pattern

**Definition:** A "waterfall" occurs when sequential `await` statements in a single component
force data fetches to happen one after another, even when they are independent of each other.

**The waterfall anti-pattern:**

```tsx
// ANTI-PATTERN: Sequential (waterfall)
// Total time = getArtist() time + getAlbums() time
export default async function Page({ params }) {
  const { username } = await params
  const artist = await getArtist(username)   // waits for artist first
  const albums = await getAlbums(username)   // THEN waits for albums
  return <div>{artist.name}</div>
}
```

**Why it happens:** Each `await` is a synchronous pause. Even though `getArtist` and `getAlbums`
could be fetched simultaneously (they share the same input `username`), sequential `await`s force
them to run back-to-back.

**The Suspense-streaming solution:** Move each slow fetch into its own async child component,
each wrapped in its own `<Suspense>` boundary. Because Next.js renders layouts and pages in
parallel, each segment's Suspense boundary resolves independently:

```tsx
// SOLUTION: Each component fetches independently, in parallel
export default function Page() {
  return (
    <>
      <Suspense fallback={<CardsSkeleton />}>
        <CardWrapper />      {/* fetches cards data */}
      </Suspense>
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />     {/* fetches revenue data — runs CONCURRENTLY */}
      </Suspense>
    </>
  )
}
```

This solves the waterfall because each `<Suspense>` child can start fetching as soon as the parent
renders — there is no sequential dependency between them.

**When sequential fetching is intentional:** When one piece of data truly depends on another (e.g.,
`Playlists` needs `artist.id`), the sequential pattern is correct but should be made explicit:

```tsx
// LEGITIMATE sequential: Playlists NEEDS artist.id first
export default async function Page({ params }) {
  const { username } = await params
  const artist = await getArtist(username)         // must resolve first

  return (
    <>
      <h1>{artist.name}</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Playlists artistID={artist.id} />         {/* only possible after artist loads */}
      </Suspense>
    </>
  )
}
```

From the docs: "Ensure your data source can resolve the first request quickly, as it blocks
everything else. If you can't optimize the request further, consider caching the result."

### 6. Parallel Data Fetching Patterns with Suspense

**Pattern 1: Promise.all in a single async component**

For independent data within a single component, start all fetches simultaneously and await them
together. Requests begin as soon as the function is called (not at `await`):

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Initiate both requests WITHOUT awaiting them
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  // Now await them together — total time = max(artistTime, albumsTime)
  const [artist, albums] = await Promise.all([artistData, albumsData])

  return (
    <>
      <h1>{artist.name}</h1>
      <Albums list={albums} />
    </>
  )
}
```

Note from docs: "If one request fails when using Promise.all, the entire operation will fail. To
handle this, you can use Promise.allSettled instead."

**Pattern 2: Multiple independent Suspense boundaries (recommended for streaming UX)**

Each component fetches independently; the page shell renders immediately; each boundary streams
in as its data resolves:

```tsx
import { Suspense } from 'react'
import { PostFeed, Weather } from './Components'

export default function Posts() {
  return (
    <section>
      <Suspense fallback={<p>Loading feed...</p>}>
        <PostFeed />          {/* async — fetches inside */}
      </Suspense>
      <Suspense fallback={<p>Loading weather...</p>}>
        <Weather />           {/* async — fetches independently */}
      </Suspense>
    </section>
  )
}
```

**Pattern 3: Preloading (eager initiation before blocking work)**

Kick off a fetch before a blocking operation to reduce total wait time:

```tsx
export default async function Page({ params }) {
  const { id } = await params
  preload(id)                        // fire-and-forget: starts fetching now
  const isAvailable = await checkIsAvailable()  // do blocking work

  return isAvailable ? <Item id={id} /> : null  // Item's data is already in-flight
}

// preload just fires the promise — cached via React.cache
const preload = (id: string) => {
  void getItem(id)
}
```

**Pattern 4: Promise streaming to Client Components via use()**

Server Component initiates fetch without awaiting, passes the raw Promise to a Client Component
that uses React's `use()` hook inside a Suspense boundary:

```tsx
// Server Component — synchronous, just starts the fetch
export default function Page() {
  const posts = getPosts()   // Promise, not awaited

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}

// Client Component — resolves promise via use() hook
'use client'
import { use } from 'react'

export default function Posts({ posts }: { posts: Promise<Post[]> }) {
  const allPosts = use(posts)  // suspends here until resolved

  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

**Pattern 5: React.cache for deduplication across concurrent fetches**

When the same data is needed in multiple components (e.g., in both a layout and a page, or in
`generateMetadata` and the page component), wrap with `React.cache` to prevent duplicate
DB/network calls:

```ts
import { cache } from 'react'

export const getUser = cache(async () => {
  const res = await fetch('https://api.example.com/user')
  return res.json()
})
// Multiple components calling getUser() in the same request → one actual fetch
```

Note from docs: "`React.cache` is scoped to the current request only. Each request gets its own
memoization scope with no sharing between requests."

### 7. loading.tsx vs Manual Suspense — Key Differences

| Feature | `loading.tsx` | Manual `<Suspense>` |
|---|---|---|
| Scope | Entire page/segment | Individual component |
| Placement | Filesystem convention | JSX in any component |
| Granularity | Coarse (whole page) | Fine (any component) |
| Navigation | Interruptible | Interruptible |
| Prefetching | Loading UI is prefetched | Fallback not prefetched |
| Use case | Route-level loading state | Component-level streaming |

From docs: "loading.js will be nested inside layout.js. It will automatically wrap the page.js file
and any children below in a `<Suspense>` boundary."

The docs recommend using BOTH: `loading.tsx` for the overall page skeleton, and nested `<Suspense>`
boundaries for components within the page that have different data dependencies.

### 8. Suspense Boundary Placement Best Practices

From official docs (Next.js Learn course):
- Move data fetches down to the components that need them, then wrap those components in Suspense
- Group related components together to avoid UI "popping" / staggered reveal
- Consider three approaches: stream whole page (coarse), stream every component (maximum
  granularity, may cause jarring), or stream page sections (balanced, recommended)

Specific guidance:
1. Static content (headers, nav, layout shell) should be OUTSIDE Suspense boundaries — renders immediately
2. Slow data-dependent content should be INSIDE Suspense boundaries — streams in
3. Multiple SIBLING Suspense boundaries stream in parallel (independent of each other)
4. NESTED Suspense boundaries create a sequential reveal (inner waits for outer's data? No —
   inner streams independently, but is mounted after outer resolves)

### 9. SEO and Status Code Considerations for Streaming

From the `loading.js` API reference:
- Streaming returns HTTP 200 always (headers sent before body starts streaming)
- `notFound()` and `redirect()` must be called BEFORE any streaming begins (before any `await`
  that triggers a Suspense fallback)
- For SEO: Next.js resolves `generateMetadata` before streaming begins — metadata is in the initial
  `<head>` HTML flush
- If a 404 page is streamed, Next.js adds `<meta name="robots" content="noindex">` to prevent
  indexing even though status is 200

## Key Takeaways

1. **Async page blocks everything** — an `async` page that `await`s data before rendering
   blocks the entire page until all awaited data resolves. Use this only when needed.

2. **Suspense children stream independently** — moving data fetches into async child components
   wrapped in `<Suspense>` allows the page shell to render immediately and each section to
   stream in as its own data resolves.

3. **params is now a Promise** — in Next.js 15+/16, `params` and `searchParams` are `Promise`
   types that must be `await`ed (in async Server Components) or resolved via `use()` (in Client
   Components). Always `await params` at the start of async pages before any other logic.

4. **Parallel fetching within a component: use Promise.all** — call fetch functions without
   `await` first, then `await Promise.all([...])` to run them concurrently. Sequential `await`
   statements create a waterfall even when data is independent.

5. **The waterfall anti-pattern** = sequential `await` for independent data. The Suspense
   solution = each fetch lives in its own async component with its own Suspense boundary.

6. **loading.tsx = coarse, Suspense = fine** — use `loading.tsx` for the full-page loading
   state, and manual `<Suspense>` for granular within-page streaming.

7. **Preloading pattern** — use `void fetchFn()` (fire-and-forget, cached via `React.cache`) to
   start data fetching before blocking operations, reducing perceived latency.

8. **`use()` hook enables promise streaming** — a Server Component can pass an unawaited Promise
   as a prop to a Client Component, which resolves it with `use()` inside a Suspense boundary.

9. **`notFound()` and `redirect()` must precede streaming** — call these before any `await` or
   Suspense fallback triggers, as the HTTP status code cannot be changed after streaming starts.

## Sources

- https://nextjs.org/docs/app/getting-started/fetching-data (v16.1.6, 2026-02-20)
- https://nextjs.org/docs/app/api-reference/file-conventions/page (v16.1.6, 2026-02-20)
- https://nextjs.org/docs/app/api-reference/file-conventions/loading (v16.1.6, 2026-02-20)
- https://nextjs.org/docs/app/getting-started/server-and-client-components (v16.1.6, 2026-02-20)
- https://nextjs.org/learn/dashboard-app/streaming (Next.js Learn course)
- https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/07-fetching-data.mdx
- https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/page.mdx
- https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/loading.mdx
