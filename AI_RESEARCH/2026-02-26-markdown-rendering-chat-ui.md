# Research: Markdown Rendering for Chat UI (Next.js 16 / React 19)
Date: 2026-02-26

## Summary

Comprehensive research on markdown rendering in a Next.js 16 + React 19 chat interface.
Covers library selection (react-markdown vs streamdown vs alternatives), code syntax highlighting
with Shiki, auto-scroll UX patterns for streaming content, XSS security for AI-generated
markdown, and Tailwind CSS v4 typography integration. The project's `message-item.tsx`
currently uses plain `whitespace-pre-wrap` text rendering — no markdown library is installed yet.

## Prior Research

- `2026-02-23-nextjs16-server-first-patterns.md` — Server/Client Component boundary rules
- `2026-02-24-anthropic-api-low-latency-chat.md` — Streaming patterns from the Anthropic SDK

## Current Findings

---

### 1. Library Comparison: react-markdown vs streamdown vs marked vs markdown-it

#### Summary Table

| Library | Bundle (minzipped) | Weekly Downloads | React Integration | Streaming AI | XSS Safe by Default |
|---|---|---|---|---|---|
| **streamdown** | 69.1 kB (core only; plugins extra) | 904,776 | Client Component | Native (built for it) | Yes (dual-layer) |
| **react-markdown** | ~52.6 kB | 8.6 million | Both Server + Client | Partial (MarkdownAsync) | Yes (no dangerouslySetInnerHTML) |
| **marked** | 433 kB | 19.6 million | No (requires dangerouslySetInnerHTML) | No | No |
| **markdown-it** | 767 kB | 12.1 million | No (requires dangerouslySetInnerHTML) | No | No |

Note: `marked` and `markdown-it` produce HTML strings. To render them in React, you must use
`dangerouslySetInnerHTML`, which immediately disqualifies them from safe-by-default usage in
an AI chat interface. Their raw download numbers are high because they are used in non-React
contexts (Node.js scripts, static site generators, etc.).

#### react-markdown (v10.1.0) — The Established Standard

**Architecture:** Built on remark (markdown parser) + rehype (HTML transformer). Converts
markdown to React elements — never HTML strings. Zero use of `dangerouslySetInnerHTML`.

**Three exported components:**

1. `Markdown` — Synchronous. Use for static/pre-loaded content. Works in **both Server Components
   and Client Components** (Confidence: HIGH — verified from GitHub README).

2. `MarkdownAsync` — Async with `async/await`. Designed for Server Components where async
   plugins (e.g., async rehype transformers) must resolve on the server. This is the correct
   choice for a Next.js 16 Server Component that renders stored message history.

3. `MarkdownHooks` — Async via `useEffect` + `useState`. Client-only. Used when you need
   async plugins on the client side. Includes a `fallback` prop for rendering while processing.

**Plugin ecosystem:**
- `remark-gfm` — GitHub Flavored Markdown: tables, strikethrough, task lists, autolinks
- `rehype-sanitize` — whitelist-based HTML sanitization
- `rehype-highlight` / `rehype-pretty-code` — syntax highlighting via highlight.js / Shiki

**Key limitations:**
- No built-in streaming-specific handling — if markdown arrives token-by-token, incomplete
  blocks (unclosed code fences, unterminated bold, etc.) may cause visual flicker or incorrect
  rendering mid-stream.
- Bundle size grew significantly from v5 (~23.5 kB) to v10 (~52.6 kB) due to unified ecosystem
  dependencies.

**Confidence: HIGH** (official GitHub README + npm + bundlephobia data)

#### streamdown (v2.x) — Vercel's AI-Native Alternative

Vercel built `streamdown` specifically for AI streaming scenarios. It powers the official
Vercel AI Elements `<Response>` component.

**Key differentiators over react-markdown:**
- Handles incomplete markdown blocks gracefully (unclosed code fences, unterminated bold, etc.)
  — critical when content arrives token-by-token from an LLM
- Built-in caret/cursor indicator showing generation is in progress
- Smooth animations during content delivery
- Built-in dual-layer security: `rehype-sanitize` (GitHub schema) + `rehype-harden` (protocol
  and domain allowlisting)
