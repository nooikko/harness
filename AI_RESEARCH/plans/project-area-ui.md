# Plan: Project Area UI (Claude-style)

## Summary

Replace the current project edit-only page with a Claude-style project landing page. Clicking a project navigates to a hub showing: project memory, custom instructions, attached files, and recent threads — with the ability to start a new chat within that project context. Settings are accessible but not the default view.

## Reference Design (from Claude screenshot)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← All projects                                                       │
│                                                                       │
│ Project Name                                                  ··· ☆  │
│                                                                       │
│ ┌─────────────────────────────────┐   ┌──────────────────────────┐   │
│ │  Type / for skills              │   │ Memory            🔒  ✎ │   │
│ │                                 │   │ Purpose & context...     │   │
│ │  +            Model v           │   │ Last updated 3 days ago  │   │
│ │                                 │   │                          │   │
│ │  □ Start a task in Cowork       │   │ Instructions          +  │   │
│ └─────────────────────────────────┘   │ Add instructions...      │   │
│                                       │                          │   │
│  Thread 1          Last message 19m   │ Files                 +  │   │
│  Thread 2          Last message 2h    │ ■ file1.md  ■ file2.md  │   │
│                                       │ 1% of capacity used      │   │
│                                       └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## Existing Infrastructure

- **`create-thread.ts`** already accepts `projectId` param — no new server action needed for project-scoped thread creation
- **`project-settings-form.tsx`** already renders name, description, instructions (editable), model selector, memory (read-only), delete button
- **`nav-chats.tsx`** already receives a `projects` prop with `{ id, name }[]` but **doesn't render project navigation** — the prop is passed but unused
- **`project__get_project_memory` / `set_project_memory`** MCP tools exist for agent-managed project memory

## Route Structure

```
/chat/projects                    → Project list (already exists)
/chat/projects/[project-id]       → Project hub (NEW — replaces current settings page)
/chat/projects/[project-id]/settings → Project settings (MOVED — existing form lives here)
```

## Page: Project Hub (`/chat/projects/[project-id]/page.tsx`)

### Layout: Two-column

**Left column (main):**
- Project name + actions (⋯ menu, ★ favorite)
- New chat input area (simplified — just textarea + send, starts a new thread in this project)
- Recent threads list (threads belonging to this project, sorted by lastActivity)

**Right column (sidebar):**
- **Memory panel** — shows `project.memory` (read-only with edit icon → inline edit)
- **Instructions panel** — shows `project.instructions` (collapsible, with + to add)
- **Files panel** — shows files with `scope: PROJECT` for this project (with + to upload)
  - File cards showing name, size, type badge
  - Click to preview (reuse file preview modal from file uploads plan)
  - File count and capacity indicator

### Components

1. **`project-hub-page.tsx`** (server component — thin shell)
   - Fetches project by ID, 404 if not found
   - Renders layout with Suspense children

2. **`project-header.tsx`** (server component)
   - Project name, ⋯ dropdown (settings, delete), favorite toggle
   - "← All projects" breadcrumb link

3. **`project-chat-input.tsx`** (client component)
   - Simplified chat input (textarea + send button)
   - On send: creates new thread with `projectId`, navigates to thread

4. **`project-threads-list.tsx`** (server component)
   - Fetches threads where `projectId` matches
   - Shows thread name, last message timestamp, message count
   - Click navigates to `/chat/[thread-id]`

5. **`project-memory-panel.tsx`** (client component)
   - Displays `project.memory` in a card
   - Edit icon → toggles to textarea for inline editing
   - Save calls existing server action

6. **`project-instructions-panel.tsx`** (client component)
   - Displays `project.instructions` in a collapsible card
   - "+" button or edit icon → textarea for editing
   - Save calls existing server action

7. **`project-files-panel.tsx`** (server component + client upload)
   - Lists files with `scope: PROJECT, projectId`
   - File cards (name, type badge, size)
   - "+" button → file upload (uses upload API from file uploads plan)
   - Click file → preview modal

### Server Actions (reuse existing + new)

- `update-project.ts` — already exists for settings
- `create-project-thread.ts` — creates thread with projectId pre-set
- `upload-project-file.ts` — uploads file with `scope: PROJECT`

## Settings Page (`/chat/projects/[project-id]/settings/page.tsx`)

Move the existing `ProjectSettingsForm` here. Accessible from the ⋯ menu on the project hub header.

## Sidebar Navigation

Update `NavChats` or `NavLinks` to show projects in a dedicated section above threads (or as a collapsible group). Currently projects are passed as `projectOptions` to `NavChats` — extend this to make project names clickable → navigates to project hub instead of filtering.

## Implementation Steps

### Step 1: Route Restructure
- Create `/chat/projects/[project-id]/settings/page.tsx` — move existing settings form here
- Rewrite `/chat/projects/[project-id]/page.tsx` as the new project hub

### Step 2: Project Hub Layout
- Two-column layout (main + sidebar)
- Project header with breadcrumb and actions menu

### Step 3: Right Sidebar Panels
- Memory panel (display + inline edit)
- Instructions panel (display + inline edit)
- Files panel (list + upload, depends on file uploads plan)

### Step 4: Left Main Content
- New chat input for project-scoped threads
- Recent threads list
- Server action for creating project-scoped threads

### Step 5: Sidebar Nav Updates
- Make project names in sidebar clickable → project hub
- Add "All projects" link

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/src/app/(chat)/chat/projects/[project-id]/page.tsx` | Rewrite | Project hub page |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/settings/page.tsx` | Create | Settings (moved) |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-header.tsx` | Create | Header + actions |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-chat-input.tsx` | Create | New chat input |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-threads-list.tsx` | Create | Recent threads |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-memory-panel.tsx` | Create | Memory display/edit |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-instructions-panel.tsx` | Create | Instructions display/edit |
| `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-files-panel.tsx` | Create | File list + upload |
| `apps/web/src/app/(chat)/chat/_components/nav-chats.tsx` | Modify | Clickable project names |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing project settings links | Redirect old URL pattern to /settings sub-route |
| Files panel depends on file uploads plan | Implement as empty state with "Coming soon" if uploads not done yet |
| Memory panel editing conflicts | Optimistic update with last-write-wins (single user system) |
