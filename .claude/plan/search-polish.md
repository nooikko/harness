# Plan: Search Polish (Highlighting, Recent Searches, Filter Chips)

## Summary

Three client-side polish features for the Cmd+K search palette. All changes are in `apps/web/src/app/_components/` — no API or backend changes needed.

## Design Decisions

- **Highlighting is client-side** — the API already returns `preview` text and the client knows `searchTerms`. No reason to change the API response shape. Split preview text on matched words and wrap matches in `<mark>`.
- **Recent searches in localStorage** — key `harness:recent-searches`, stores last 8 raw query strings (including filters). Shown as a `CommandGroup` when the input is empty.
- **Filter chips use Badge from @harness/ui** — `outline` variant with an X button. Chips sit between `CommandInput` and `CommandList`. Removing a chip rewrites the query string by stripping that filter's text.
- **Filter parsing is duplicated client-side** — the same `parseFilters` logic runs on the client to show chips without a round-trip. Import directly since it's pure string manipulation with no server dependencies.

## Implementation Steps

### Step 1: Highlight helper (`highlight-matches.tsx`)

Create `apps/web/src/app/_components/_helpers/highlight-matches.tsx`

A pure function that takes `(text: string, query: string)` and returns `React.ReactNode[]` — an array of text spans and `<mark>` elements.

```tsx
// Split query into words, escape regex specials, build pattern
// Case-insensitive match, split text on pattern boundaries
// Wrap matched segments in <mark className="bg-yellow-200/30 text-foreground rounded-sm">
// Return array of ReactNode (strings + mark elements)
```

Edge cases:
- Empty query → return text as-is
- Regex special chars in query (`.`, `*`, `(`) → escape before building RegExp
- No matches → return text as-is (no empty marks)
- HTML in preview text → safe because React escapes strings, we never use `dangerouslySetInnerHTML`

**Test file:** `apps/web/src/app/_components/_helpers/__tests__/highlight-matches.test.tsx`
- Highlights single word
- Highlights multiple occurrences
- Case-insensitive matching
- Escapes regex special characters
- Returns plain text when no match
- Returns plain text when query is empty
- Handles multi-word queries (each word highlighted independently)

### Step 2: Wire highlighting into SearchPalette

In `search-palette.tsx`, replace the plain preview text with highlighted version:

```tsx
// Before:
<div className='truncate text-xs text-muted-foreground'>{result.preview}</div>

// After:
<div className='truncate text-xs text-muted-foreground'>
  {highlightMatches(result.preview, searchTerms)}
</div>
```

Need to extract `searchTerms` from the raw query client-side. Import `parseFilters` and call it on the current query to get just the search terms (minus filter prefixes).

Also highlight `result.title` the same way for consistency.

### Step 3: Recent searches hook (`use-recent-searches.ts`)

Create `apps/web/src/app/_components/_helpers/use-recent-searches.ts`

```tsx
type UseRecentSearches = () => {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (query: string) => void;
};
```

Behavior:
- localStorage key: `"harness:recent-searches"`
- Max 8 entries
- `addRecentSearch` prepends to list, deduplicates (case-insensitive), trims to max
- `clearRecentSearches` empties the list
- `removeRecentSearch` removes a single entry
- Reads from localStorage on mount (not on every render) via `useState` initializer
- Writes to localStorage on every mutation
- Handles `localStorage` unavailable (SSR, private browsing) gracefully — returns empty array, mutations are no-ops

**Test file:** `apps/web/src/app/_components/_helpers/__tests__/use-recent-searches.test.ts`
- Adds and retrieves recent searches
- Deduplicates entries (case-insensitive)
- Limits to 8 entries (oldest dropped)
- Removes individual entries
- Clears all entries
- Handles missing localStorage gracefully

### Step 4: Show recent searches in palette

In `search-palette.tsx`, when `query` is empty and palette is open:
- Show a `CommandGroup` heading "Recent Searches" with recent queries as `CommandItem`s
- Each item shows a clock icon (`Clock` from lucide) + the query text
- Selecting a recent search sets it as the query and triggers search
- A "Clear" button (small, text-only) in the group heading clears all recents
- Each item has an X button on hover to remove individual entries
- When a search completes successfully (results returned), call `addRecentSearch(query)`

Visual layout when palette opens with no query:
```
┌─────────────────────────────┐
│ 🔍 Search…                  │
├─────────────────────────────┤
│ Recent Searches        Clear│
│ 🕐 agent:primary quarterly  │
│ 🕐 has:file report          │
│ 🕐 deployment errors        │
└─────────────────────────────┘
```