- Built-in Shiki-powered code syntax highlighting via `@streamdown/code` plugin
- LaTeX via `@streamdown/math`, Mermaid diagrams via `@streamdown/mermaid` (optional plugins)
- 904,776 weekly downloads (already surpassing react-markdown for AI-specific use)

**Plugin architecture (v2):** Tree-shakeable. Core is lean; add only what you need:
- `@streamdown/code` — Shiki highlighting, copy button, language labels
- `@streamdown/mermaid` — interactive diagrams
- `@streamdown/math` — KaTeX equations
- `@streamdown/cjk` — CJK punctuation handling

**Limitations:**
- Client Component only — cannot run in a Next.js Server Component (uses React hooks internally)
- Relatively newer; smaller community than react-markdown
- v2 is a major rewrite with plugin architecture breaking changes from v1

**Confidence: HIGH** (Vercel changelog, GitHub repo, streamdown.ai docs)

#### Recommendation for this project

For a chat interface that renders **stored messages from the database** (non-streaming):
- `react-markdown` with `MarkdownAsync` in a Server Component is the cleanest fit
- It avoids a client bundle entirely for historical messages

For **streaming real-time AI responses** (tokens arriving incrementally):
- `streamdown` is the correct choice — it handles incomplete blocks and provides a caret
- Must be a Client Component (`'use client'`)

**The split architecture** (Server Component for history, Client Component for live streaming)
matches this project's existing patterns in `message-list.tsx` and `ws-provider.tsx`.

---

### 2. Code Syntax Highlighting

#### Option A: rehype-pretty-code + Shiki (with react-markdown)

The most feature-rich server-side approach for react-markdown:

```bash
npm install rehype-pretty-code shiki
```

```tsx
import { MarkdownAsync } from 'react-markdown';
import rehypePrettyCode from 'rehype-pretty-code';

const options = {
  theme: {
    dark: 'github-dark',
    light: 'github-light',
  },
};

// In a Server Component — runs at build/request time, zero client JS
const AssistantMessage = async ({ content }: { content: string }) => (
  <MarkdownAsync rehypePlugins={[[rehypePrettyCode, options]]}>
    {content}
  </MarkdownAsync>
);
```

**Key:** rehype-pretty-code is ESM-only, requires Shiki >= 1.0.0. It works at **build time /
server request time** — the syntax highlighting runs on the server and ships styled HTML to
the client. No client-side Shiki bundle needed.

**Confidence: HIGH** (rehype-pretty.pages.dev official docs)

#### Option B: react-shiki (with react-markdown, client-side)

For client-rendered markdown with real-time highlighting during streaming:

```bash
npm install react-shiki shiki
```

```tsx
'use client';
import { Markdown } from 'react-markdown';
import { ShikiHighlighter } from 'react-shiki';
import remarkGfm from 'remark-gfm';

const MarkdownRenderer = ({ content }: { content: string }) => (
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ node, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const isBlock = node?.tagName !== 'code' || !!match;
        if (!isBlock) return <code className={className} {...props}>{children}</code>;
        return (
          <ShikiHighlighter language={match?.[1] ?? 'text'} theme="github-dark">
            {String(children).replace(/\n$/, '')}
          </ShikiHighlighter>
        );
      },
    }}
  >
    {content}
  </Markdown>
);
```

**Bundle sizes for react-shiki:**
- Full bundle (`react-shiki`): ~1.2 MB gzipped — too large for most apps
- Web bundle (`react-shiki/web`): ~707 KB gzipped — web-focused languages
- Core bundle (`react-shiki/core`): ~12 KB + cherry-picked languages — production choice

**Confidence: HIGH** (react-shiki GitHub README, bundlephobia)

#### Option C: @streamdown/code (with streamdown)

Bundled with streamdown's plugin architecture:

```bash
npm install streamdown @streamdown/code
```

```tsx
'use client';
import { Streamdown } from 'streamdown';
import { CodePlugin } from '@streamdown/code';

const StreamingMessage = ({ content, isStreaming }: { content: string; isStreaming: boolean }) => (
  <Streamdown
    plugins={[CodePlugin]}
    animate={isStreaming}
    shikiTheme={['github-light', 'github-dark']}
  >
    {content}
  </Streamdown>
);
```

Features included: copy button, download button, language label, dual light/dark themes,
lazy-loaded language grammars (only downloads grammars you actually use).

