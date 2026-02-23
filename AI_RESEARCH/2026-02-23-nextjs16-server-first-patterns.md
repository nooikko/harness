# Research: Next.js 16 App Router Server-First Patterns
Date: 2026-02-23

## Summary

Comprehensive documentation of Next.js 16 (v16.1.6) server-first rendering patterns sourced
directly from the official Next.js GitHub repository docs. Covers all major patterns: Server
Components as default, Suspense + `use()` streaming, `loading.tsx`, Server Actions, URL-based
state, cache invalidation, streaming mechanics, data fetching, and when `use client` is appropriate.

## Prior Research
None found in AI_RESEARCH/ for this topic.

## Current Findings

### 1. Server Components as Default

All layouts and pages in the App Router are Server Components by default. No directive is needed.
The architecture: Server Components fetch data and render static structure, Client Components handle
only interactivity. `use client` files mark the boundary — everything imported from that file also
becomes part of the client bundle.

Key rule from docs:
> "By default, layouts and pages are Server Components, which lets you fetch data and render parts
> of your UI on the server, optionally cache the result, and stream it to the client."

**Pattern**: Fetch in the Server Component, pass resolved data as props to a `'use client'`
component that only handles interactivity:

```tsx
// app/page.tsx — Server Component (no directive needed)
import HomePage from './home-page'

async function getPosts() {
  const res = await fetch('https://...')
  return res.json()
}

export default async function Page() {
  const recentPosts = await getPosts()
  return <HomePage recentPosts={recentPosts} />
}
```

```tsx
// app/home-page.tsx — Client Component (only needs client for interactivity)
'use client'

export default function HomePage({ recentPosts }) {
  return (
    <div>
      {recentPosts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

### 2. Passing Promises to Suspense / `use()` Hook

The new streaming pattern: start async work in a Server Component WITHOUT awaiting it, pass the
raw Promise as a prop to a Client Component, which resolves it with React's `use()` hook. The
Client Component must be wrapped in `<Suspense>`.

```tsx
// app/page.tsx — Server Component
import Posts from '@/app/ui/posts'
import { Suspense } from 'react'

export default function Page() {
  // Do NOT await — pass the promise directly
  const posts = getPosts()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts posts={posts} />
    </Suspense>
  )
}
```

```tsx
// app/ui/posts.tsx — Client Component
'use client'
import { use } from 'react'

export default function Posts({
  posts,
}: {
  posts: Promise<{ id: string; title: string }[]>
}) {
  const allPosts = use(posts)  // use() suspends until the promise resolves

  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

The `use()` hook integrates with React Suspense — the Suspense fallback renders while the promise
is pending, then the real content streams in.

### 3. loading.tsx

Place a `loading.tsx` file in any route folder. Next.js automatically wraps the `page.tsx` in a
`<Suspense>` boundary. The loading UI is shown immediately (it can be prefetched) while page data
loads.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <p>Loading...</p>  // or a skeleton component
}
```

Docs quote:
> "To use streaming in Next.js, create a `loading.tsx` file in your route folder. Behind the
> scenes, Next.js will automatically wrap the `page.tsx` contents in a `<Suspense>` boundary."

For granular control within a page, use `<Suspense>` directly instead of relying on `loading.tsx`:

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import BlogList from '@/components/BlogList'
import BlogListSkeleton from '@/components/BlogListSkeleton'

export default function BlogPage() {
  return (
    <div>
      <header>
        <h1>Welcome to the Blog</h1>
      </header>
      <main>
        <Suspense fallback={<BlogListSkeleton />}>
          <BlogList />
        </Suspense>
      </main>
    </div>
  )
}
```

Multiple Suspense boundaries stream independently:

```tsx
import { Suspense } from 'react'
import { PostFeed, Weather } from './Components'

export default function Posts() {
  return (
    <section>
      <Suspense fallback={<p>Loading feed...</p>}>
        <PostFeed />
      </Suspense>
      <Suspense fallback={<p>Loading weather...</p>}>
        <Weather />
      </Suspense>
    </section>
  )
}
```

### 4. Server Actions

Server Actions are async functions marked with `'use server'`. They can be invoked directly from
`<form action={...}>` without an API route. Forms work with and without JavaScript (progressive
enhancement).

**Basic form with Server Action:**