### Step 5: Filter chips (`search-filter-chips.tsx`)

Create `apps/web/src/app/_components/_helpers/search-filter-chips.tsx`

A component that takes the current parsed filters and an `onRemoveFilter` callback.

```tsx
type SearchFilterChipsProps = {
  filters: ParsedQuery["filters"];
  onRemoveFilter: (filterKey: string) => void;
};
```

Renders a horizontal flex row of `Badge` components (variant `"outline"`) for each active filter:
- `agent:value` → Badge text "agent: value" with X icon
- `project:value` → Badge text "project: value"
- `in:value` → Badge text "in: value"
- `from:user|assistant` → Badge text "from: user"
- `has:file` → Badge text "has: file"
- `file:value` → Badge text "file: value"
- `before:date` → Badge text "before: date"
- `after:date` → Badge text "after: date"

Each badge has a small X button (`X` from lucide, 12px) on the right side. Clicking it calls `onRemoveFilter(filterKey)`.

Styling: `flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/40` — sits between input and results list.

Only renders if at least one filter is active.

### Step 6: Wire filter chips into SearchPalette

In `search-palette.tsx`:

1. Run `parseFilters(query)` on every query change to extract active filters and search terms
2. Render `<SearchFilterChips>` between `<CommandInput>` and `<CommandList>`
3. `onRemoveFilter` handler:
   - Takes the filter key (e.g., `"agent"`)
   - Rebuilds the query string by removing the matched filter pattern from the raw query
   - Sets the new query via `setQuery` and triggers search with the cleaned query
   - Uses the same regex patterns from `parseFilters` to find and strip the filter text

```tsx
const handleRemoveFilter = (filterKey: string) => {
  const pattern = FILTER_PATTERNS[filterKey];
  if (!pattern) return;
  const cleaned = query.replace(pattern, '').replace(/\s+/g, ' ').trim();
  setQuery(cleaned);
  search(cleaned);
};
```

This means `FILTER_PATTERNS` needs to be importable from `parse-filters.ts`. Currently it's not exported — add an export.

### Step 7: Export FILTER_PATTERNS from parse-filters

In `apps/web/src/app/api/search/_helpers/parse-filters.ts`, export `FILTER_PATTERNS` so the client can import it for chip removal. This is a `Record<string, RegExp>` of pure patterns with no server dependencies — safe to import in client components.

Alternatively, define a separate `FILTER_PATTERNS` constant in the client helper to avoid cross-importing from an API route. **Preferred: duplicate the patterns** — 8 lines of regex is simpler than creating a shared module between API routes and client components.

### Step 8: Tests

**`apps/web/src/app/_components/_helpers/__tests__/search-filter-chips.test.tsx`**
- Renders nothing when no filters active
- Renders badge for each active filter
- Calls onRemoveFilter with correct key when X clicked
- Renders multiple filters as separate badges

**Update `apps/web/src/app/_components/__tests__/search-palette.test.tsx`** (if exists, or note for manual testing):
- Recent searches shown on open with empty query
- Selecting recent search populates input
- Filter chips appear when filters typed
- Removing a chip updates query

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/_components/_helpers/highlight-matches.tsx` | Create | Client-side search term highlighting |
| `apps/web/src/app/_components/_helpers/__tests__/highlight-matches.test.tsx` | Create | Highlight helper tests |
| `apps/web/src/app/_components/_helpers/use-recent-searches.ts` | Create | localStorage hook for recent queries |
| `apps/web/src/app/_components/_helpers/__tests__/use-recent-searches.test.ts` | Create | Recent searches hook tests |
| `apps/web/src/app/_components/_helpers/search-filter-chips.tsx` | Create | Filter chip Badge row component |
| `apps/web/src/app/_components/_helpers/__tests__/search-filter-chips.test.tsx` | Create | Filter chips tests |
| `apps/web/src/app/_components/search-palette.tsx` | Modify | Wire highlighting, recent searches, filter chips |
| `apps/web/src/app/api/search/_helpers/parse-filters.ts` | No change | Patterns duplicated client-side instead |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Regex special chars in search terms crash highlighting | Escape all special chars before building RegExp |
| localStorage quota exceeded | Catch writes in try/catch, degrade gracefully |
| Filter chip removal produces malformed query | Trim whitespace, collapse multiple spaces |
| parseFilters import from API route into client bundle | Duplicate the 8-line FILTER_PATTERNS constant instead |
| Highlight `<mark>` tags break truncation | `truncate` class on parent div handles this — mark is inline |
| cmdk CommandItem conflicts with chip click handlers | Chips are outside CommandList, no conflict |