**Confidence: HIGH** (streamdown.ai docs)

#### Inline code vs block code

In react-markdown v10, the `inline` prop on code components was removed. To distinguish:
- Block code has a `className` matching `/language-(\w+)/`
- Inline code has no className

```tsx
components={{
  code({ className, children, ...props }) {
    const isBlock = /language-(\w+)/.test(className ?? '');
    if (!isBlock) {
      return <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono" {...props}>{children}</code>;
    }
    // block code — render with highlighter
  }
}}
```

---

### 3. Auto-Scroll Patterns for Streaming Chat

#### The Core Challenge

Streaming chat has two competing scroll requirements:
1. Auto-scroll to bottom when new content arrives (good UX by default)
2. Stop auto-scrolling if the user manually scrolls up to review earlier messages (respect intent)

#### Pattern A: Simple Sentinel Anchor (Basic)

Place an empty `div` at the bottom of the message list. Scroll it into view on new content.

```tsx
'use client';
import { useEffect, useRef } from 'react';

type ChatScrollProps = { messages: unknown[]; isStreaming: boolean };

const ChatMessages = ({ messages, isStreaming }: ChatScrollProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {/* message rendering */}
      <div ref={bottomRef} />
    </div>
  );
};
```

**Limitation:** Overrides user scroll position even when the user intentionally scrolled up.

#### Pattern B: Intersection Observer with User Intent Detection (Recommended)

The preferred production pattern for AI chat apps. Uses `IntersectionObserver` to detect
whether the user is "at the bottom" before deciding to auto-scroll.

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

type UseAutoScrollOptions = { isStreaming: boolean };

const useAutoScroll = (dep: unknown, { isStreaming }: UseAutoScrollOptions) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Detect when user scrolls away from bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsAtBottom(entry?.isIntersecting ?? false),
      { root: container, threshold: 0.1 },
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll only if user is at bottom OR new message just arrived
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
    }
  }, [dep, isAtBottom, isStreaming]);

  return { containerRef, bottomRef };
};
```

**Key behaviors:**
- `isAtBottom: true` → auto-scroll as content arrives
- User scrolls up → `isAtBottom: false` → no forced scroll
- New user message submitted → force scroll to bottom (reset `isAtBottom`)
- Use `behavior: 'instant'` during streaming (avoids competing smooth-scroll animations),
  `behavior: 'smooth'` for discrete new message events

#### Pattern C: Custom scrollTop Detection

Alternative without Intersection Observer — check scroll position manually:

```tsx
const isUserAtBottom = (container: HTMLElement) => {
  const threshold = 100; // px from bottom to consider "at bottom"
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
};
```

#### Initial Load: Prevent Scroll Animation

On first render (loading historical messages), always scroll `instant` — not `smooth`:

```tsx
const hasLoadedRef = useRef(false);

useEffect(() => {
  if (!hasLoadedRef.current) {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    hasLoadedRef.current = true;
  }
}, []);
```

#### Bottom Padding for Last Message

AI responses often have the last line cut off at the bottom edge of the scroll container.
Add bottom padding only to the last message:

```tsx
// In message list
messages.map((msg, i) => (
  <MessageItem
    key={msg.id}
    message={msg}
    className={i === messages.length - 1 ? 'pb-[10vh]' : ''}
  />
))
```

**Confidence: HIGH** (multiple authoritative blog sources, tuffstuff9.hashnode.dev,
jhakim.com/blog, davelage.com)

---

### 4. XSS Security for AI-Generated Markdown

#### Why This Matters for AI Responses

LLM outputs are user-influenced (prompt injection attacks can cause an AI to emit markdown
containing malicious HTML). Rendering raw LLM markdown without sanitization is dangerous.

#### Attack Vectors

1. `javascript:` protocol in links: `[click me](javascript:alert('xss'))`
2. `data:` URIs with scripts in image src
3. Injected `<script>` tags via raw HTML in markdown
4. Event handlers in HTML attributes: `<img src=x onerror="...">`
5. CSS injection via `<style>` tags
6. DOM clobbering via `id="__next"` or other critical IDs

#### react-markdown Default Safety

react-markdown is **safe by default** — no `dangerouslySetInnerHTML`. Its `defaultUrlTransform`
strips everything except these protocols: `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp`,
and relative paths. `javascript:` and `data:` URIs are stripped without configuration.

However, if you add `rehype-raw` (for rendering embedded HTML from markdown), you re-open XSS
risks and **must** add `rehype-sanitize` after it.

#### rehype-sanitize: GitHub Schema (Recommended)

The default schema follows GitHub's sanitization rules — a proven, conservative baseline:

```tsx
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// For basic AI message rendering — defaultSchema is sufficient
<Markdown rehypePlugins={[rehypeSanitize]}>
  {content}
