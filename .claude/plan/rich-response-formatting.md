# Plan: Code Block Enhancement (Syntax Highlighting + Copy)

## Summary

Upgrade the existing markdown renderer's code block handling with syntax highlighting via `prism-react-renderer`, a copy-to-clipboard button, a language badge, and collapse for long blocks. **No custom block format needed** — react-markdown + remarkGfm already handles GFM tables, code fences with language tags, lists, and all standard markdown. Claude already outputs standard markdown. We just need to render it better.

## Current State

**Already works (via react-markdown + remarkGfm):**
- GFM tables (pipe-delimited with headers)
- Code fences with language tags (` ```python `)
- Task lists, strikethrough, emphasis, links, headings, blockquotes
- All standard markdown formatting

**What's missing:**
- Syntax highlighting (code blocks are unstyled plain text)
- Copy-to-clipboard button on code blocks
- Language badge showing the language name
- Collapse for long code blocks (>30 lines)

**Existing components to build on:**
- `markdown-content.tsx` — already detects `className.startsWith('language-')` for block-level code (line 25)
- `collapsible-block.tsx` — reusable collapsible pattern used by `ThinkingBlock`

## Implementation

### Step 1: Install prism-react-renderer

```bash
pnpm --filter web add prism-react-renderer
```

### Step 2: Create `code-block.tsx`

**File:** `apps/web/src/app/(chat)/chat/_components/code-block.tsx`

```typescript
// Props: language (from className), children (code text)
// Features:
// - prism-react-renderer for syntax highlighting
// - Language badge (top-right corner)
// - Copy button (top-right, shows "Copied!" feedback)
// - Line numbers (optional, off by default)
// - If >30 lines: wrap in CollapsibleBlock (default collapsed)
```

### Step 3: Wire into markdown-content.tsx

Modify the `code` component override (line 24-37) to route block-level code to the new `CodeBlock` component instead of a bare `<code>` tag:

```typescript
code: ({ className, children, ...props }) => {
  const match = className?.match(/^language-(.+)$/);
  if (match) {
    return <CodeBlock language={match[1]}>{String(children)}</CodeBlock>;
  }
  // Inline code unchanged
  return <code className='rounded bg-muted px-1.5 py-0.5 text-[0.875em] font-mono' {...props}>{children}</code>;
};
```

### Step 4: Tests

- Test CodeBlock renders with highlighting
- Test copy button copies content
- Test collapse behavior for long blocks
- Test fallback for unknown languages

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/(chat)/chat/_components/code-block.tsx` | Create | Syntax-highlighted code with copy + collapse |
| `apps/web/src/app/(chat)/chat/_components/markdown-content.tsx` | Modify | Route block code to CodeBlock |
| `apps/web/package.json` | Modify | Add prism-react-renderer |

## Dependencies

```json
{
  "prism-react-renderer": "^2.0.0"
}
```

## What This Does NOT Include

- **Custom `<harness-block>` XML format** — unnecessary. Claude already outputs markdown, and the renderer handles it.
- **Custom table renderer** — GFM tables work already via remarkGfm.
- **Callout blocks** — can be added later if needed as a Phase 2, but standard markdown blockquotes serve the purpose.
- **System prompt changes** — none needed. Claude already outputs code fences with language tags.

## Future: Phase 2 (Only If Needed)

If structured callout boxes (info/warning/error) become a real need, they can be added as a remark plugin that recognizes a convention like `> [!NOTE]` (GitHub-style admonitions) — no custom XML needed.
