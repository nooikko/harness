# ShadCN/UI Patterns Research
Date: 2026-03-01

## Summary
Comprehensive research on five core ShadCN/UI patterns for modal dialogs, dropdowns, split buttons, and form integration. All patterns documented with concrete code examples from official shadcn/ui GitHub documentation.

## Key Findings

### 1. AlertDialog Pattern
- Base component: `AlertDialog` wrapper
- Sub-components: `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`
- **Footer Button Layout**: Standard pattern uses `<AlertDialogFooter>` which is a flex container. Two buttons are typical: Cancel and Action.
- **Split Button in Footer**: No native support. Can be achieved by:
  - Left side: `<Button variant="destructive" onClick={handleDelete}>Delete</Button>`
  - Right side: `<DropdownMenu>` with arrow trigger (icon button with ChevronDown)
  - Both wrapped in a flex container with gap
- Size prop available: `size="default" | "sm"`

### 2. Dialog Pattern (Forms)
- Base component: `Dialog` wrapper
- Sub-components: `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`
- **Form Layout**: Grid-based with `grid grid-cols-4 gap-4` is standard
- **Label Positioning**: Labels typically `text-right` with `col-span-1`, inputs `col-span-3`
- **Form Controls**: Dialog works seamlessly with:
  - `Input` component (text fields)
  - `Select` component (dropdowns) with `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
  - `Textarea` component (multi-line text)
- **Close Button**: Controlled via `showCloseButton` prop on `DialogContent`
- Typical size: `sm:max-w-[425px]`

### 3. Split Button / Button + Dropdown Pattern
- **Pattern**: Two buttons side-by-side, no native split button in shadcn/ui
- **Left Button**: `<Button variant="destructive">Delete</Button>` (main action)
- **Right Button**: Small icon button with `<DropdownMenu>` trigger (alternatives)
  - Use: `<Button variant="destructive" size="icon">` with `ChevronDown` icon
- **Container**: Flex row with gap: `<div className="flex gap-0">`
  - Remove gap to make buttons visually adjacent
  - Or use gap-1 for small spacing
- **Red/Destructive Style**: Use `variant="destructive"` on Button
- **Dropdown Content**: Use `DropdownMenuContent` with `DropdownMenuItem` for alternative actions

### 4. DropdownMenu Hover Pattern (Kebab Menu)
- **Structure**: Standard `<DropdownMenu>` → `<DropdownMenuTrigger>` → `<DropdownMenuContent>`
- **Hover Visibility**: Not a built-in feature. Implementation requires:
  1. Parent container with `group` class
  2. Trigger button with `group-hover:opacity-100 opacity-0` (or `hidden group-hover:block`)
  3. Trigger on parent hover, not button click
  - Alternative: Use `DropdownMenuTrigger` with `asChild` on a hidden button
  - Show/hide via parent hover state with Tailwind
- **Kebab Icon**: Use Lucide `MoreVertical` icon
- **List Item Pattern**: Each row gets a dropdown trigger in the last column, hidden until hover

### 5. Component Installation Checklist
**Already available in packages/ui/src/components/**:
- Alert, Badge, Button, Card, Dialog, DropdownMenu, Input, Label, Progress, ScrollArea, Separator, Skeleton, Table, Tooltip

**Need to add**:
- `AlertDialog` — Required for confirmation modals
- `Select` — Required for form dropdowns (not currently listed)
- `Textarea` — Required for multi-line form inputs (not currently listed)

**Optional/Nice-to-have**:
- Lucide icons for visual elements (ChevronDown, MoreVertical, Trash2, etc.)

## Sources
- Library ID: `/shadcn-ui/ui` (High reputation, 982 code snippets, benchmark 78)
- Official ShadCN GitHub: https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/
- Patterns covered by official documentation with verifiable code examples