</Markdown>

// If you need rehype-raw (embedded HTML), always pair with sanitize:
<Markdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
  {content}
</Markdown>
```

Blocked by defaultSchema: `<script>`, `<object>`, `<embed>`, `<applet>`, `<style>`,
`<link>`, `<meta>`, `<base>`, all event handlers (`onclick`, `onerror`, etc.), `javascript:`
URLs, `data:` URIs, `xlink:href` with non-http protocols.

DOM clobbering prevention: `defaultSchema` prefixes `id` and `name` attributes with
`'user-content-'` to prevent collision with global DOM properties.

#### Stricter Configuration for AI Content

For AI-generated markdown specifically, even tighter control is recommended:

```tsx
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const strictSchema = {
  ...defaultSchema,
  // Remove SVG, math elements (not needed in chat, add attack surface)
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tag) => !['svg', 'math'].includes(tag)
  ),
  attributes: {
    ...defaultSchema.attributes,
    // Explicitly block ALL on* event handlers (belt + suspenders)
    '*': (defaultSchema.attributes?.['*'] ?? []).filter(
      (attr) => !(typeof attr === 'string' && attr.startsWith('on'))
    ),
  },
};

<Markdown rehypePlugins={[[rehypeSanitize, strictSchema]]}>
  {content}
</Markdown>
```

#### allowedElements / disallowedElements (react-markdown built-in)

Without any plugins, you can restrict which elements render:

```tsx
// Only allow safe formatting elements — no iframes, scripts, etc.
<Markdown
  allowedElements={['p', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th']}
  urlTransform={(url) => {
    // Extra safety — only allow http/https
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      return url;
    }
    return '#'; // block javascript:, data:, etc.
  }}
>
  {content}
</Markdown>
```

#### streamdown Security (Built-In)

streamdown ships dual-layer protection out of the box:
1. `rehype-sanitize` with GitHub schema — blocks dangerous elements/attributes
2. `rehype-harden` — restricts URL protocols and image source domains

For AI-generated content, streamdown docs recommend stricter configs to guard against
prompt injection attacks specifically.

#### Content Security Policy (Defense in Depth)

Add a CSP header as a last line of defense. Even if rendering is misconfigured:

```
Content-Security-Policy: script-src 'self'; object-src 'none'; base-uri 'none';
```

**Confidence: HIGH** (react-markdown GitHub README, rehype-sanitize GitHub README,
streamdown.ai/docs/security, hackerone.com blog)

---

### 5. Tailwind CSS v4 + @tailwindcss/typography Integration

#### The Problem

Tailwind CSS v4's preflight reset removes default browser styling for semantic HTML elements
(`h1`-`h6`, `ul`, `ol`, `strong`, etc.). react-markdown outputs raw semantic HTML that relies
on these defaults. Without the typography plugin, rendered markdown is completely unstyled.

**Confirmed issue:** https://github.com/tailwindlabs/tailwindcss/discussions/17645

#### Solution: @tailwindcss/typography

```bash
npm install -D @tailwindcss/typography
```

In Tailwind v4, configure via CSS (not `tailwind.config.js`):

```css
/* In your global CSS file */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Apply with `prose` class:

```tsx
<div className="prose prose-sm dark:prose-invert max-w-none">
  <Markdown>{content}</Markdown>
</div>
```

#### Prose Classes for Chat UI

```tsx
// Compact sizing for chat messages
className="prose prose-sm dark:prose-invert max-w-none"

// max-w-none removes the 65ch max-width constraint (important in chat bubbles)
// prose-sm uses 14px body text — appropriate for chat messages
// prose-invert for dark backgrounds (assistant message bubbles)
```

#### Custom Overrides for Chat Bubbles

The `prose-*` element modifiers allow scoped customization:

```tsx
// For user messages (light text on dark background)
className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-pre:my-2"

// Tighter vertical spacing than default prose (which has generous margins for articles)
```

**Confidence: HIGH** (tailwindcss-typography GitHub README, Tailwind v4 upgrade guide)

---

## Key Takeaways

### Architecture Decision (Split by Use Case)

```
Historical messages (Server Component)
  → react-markdown (MarkdownAsync) + rehype-pretty-code
  → Syntax highlighting runs on server, zero client Shiki bundle
  → + rehype-sanitize (GitHub schema)
  → + remark-gfm (tables, task lists)
  → Wrap with: className="prose prose-sm dark:prose-invert max-w-none"

Streaming live message (Client Component)
  → streamdown + @streamdown/code (Shiki, lazy-loaded grammars)
  → OR react-markdown (Markdown) + react-shiki/core + cherry-picked languages
  → Built-in dual-layer security (streamdown) or add rehypeSanitize (react-markdown)
```

### Version-Specific Gotchas

1. **react-markdown v10 — inline code prop removed.** Detect inline code by absence of
   `language-*` className, not the deprecated `inline` boolean prop.

2. **Tailwind v4 — use `@plugin` directive in CSS,** not `plugins: []` in JS config.
   Install `@tailwindcss/typography` and add `@plugin "@tailwindcss/typography"` to CSS.

3. **rehype-pretty-code requires ESM** and Shiki >= 1.0.0.

4. **streamdown v2 is a breaking change** from v1 — features moved to separate `@streamdown/*`
   packages. If updating from v1, all features must be re-imported as plugins.

5. **rehype-raw opens XSS risk.** Never use without `rehype-sanitize` immediately after it
   in the plugin array. Order matters: `[rehypeRaw, rehypeSanitize]`.

6. **Auto-scroll: use `behavior: 'instant'`** during streaming to avoid fighting with
   smooth-scroll animations as the content changes 10-30 times per second.

### Bundle Size Summary

| What | Size |
|---|---|
| `react-markdown` alone | ~52.6 kB min+gz |
| `remark-gfm` | ~15 kB |
| `rehype-sanitize` | ~4 kB |
| `rehype-pretty-code` (runs server-side) | 0 client cost |
| `streamdown` core | 69.1 kB |
| `@streamdown/code` (Shiki, lazy grammars) | varies by languages used |
| `react-shiki/core` | ~12 kB + languages |

## Sources

- [react-markdown GitHub (v10)](https://github.com/remarkjs/react-markdown)
- [streamdown GitHub — Vercel's AI streaming markdown](https://github.com/vercel/streamdown)
- [streamdown.ai docs](https://streamdown.ai/)
- [streamdown v2 changelog — Vercel](https://vercel.com/changelog/streamdown-v2)
- [rehype-pretty-code official docs](https://rehype-pretty.pages.dev/)
- [react-shiki GitHub](https://github.com/AVGVSTVS96/react-shiki)
- [rehype-sanitize GitHub](https://github.com/rehypejs/rehype-sanitize)
- [tailwindcss-typography GitHub](https://github.com/tailwindlabs/tailwindcss-typography)
- [Tailwind v4 + react-markdown issue](https://github.com/tailwindlabs/tailwindcss/discussions/17645)
- [npm-compare: marked vs markdown-it vs react-markdown](https://npm-compare.com/marked,markdown-it,react-markdown,markdown)
- [react-markdown v10 bundlephobia](https://bundlephobia.com/package/react-markdown)
- [Chat scroll patterns — Dave Lage](https://davelage.com/posts/chat-scroll-react/)
- [AI chat scroll patterns — jhakim.com](https://jhakim.com/blog/handling-scroll-behavior-for-ai-chat-apps)
- [Intuitive chatbot streaming scroll — tuffstuff9](https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming)
- [shadcn AI Code Block component](https://www.shadcn.io/ai/code-block)
- [Vercel AI Elements — Streamdown integration](https://vercel.com/academy/ai-sdk/ai-elements)
- [Strapi — react-markdown security guide](https://strapi.io/blog/react-markdown-complete-guide-security-styling)
- [HackerOne — Secure markdown rendering in React](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