```tsx
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')
  // mutate database...
  revalidatePath('/posts')
}
```

```tsx
// app/new-post/page.tsx — Server Component, no 'use client' needed
import { createPost } from '@/app/actions'

export function Form() {
  return (
    <form action={createPost}>
      <input type="text" name="title" />
      <input type="text" name="content" />
      <button type="submit">Create</button>
    </form>
  )
}
```

**With pending state and validation errors — `useActionState`** (requires `'use client'`):

```tsx
'use client'

import { useActionState } from 'react'
import { createUser } from '@/app/actions'

const initialState = { message: '' }

export function Signup() {
  const [state, formAction, pending] = useActionState(createUser, initialState)

  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input type="text" id="email" name="email" required />
      <p aria-live="polite">{state?.message}</p>
      <button disabled={pending}>Sign up</button>
    </form>
  )
}
```

**Server Action with redirect after mutation:**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  // mutate database...
  revalidatePath('/posts')  // bust cache before redirect
  redirect('/posts')        // throws — no code after this runs
}
```

Note: `redirect()` throws a control-flow exception. Call it outside try/catch, after any
`revalidatePath`/`revalidateTag` calls.

### 5. URL-Based State Management

**Server-side (read)**: The `searchParams` prop on a page is a `Promise` (in Next.js 15+/16) that
must be awaited. Using it opts the page into dynamic rendering.

```tsx
// app/shop/page.tsx — Server Component reads URL state directly
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { page = '1', sort = 'asc', query = '' } = await searchParams

  const results = await getSearchResults(query)

  return (
    <div>
      <p>Search query: {query}</p>
      <p>Current page: {page}</p>
    </div>
  )
}
```

**Client-side (write)**: Use `useRouter` + `useSearchParams` in a `'use client'` component to
update URL state without full navigation:

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCallback } from 'react'

export default function SortControls() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  return (
    <>
      <button onClick={() => router.push(pathname + '?' + createQueryString('sort', 'asc'))}>
        ASC
      </button>
      <Link href={pathname + '?' + createQueryString('sort', 'desc')}>DESC</Link>
    </>
  )
}
```

For shallow updates (no re-render of Server Components), use `window.history.pushState` directly:

```tsx
'use client'
import { useSearchParams } from 'next/navigation'

export default function SortProducts() {
  const searchParams = useSearchParams()

  function updateSorting(sortOrder: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sortOrder)
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  return (
    <>
      <button onClick={() => updateSorting('asc')}>Sort Ascending</button>
      <button onClick={() => updateSorting('desc')}>Sort Descending</button>
    </>
  )
}
```

### 6. revalidatePath / revalidateTag

**revalidatePath** — invalidate by URL path. Signature: `revalidatePath(path, type?)`

```ts
import { revalidatePath } from 'next/cache'

// Revalidate a specific URL
revalidatePath('/blog/post-1')

// Revalidate all pages matching a dynamic route pattern
revalidatePath('/product/[slug]', 'page')

// Revalidate a layout and all nested pages
revalidatePath('/posts', 'layout')
```

**revalidateTag** — invalidate by cache tag. Tag data at fetch-time, invalidate by tag later.

```ts
// Tag data at fetch time
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
})

// Or with 'use cache' + cacheTag (new in Next.js 15/16):
import { cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```

```ts
// Invalidate by tag in a Server Action
'use server'
import { revalidateTag } from 'next/cache'

export async function updatePost(id: string) {
  await db.posts.update(id, data)
  revalidateTag('posts')         // invalidate list
  revalidateTag(`post-${id}`)    // invalidate individual item
}
```

**Combined pattern** (revalidatePath + updateTag for full coverage):

```ts
'use server'
import { revalidatePath, updateTag } from 'next/cache'

export async function updatePost() {
  await updatePostInDatabase()
  revalidatePath('/blog')    // revalidate specific page
  updateTag('posts')         // revalidate all tagged data
}
```

Note: `updateTag` (new in v16) supports stale-while-revalidate semantics via a second `'max'`
argument, recommended over bare `revalidateTag` when fresh content can be served in background.

### 7. Streaming Mechanics

From the docs:
> "On the server, Next.js uses React's APIs to orchestrate rendering. The rendering work is split
> into chunks: by individual route segments and Suspense boundaries. Each chunk is rendered in two
> steps: 1. React renders Server Components into a special data format optimized for streaming
> called the React Server Component Payload. 2. Next.js uses the RSC Payload and Client Component
> JavaScript instructions to render HTML on the server."

