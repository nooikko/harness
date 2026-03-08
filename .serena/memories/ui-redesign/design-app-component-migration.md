# Design App Component Migration

## Location
`apps/design/src/` — Vite + React design playground (NOT Next.js)

## Architecture
- `src/app.tsx` — nav uses `location.hash` for HMR-persistent routing (sections: surfaces, colors, typography, motion, components, blocks)
- `src/_sections/component-section.tsx` — all component showcases
- `src/components/` — migrated component files
- `src/tokens.css` — CSS variables + Tailwind v4. Reset wrapped in `@layer base`. No `@source` directives needed.

## Key Pattern
**Use inline styles matching the existing CSS variables** — do NOT try to map design tokens to Tailwind utility classes (causes sizing/spacing mismatches). The plan is to standardize via Tailwind theme AFTER all components are migrated.

Example: `padding: '6px 10px'`, `background: 'var(--surface-card)'`, `border: '1px solid var(--border)'`, `borderRadius: 'var(--radius-md)'`

## Gap vs packages/ui
- `kbd.tsx` — exists in design only, not in packages/ui (candidate to add)
- `sidebar.tsx` — exists in packages/ui only, not in design (full app component, not a showcase candidate)

## Migrated Components (in `src/components/`)
All use inline styles matching existing design tokens:
- `button.tsx` — CVA + Tailwind (exception: uses real Tailwind, works fine)
- `card.tsx` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `alert.tsx` — Alert, AlertTitle, AlertDescription (4 variants: info/success/warning/destructive)
- `label.tsx` — Label
- `input.tsx` — Input (CSS focus-visible ring)
- `textarea.tsx` — Textarea (CSS focus-visible ring)
- `select.tsx` — Select, SelectTrigger, SelectItem, SelectValue (Framer Motion enter animation via motion.div inside RadixSelect.Content; no forceMount/exit — not supported by @radix-ui/react-select@2.2.6)
- `separator.tsx` — Separator (horizontal/vertical)
- `skeleton.tsx` — Skeleton (animate-pulse bg-muted — Tailwind works here)
- `kbd.tsx` — Kbd (inline styles: `padding: '6px 10px'`, `background: 'var(--surface-card)'`, `borderRadius: 'var(--radius-md)'`, `fontSize: 12`, `fontFamily: 'var(--font-mono)'`)
- `tooltip.tsx` — Tooltip (self-contained with useState + AnimatePresence, exit animation works)
- `collapsible.tsx` — Collapsible (self-contained: manages open state, animated chevron, height animation via AnimatePresence)
- `scroll-area.tsx` — ScrollArea (wraps Radix ScrollArea primitives with exact inline styles)
- `table.tsx` — Table, TableHeader, TableHead, TableBody, TableRow (isLast prop), TableCell (variant: primary/secondary/mono)
- `switch.tsx` — Switch (motion.div track + thumb, checked/onCheckedChange)
- `tabs.tsx` — Tabs (tabs prop, defaultTab/activeTab/onTabChange, layoutId sliding indicator, style prop)
- `progress.tsx` — Progress (value 0–1, label, showPercent; auto color: success/accent/destructive by threshold)
- `badge.tsx` — Badge (variant: active/success/warning/error/neutral; inline styles via variantStyles map)
- `dropdown-menu.tsx` — DropdownMenu (trigger prop, AnimatePresence), DropdownMenuItem (icon, destructive), DropdownMenuSeparator
- `popover.tsx` — Popover (self-contained open state, trigger prop, width/padding/sideOffset/align)
- `alert-dialog.tsx` — AlertDialog (trigger prop, overlay+animation), AlertDialogTitle/Description/Footer/Close
- `dialog.tsx` — Dialog (trigger prop, width/padding props), DialogTitle/Description/Footer/Close
- `command.tsx` — CommandDialog (manages mounted state internally), CommandInput/List/Empty/Group/Item/Footer (uses Kbd for hints)

## component-section.tsx Status
ALL showcases migrated. `Done` wrapper (opacity: 0.5) applied to all approved showcases.

### Left column — ALL DONE ✅:
- ButtonShowcase, LabelShowcase, InputShowcase, TextareaShowcase, SelectShowcase
- CardShowcase, AlertShowcase, TableShowcase, BadgeShowcase

### Right column — ALL DONE ✅:
- SkeletonShowcase, TooltipShowcase, SeparatorShowcase, CollapsibleShowcase, ScrollAreaShowcase
- SwitchShowcase, TabsShowcase, ProgressShowcase, DropdownMenuShowcase
- PopoverShowcase, DialogShowcase, AlertDialogShowcase, CommandShowcase

### Remaining imports in component-section.tsx (still needed):
- `* as RadixSelect` — SelectShowcase not yet migrated to use select.tsx internally (uses forceMount pattern)
- `motion` from motion/react — used by SelectShowcase (entrance animation) and DialogShowcase (focus ring)

## Radix Select Animation Note
`@radix-ui/react-select@2.2.6` does NOT support `forceMount` on Portal or Content — TypeScript error. Cannot use AnimatePresence exit animation. Only entrance animation via `motion.div` inside `RadixSelect.Content` works.

## CSS Token Reference
```
--radius-sm: 4px
--radius-md: 8px  
--radius-lg: 12px
--radius-xl: 16px
--radius-pill: 999px
--radius: 0.5rem (Tailwind override)
```

## Done Helper
```tsx
const Done = ({ children }: { children: ReactNode }) => (
  <div style={{ opacity: 0.5 }}>{children}</div>
);
```
Add to TableShowcase once user approves.
