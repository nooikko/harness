# Research: Lexical Editor — React 19 / Next.js 16 Integration

Date: 2026-02-27

## Summary

Lexical (Meta's extensible text editor framework) is at v0.41.0 and has explicit React 19 support
since v0.36.1 (September 2024). It works cleanly in Next.js 16 App Router via `'use client'`
components. The primary packages are `lexical` + `@lexical/react`. For slash command menus, two
viable paths exist: (1) Lexical's built-in `LexicalTypeaheadMenuPlugin` with
`useBasicTypeaheadTriggerMatch("/", ...)`, or (2) the third-party
`@emergence-engineering/lexical-slash-menu-plugin`. The `lexical-beautiful-mentions` package
supports arbitrary trigger characters (including `/` in theory) but is designed for inline
mention nodes and has an unresolved community question about whether slash-command style menus
are a good fit.

---

## 1. Core Lexical Packages

### Versions (as of February 2026)

| Package | Version | Notes |
|---------|---------|-------|
| `lexical` | 0.41.0 | Released February 25, 2025 |
| `@lexical/react` | 0.41.0 | Same version, always in sync |

Both packages version-lock together. Installing mismatched versions causes the
"LexicalComposerContext" error (multiple Lexical builds in the bundle).

### React / Next.js Compatibility

- **React 19**: Officially supported since v0.36.1 (Sep 25, 2024). The changelog says:
  "Update from React 18 to React 19 across the lexical, lexical-react, and lexical-playground
  packages" while "should all still remain compatible with React 18 for now."
- **Peer dependency declared**: `react>=17.x`, `react-dom>=17.x` — no npm conflict with React 19.
- **React 19 StrictMode caveat**: `useMemo` calls are cached across StrictMode re-renders in
  React 19, so only one editor instance is used across both renders. This is fine for production
  but can cause plugin side effects to trigger unexpectedly in dev StrictMode.
- **Next.js App Router**: Lexical is browser-only (DOM-dependent). All Lexical components MUST
  be in `'use client'` files. No server-side rendering support.
- **Fast Refresh note**: Files that create editors or define custom `LexicalNode` subclasses may
  need `// @refresh reset` at the top to avoid stale state on hot reload in Next.js dev mode.

### Installation

```bash
pnpm add lexical @lexical/react
```

---

## 2. Core Concepts

### LexicalComposer Setup

The `LexicalComposer` is the React context provider. All plugins must be children of it.

```tsx
'use client';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

const initialConfig = {
  namespace: 'MyEditor',
  theme: {},
  onError: (error: Error) => console.error(error),
  nodes: [], // register custom nodes here
};

const MyEditor = () => (
  <LexicalComposer initialConfig={initialConfig}>
    <RichTextPlugin
      contentEditable={<ContentEditable />}
      placeholder={<div>Type here...</div>}
      ErrorBoundary={LexicalErrorBoundary}
    />
    <HistoryPlugin />
    <OnChangePlugin onChange={handleChange} />
  </LexicalComposer>
);
```

**Critical**: `initialConfig` is only processed on the first render. Do not pass it via state.

### Plugins Pattern

Each plugin is a React component that must live inside `<LexicalComposer>`. Plugins use
`useLexicalComposerContext()` to access the editor instance. Built-in plugins from `@lexical/react`:

- `LexicalRichTextPlugin` — core rich text editing
- `LexicalPlainTextPlugin` — plain text only (no formatting)
- `LexicalOnChangePlugin` — fires on every state change
- `LexicalHistoryPlugin` — undo/redo
- `LexicalAutoLinkPlugin` — auto-detects URLs
- `LexicalMarkdownShortcutPlugin` — markdown syntax shortcuts
- `LexicalTypeaheadMenuPlugin` — typeahead/autocomplete menus (used for slash commands)
- `LexicalClearEditorPlugin` — programmatic clear
- `LexicalEditorRefPlugin` — exposes editor ref outside the tree

Import paths are deep: `@lexical/react/LexicalRichTextPlugin`, `@lexical/react/LexicalOnChangePlugin`, etc.

### Editor State Serialization

```tsx
// Serialize to JSON string (for DB storage)
const jsonString = JSON.stringify(editor.getEditorState().toJSON());

// Deserialize from JSON string
const editorState = editor.parseEditorState(jsonString);
editor.setEditorState(editorState);
```

### Extracting Plain Text

```tsx
import { $getRoot } from 'lexical';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';

// Inside onChange callback:
const handleChange = (editorState: EditorState) => {
  editorState.read(() => {
    const plainText = $getRoot().getTextContent();
    // plainText is the full editor content as a plain string
  });
};
```

The `editorState.read()` callback is the safe context for using `$`-prefixed Lexical functions.
`$getRoot().getTextContent()` recursively collects text from all child nodes.

For imperative access (e.g., on submit button click):

```tsx
const [editor] = useLexicalComposerContext();

const handleSubmit = () => {
  editor.getEditorState().read(() => {
    const text = $getRoot().getTextContent();
    sendMessage(text);
  });
};
```

---

## 3. Slash Command Menus with Built-in TypeaheadMenuPlugin

### Overview

The built-in `LexicalTypeaheadMenuPlugin` (from `@lexical/react/LexicalTypeaheadMenuPlugin`)
is the recommended Lexical-native way to implement slash command menus. It uses a regex trigger
function and renders a floating menu.

### Import Path

```tsx
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
// Types also exported:
// MenuRenderFn, MenuResolution, MenuTextMatch, TriggerFn
```

### `useBasicTypeaheadTriggerMatch` — Hook Signature

```typescript
function useBasicTypeaheadTriggerMatch(
  trigger: string,          // e.g. "/"
  options?: {
    minLength?: number;     // default: 1
    maxLength?: number;     // default: 75
    punctuation?: string;   // characters that end the match
    allowWhitespace?: boolean; // default: false
  }
): TriggerFn
```

Returns a `TriggerFn` that matches text against a regex. When activated by typing `/`, it
returns a `MenuTextMatch` object with `{ leadOffset, matchingString, replaceableString }`.

### `LexicalTypeaheadMenuPlugin` Props

```typescript
type TypeaheadMenuPluginProps<TOption extends MenuOption> = {
  // Required:
  onQueryChange: (matchingString: string | null) => void;
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string,
  ) => void;
  options: Array<TOption>;
  menuRenderFn: MenuRenderFn<TOption>;
  triggerFn: TriggerFn;
  // Optional:
  onOpen?: (resolution: MenuResolution) => void;
  onClose?: () => void;
  anchorClassName?: string;
  commandPriority?: CommandListenerPriority;
  parent?: HTMLElement;
  preselectFirstItem?: boolean;
  ignoreEntityBoundary?: boolean;
};
```

### Complete Slash Command Example

```tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { $getSelection, $isRangeSelection, TextNode } from 'lexical';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuRenderFn,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';

class CommandOption extends MenuOption {
  label: string;
  onSelect: () => void;
  constructor(label: string, onSelect: () => void) {
    super(label);
    this.label = label;
    this.onSelect = onSelect;
  }
}

const COMMANDS: CommandOption[] = [
  new CommandOption('New Thread', () => { /* ... */ }),
  new CommandOption('Clear', () => { /* ... */ }),
];

const SlashCommandPlugin = () => {
  const [queryString, setQueryString] = useState<string | null>(null);

  const triggerFn = useBasicTypeaheadTriggerMatch('/', { minLength: 0 });

  const options = useMemo(() =>
    COMMANDS.filter(cmd =>
      !queryString || cmd.label.toLowerCase().includes(queryString.toLowerCase())
    ),
    [queryString]
  );

  const onSelectOption = useCallback(
    (option: CommandOption, node: TextNode | null, closeMenu: () => void) => {
      // Remove the typed "/" and query text
      if (node) {
        node.remove();
      }
      option.onSelect();
      closeMenu();
    },
    []
  );

  const menuRenderFn: MenuRenderFn<CommandOption> = (
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
  ) => {
    if (!anchorElementRef.current || options.length === 0) return null;
    return (
      <div className="slash-menu">
        {options.map((option, i) => (
          <div
            key={option.key}
            className={i === selectedIndex ? 'selected' : ''}
            onClick={() => selectOptionAndCleanUp(option)}
            onMouseEnter={() => setHighlightedIndex(i)}
          >
            {option.label}
          </div>
        ))}
      </div>
    );
  };

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      options={options}
      menuRenderFn={menuRenderFn}
      triggerFn={triggerFn}
    />
  );
};
```

**Key note**: The `onSelectOption` callback receives the `TextNode` containing the typed `/query`
text. You must call `node.remove()` (or `node.setTextContent('')`) inside an `editor.update()`
to clear the trigger text from the editor after selection.

---

## 4. lexical-beautiful-mentions

### Package

```bash
pnpm add lexical-beautiful-mentions
```

### Version & Compatibility

| Field | Value |
|-------|-------|
| Package | `lexical-beautiful-mentions` |
| Current version | 0.1.48 |
| Peer deps (lexical) | `>=0.11.0` |
| Peer deps (React) | `>=17.x` |
| React 19 compatibility | Not officially stated, but `react>=17.x` peer dep means no conflict |
| Author | sodenn (mail@sodenn.dev) |

### What It Does

Renders inline "mention nodes" (custom Lexical nodes) in the editor text, triggered by a
configurable character. Selected mentions become styled inline nodes rather than plain text.
Designed for `@user`, `#topic`, `due:date` style annotations embedded in prose.

### Trigger Configuration

Supports any character, word, or regular expression as trigger:
- `"@"` — user mentions
- `"#"` — topic/hashtag mentions
- `"due:"` — multi-char word trigger
- `"/"` — theoretically supported (same API); one GitHub discussion #586 asked "is it possible to
  make a slash menu with beautiful-mentions" and received no official answer (July 2024, unanswered)

**Caution**: Issue #1085 ("Open square bracket `[` is not a valid trigger", closed, not planned)
indicates some character validation exists. Whether `/` specifically passes validation is unconfirmed.

### BeautifulMentionsPlugin Props

```typescript
type BeautifulMentionsPluginProps = {
  // Data source (use one or the other, not both):
  items?: Record<string, string[]>;          // static: { "@": ["alice", "bob"] }
  onSearch?: (trigger: string, query: string) => Promise<string[]>; // async

  // Behavior:
  triggers?: string[];          // defaults to Object.keys(items)
  punctuation?: string;         // characters ending a match
  preTriggerChars?: string;     // chars allowed before trigger
  autoSpace?: boolean;          // auto-insert spaces (default: true)
  searchDelay?: number;         // ms delay before search fires (default: 250)
  allowSpaces?: boolean;        // allow spaces in mention text (default: true)
  insertOnBlur?: boolean;       // convert text to node on blur (default: true)
  showMentionsOnDelete?: boolean;
  showCurrentMentionsAsSuggestions?: boolean; // (default: true)
  creatable?: boolean;          // allow creating new mentions
  menuAnchorClassName?: string;
  mentionEnclosure?: string;

  // UI Components:
  menuComponent?: React.ComponentType<BeautifulMentionsMenuProps>;
  menuItemComponent?: React.ComponentType<BeautifulMentionsMenuItemProps>;
  emptyComponent?: React.ComponentType;

  // Callbacks:
  onMenuItemSelect?: (item: BeautifulMentionsMenuItem) => void;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  onComboboxOpen?: () => void;
  onComboboxClose?: () => void;
};
```

### useBeautifulMentions Hook

```typescript
const { insertMention, removeMentions } = useBeautifulMentions();
```

For programmatic control — inserts or removes mention nodes.

### Node Registration

Must register `BeautifulMentionNode` in the `initialConfig.nodes` array:

```tsx
import { BeautifulMentionNode } from 'lexical-beautiful-mentions';

const initialConfig = {
  namespace: 'MyEditor',
  nodes: [BeautifulMentionNode],
  // ...
};
```

### Verdict for Slash Commands

**Not the right fit for slash command menus in a chat input.** It is designed for inline mention
nodes embedded in text, not for a command palette that opens, runs an action, and closes. The
community has asked about this use case without an official answer. Use
`LexicalTypeaheadMenuPlugin` (built-in) or `@emergence-engineering/lexical-slash-menu-plugin`
for slash commands instead.

---

## 5. @emergence-engineering/lexical-slash-menu-plugin

### Package

```bash
pnpm add @emergence-engineering/lexical-slash-menu-plugin
```

Import the bundled CSS too:
```tsx
import '@emergence-engineering/lexical-slash-menu-plugin/dist/styles/style.css';
```

### Version & Compatibility

| Field | Value |
|-------|-------|
| Version | 0.0.4 |
| Dependencies (not peerDeps) | `react ^18.2.0`, `lexical ^0.11.3`, `@lexical/react ^0.11.3`, `@floating-ui/react-dom ^2.0.1` |
| React 19 | Listed as direct dependency on `^18.2.0` — React 19 not explicitly supported; may work with `--legacy-peer-deps` |

**Warning**: This package lists React and Lexical as direct dependencies (not peer deps), which
means it may bundle its own copy of Lexical and React — this can cause the
"LexicalComposerContext" multiple-build error if the versions don't match exactly. Treat this as
a risk.

### SlashMenuPlugin Props

```typescript
type SlashMenuPluginProps = {
  menuElements: SlashMenuItem[];      // Required: command/submenu definitions
  ignoredKeys?: string[];             // Keys that won't trigger the menu
  customConditions?: condition[];     // Custom open/close logic
  openInSelection?: boolean;          // Enable menu when text is selected
  icons?: Record<string, ReactNode>;  // Icons by item id
  rightIcons?: Record<string, ReactNode>;
  floatingReference?: HTMLElement;    // Custom positioning element
  floatingOptions?: object;           // Floating-UI config overrides
  clickable?: boolean;                // Enable click interaction
};
```

### menuElements Structure

Two item types:

```typescript
// Command item — executes an action
type CommandItem = {
  id: string;
  label: string;
  type: 'command';
  command: (editor: LexicalEditor) => void;
};

// Submenu item — opens a nested list
type SubMenuItem = {
  id: string;
  label: string;
  type: 'submenu';
  elements: SlashMenuItem[];
  callbackOnClose?: () => void;
};

type SlashMenuItem = CommandItem | SubMenuItem;
```

### Usage Example

```tsx
import { SlashMenuPlugin } from '@emergence-engineering/lexical-slash-menu-plugin';
import '@emergence-engineering/lexical-slash-menu-plugin/dist/styles/style.css';

const menuElements = [
  {
    id: '1',
    label: 'Heading 1',
    type: 'command' as const,
    command: (editor: LexicalEditor) => {
      editor.update(() => {
        // apply heading transformation
      });
    },
  },
  {
    id: '2',
    label: 'Insert',
    type: 'submenu' as const,
    elements: [
      {
        id: '2a',
        label: 'Code Block',
        type: 'command' as const,
        command: (editor) => { /* ... */ },
      },
    ],
  },
];

// Inside LexicalComposer:
<SlashMenuPlugin menuElements={menuElements} />
```

---

## 6. Recommendation Summary

| Goal | Best Option |
|------|-------------|
| Slash command palette (command runs, menu closes, no node inserted) | `LexicalTypeaheadMenuPlugin` (built-in) with `useBasicTypeaheadTriggerMatch('/')` |
| Slash command with opinionated default UI + submenus | `@emergence-engineering/lexical-slash-menu-plugin` (but watch for React 19 / duplicate Lexical bundle risk) |
| Inline @mention nodes in text | `lexical-beautiful-mentions` |
| Inline mentions AND slash commands | `lexical-beautiful-mentions` for mentions + `LexicalTypeaheadMenuPlugin` for slash |

For a chat input that needs to send plain text, the built-in `LexicalTypeaheadMenuPlugin` with
`useBasicTypeaheadTriggerMatch` is the safest choice — zero extra dependencies, already in the
installed `@lexical/react` package, fully supports React 19.

---

## Key Takeaways

1. Install `lexical` + `@lexical/react` (v0.41.0). These are the only required packages.
2. Every Lexical component needs `'use client'` in Next.js App Router.
3. Add `// @refresh reset` to the file that creates the editor for stable Next.js hot reload.
4. `initialConfig` must not be created inside a render function — define it outside or in `useMemo`.
5. Extract plain text with `editorState.read(() => $getRoot().getTextContent())`.
6. For slash commands, use the built-in `LexicalTypeaheadMenuPlugin` + `useBasicTypeaheadTriggerMatch('/', { minLength: 0 })`.
7. The `onSelectOption` callback must call `node.remove()` to clean up the `"/query"` text node.
8. `lexical-beautiful-mentions` (v0.1.48) is for inline mention nodes, not command palettes.
9. `@emergence-engineering/lexical-slash-menu-plugin` (v0.0.4) bundles its own React 18 — risky with React 19.

---

## Sources

- [Lexical official docs — Getting Started with React](https://lexical.dev/docs/getting-started/react)
- [Lexical official docs — Plugins](https://lexical.dev/docs/react/plugins)
- [Lexical official docs — Editor State](https://lexical.dev/docs/concepts/editor-state)
- [Lexical official docs — React FAQ](https://lexical.dev/docs/react/faq)
- [Lexical TypeaheadMenuPlugin API reference](https://lexical.dev/docs/api/modules/lexical_react_LexicalTypeaheadMenuPlugin)
- [lexical GitHub releases](https://github.com/facebook/lexical/releases)
- [lexical-beautiful-mentions GitHub](https://github.com/sodenn/lexical-beautiful-mentions)
- [npm registry — lexical 0.41.0](https://registry.npmjs.org/lexical/latest)
- [npm registry — @lexical/react 0.41.0](https://registry.npmjs.org/@lexical/react/latest)
- [npm registry — lexical-beautiful-mentions 0.1.48](https://registry.npmjs.org/lexical-beautiful-mentions/latest)
- [npm registry — @emergence-engineering/lexical-slash-menu-plugin 0.0.4](https://registry.npmjs.org/@emergence-engineering/lexical-slash-menu-plugin/latest)
- [Emergence Engineering slash menu blog post](https://emergence-engineering.com/blog/lexical-slash-menu-plugin)
- [Lexical discussions — plain text extraction](https://github.com/facebook/lexical/discussions/1934)