Key behaviors:
- Static content outside Suspense boundaries is sent immediately
- Content inside Suspense boundaries streams in as async work completes
- Multiple independent Suspense boundaries stream in parallel
- Selective hydration: React prioritizes interactive components based on user interaction

From the docs:
> "Streaming allows the server to send parts of a dynamic route to the client as soon as they're
> ready, rather than waiting for the entire route to be rendered."

### 8. Data Fetching Patterns in Server Components

**fetch API directly** (no useEffect, no API route, no client state):

```tsx
// app/page.tsx
export default async function Page() {
  const data = await fetch('https://api.vercel.app/blog')
  const posts = await data.json()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

**ORM/database directly in Server Component**:

```tsx
import { db, posts } from '@/lib/db'

export default async function Page() {
  const allPosts = await db.select().from(posts)
  return (
    <ul>
      {allPosts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

**React.cache for deduplication** — when the same data is needed in multiple components in the
same request (e.g., in both `generateMetadata` and the page), wrap with `cache` to prevent
duplicate DB/network calls:

```ts
import { cache } from 'react'
import { db } from '@/app/lib/db'

// Called N times in one request — only executes once
export const getPost = cache(async (slug: string) => {
  return db.query.posts.findFirst({ where: eq(posts.slug, slug) })
})
```

**New `'use cache'` directive** (Next.js 15+/16) — cache any function result, including DB queries,
beyond just `fetch`:

```ts
import { cacheTag, cacheLife } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheTag('products')
  cacheLife('hours')  // revalidate every few hours

  return db.query('SELECT * FROM products')
}
```

### 9. When 'use client' IS Appropriate

From the docs:
> "Use Client Components when you need state and event handlers (e.g., `onClick`, `onChange`),
> lifecycle logic (e.g., `useEffect`), browser-only APIs (e.g., `localStorage`, `window`,
> `Navigator.geolocation`), or custom hooks."

The `'use client'` directive only needs to be added to files whose components are rendered
DIRECTLY within Server Components — it does NOT need to be on every file. Everything a `'use client'`
file imports is automatically included in the client bundle.

Appropriate uses:
- Click/change event handlers (`onClick`, `onChange`)
- `useState`, `useReducer`, `useEffect`
- Browser APIs: `localStorage`, `window`, geolocation, WebSocket
- Custom hooks that use any of the above
- `useSearchParams`, `useRouter`, `usePathname`
- `useActionState` for form pending/error state

```tsx
'use client'
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>{count} likes</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  )
}
```

Server Actions can still be called from Client Components via event handlers:

```tsx
'use client'
import { incrementLike } from './actions'
import { useState } from 'react'

export default function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)

  return (
    <button
      onClick={async () => {
        const updatedLikes = await incrementLike()
        setLikes(updatedLikes)
      }}
    >
      Like ({likes})
    </button>
  )
}
```

## Key Takeaways

1. **Default is server** — never add `'use client'` unless you need interactivity or browser APIs
2. **searchParams is now a Promise** in Next.js 15+/16 — must be `await`ed in Server Components
3. **`loading.tsx` = automatic Suspense** around the whole page; manual `<Suspense>` for granular
4. **`redirect()` throws** — call `revalidatePath`/`revalidateTag` before it, outside try/catch
5. **`use()` hook** enables streaming of promises from Server to Client Components
6. **`'use cache'` + `cacheTag`** is the new way to cache anything (not just fetch) in Next.js 16
7. **`updateTag`** (new in v16) is preferred over `revalidateTag` — supports stale-while-revalidate
8. **`React.cache`** deduplicates same-request fetches; scoped to a single render pass only
9. **Server Components cannot use state, effects, or browser APIs** — that is the boundary rule

## Sources
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/05-server-and-client-components.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/07-fetching-data.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/08-updating-data.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/09-caching-and-revalidating.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/04-linking-and-navigating.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/01-getting-started/03-layouts-and-pages.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/03-file-conventions/loading.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/04-functions/use-search-params.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/01-directives/use-client.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/01-directives/use-cache-remote.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/04-functions/updateTag.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/caching.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/forms.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/redirecting.mdx
- https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/04-glossary.mdx
