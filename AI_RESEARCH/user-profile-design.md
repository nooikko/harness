# User Profile & Top Bar Dropdown — Design Spec

**Date:** 2026-03-12
**Status:** Draft

---

## Overview

Add a singleton `UserProfile` model, a polished profile page at `/admin/profile`, a user dropdown in the top bar replacing the current settings gear icon, and user context injection into AI prompts via the context plugin.

This is a single-user homelab application. There is no auth system. The profile is a singleton record with a fixed ID.

---

## 1. Data Model

### New model: `UserProfile`

```prisma
model UserProfile {
  id        String   @id @default("singleton")
  name      String   @default("User")
  pronouns  String?
  age       Int?
  gender    String?
  location  String?
  interests String?              // comma-separated list
  bio       String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Design decisions:**
- `id` defaults to `"singleton"` — exactly one row ever exists
- All fields except `name` are nullable (progressive disclosure — user fills in what they want)
- `interests` stored as comma-separated string, parsed in UI for display
- `bio` is `@db.Text` for unlimited length
- No avatar field — file upload infrastructure deferred. Uses initials-based avatar placeholder
- No relations to other models (profile is orthogonal to agents/threads)

**Seed:** Upsert a default row with `name: "User"` and all other fields null.

---

## 2. Top Bar User Dropdown

### Current state
`TopBar` renders a `SettingsMenu` component in the top-right: a gear icon button that opens a dropdown with "Admin" and "Usage" links.

### New state
Replace `SettingsMenu` with `UserMenu`. The trigger becomes an **initials avatar** — a small circle showing the first character of the user's name (or a generic User icon if name is "User"/default).

**TopBar changes:**
- TopBar becomes an async server component (currently sync)
- Fetches `UserProfile` singleton (name only) via Prisma
- Passes `name` as a prop to the new `UserMenu` client component
- Root layout (`apps/web/src/app/layout.tsx`) must also become async since it renders `<TopBar />` — Next.js 16 handles async server components in JSX natively, but the layout function signature needs to be `async`

**UserMenu component** (`apps/web/src/app/_components/user-menu.tsx`):
- Client component (`'use client'`)
- Props: `{ name: string }`
- Trigger: initials avatar circle (32x32, `rounded-full`, `bg-muted`, centered first letter of name, `text-xs font-medium`)
- Dropdown content (aligned end, `w-56`):
  - **Header** — displays name in `font-medium text-sm`, non-interactive
  - `DropdownMenuSeparator`
  - **Profile** — `User` icon, links to `/admin/profile`
  - **Admin** — `Settings` icon, links to `/admin`
  - **Usage** — `BarChart2` icon, links to `/admin/usage`

**Removes:** `settings-menu.tsx` (replaced entirely by `user-menu.tsx`)

---

## 3. Profile Page — `/admin/profile`

### Route structure
```
apps/web/src/app/admin/profile/
  page.tsx                        — async server component (thin shell)
  _components/
    profile-form.tsx              — client form component
  _actions/
    update-profile.ts             — server action (upserts singleton)
  __tests__/
    page.test.tsx                 — server component tests
```

### Page layout design

The profile page should feel like a personal identity page, not an admin form. Visual structure:

```
┌─────────────────────────────────────────────────┐
│  Breadcrumb: Admin > Profile                    │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  ┌────┐                                  │   │
│  │  │ QH │  Quinn Hartley                   │   │
│  │  │    │  they/them · Phoenix, AZ         │   │
│  │  └────┘                                  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Identity                                       │
│  ┌──────────────────────────────────────────┐   │
│  │  Name         [Quinn Hartley          ]  │   │
│  │  Pronouns     [they/them              ]  │   │
│  │  Age          [28                     ]  │   │
│  │  Gender       [Non-binary             ]  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Location & Interests                           │
│  ┌──────────────────────────────────────────┐   │
│  │  Location     [Phoenix, AZ            ]  │   │
│  │  Interests    [homelab, TypeScript, AI]  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  About                                          │
│  ┌──────────────────────────────────────────┐   │
│  │  Bio                                     │   │
│  │  [                                    ]  │   │
│  │  [  Free-form text about yourself...  ]  │   │
│  │  [                                    ]  │   │
│  │  This information is shared with your    │   │
│  │  AI assistant to personalize responses.  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│                              [Save Changes]     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Visual design principles

**Profile header card:**
- Large initials avatar (64x64 or 80x80, `rounded-full`, `bg-primary/10 text-primary`)
- Name as `text-xl font-semibold`
- Subtitle line: pronouns + location separated by ` · ` (only shows non-null values)
- This card is **read-only display** — it reflects the current saved state, not the form state
- Subtle border, slightly elevated from the background

**Form sections:**
- Grouped into logical sections with section headings (`text-sm font-medium text-foreground`)
- Each section wrapped in a `Card` with subtle border
- Section descriptions in `text-xs text-muted-foreground` under the heading
- Fields use `Label` + `Input`/`Textarea` from `@harness/ui`
- Two-column grid for short fields (Name + Pronouns, Age + Gender) on larger screens, single column on mobile
- `max-w-2xl` for the form area to prevent fields from stretching too wide

**Bio section:**
- `Textarea` with `min-h-[120px]`
- Helper text below: "This information is shared with your AI assistant to personalize responses."

**Save button:**
- Right-aligned at the bottom
- Uses `useTransition` for pending state
- Shows brief success feedback (button text changes to "Saved" with a check icon, reverts after 2s)

**Empty state:**
- When profile is default (name "User", everything else null), the header card shows a welcome message: "Set up your profile" with a brief explanation that this info helps personalize the AI
- Form is still fully functional — no separate "setup wizard"

### Server action: `update-profile.ts`

```typescript
'use server';

const updateProfile = async (formData: FormData) => {
  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    create: { /* fields from formData */ },
    update: { /* fields from formData */ },
  });
  revalidatePath('/admin/profile');
  revalidatePath('/');  // revalidates top bar (user menu name)
};
```

Upsert pattern ensures the row exists even if seed hasn't run.

---

## 4. AI Context Injection

### Where: Context plugin `onBeforeInvoke`

The context plugin (`packages/plugins/context/src/index.ts`) already assembles the prompt from project instructions, project memory, context files, history, and the base prompt. User profile is injected as a new section.

### Injection point

Add a `<user_profile>` section between project memory and context files:

```
project_instructions → project_memory → USER PROFILE → context files → summary → history → prompt
```

### Format

```xml
<user_profile>
Name: Quinn Hartley
Pronouns: they/them
Age: 28
Gender: Non-binary
Location: Phoenix, AZ
Interests: homelab, TypeScript, AI agents
Bio: <whatever they wrote>
</user_profile>
```

Only non-null fields are included. If no profile exists or all fields are default, the section is omitted entirely.

### Implementation

New helper: `packages/plugins/context/src/_helpers/format-user-profile-section.ts`
- Accepts `UserProfile | null`
- Returns formatted string or empty string
- One export, tested in `__tests__/format-user-profile-section.test.ts`

The `onBeforeInvoke` handler adds one DB query, sequential with the existing thread query (matching the plugin's established pattern of sequential awaits with `dbAvailable` error guarding):
```typescript
const profile = await ctx.db.userProfile.findUnique({ where: { id: 'singleton' } });
```

This runs inside the existing `dbAvailable` guard. It's a primary key lookup on a single row — negligible latency.

---

## 5. Admin Sidebar

Add "Profile" to the admin sidebar in a new "Account" nav group at the top, with a single "Profile" item using the `User` icon from lucide-react. This positions personal settings above system configuration.

```typescript
{
  label: 'Account',
  items: [
    { href: '/admin/profile', label: 'Profile', icon: User },
  ],
},
```

---

## 6. Files Changed / Created

### New files
| File | Purpose |
|------|---------|
| `apps/web/src/app/_components/user-menu.tsx` | Client dropdown (replaces settings-menu) |
| `apps/web/src/app/admin/profile/page.tsx` | Profile page (async server component) |
| `apps/web/src/app/admin/profile/_components/profile-form.tsx` | Client form component |
| `apps/web/src/app/admin/profile/_actions/update-profile.ts` | Server action (upsert) |
| `apps/web/src/app/admin/profile/__tests__/page.test.tsx` | Page tests |
| `packages/plugins/context/src/_helpers/format-user-profile-section.ts` | Profile prompt formatter |
| `packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts` | Formatter tests |

### Modified files
| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add `UserProfile` model |
| `packages/database/prisma/seed.ts` | Seed default profile |
| `apps/web/src/app/_components/top-bar.tsx` | Make async, fetch profile, render UserMenu |
| `apps/web/src/app/admin/_components/admin-sidebar.tsx` | Add Account group with Profile link |
| `apps/web/src/app/admin/_components/admin-breadcrumb.tsx` | Add `profile: 'Profile'` to `SEGMENT_LABELS` |
| `apps/web/src/app/layout.tsx` | Make async to support async TopBar |
| `packages/plugins/context/src/index.ts` | Add user profile query + injection |

### Deleted files
| File | Reason |
|------|--------|
| `apps/web/src/app/_components/settings-menu.tsx` | Replaced by user-menu.tsx |

---

## 7. Testing Strategy

| Test | What it verifies |
|------|-----------------|
| `profile/__tests__/page.test.tsx` | Page renders breadcrumb, header card, form |
| `format-user-profile-section.test.ts` | Null profile → empty string; partial profile → only non-null fields; full profile → all fields formatted |
| `top-bar.test.tsx` (update) | Renders UserMenu with name prop |
| `admin-sidebar.test.tsx` (update) | Profile link present in Account group |

---

## 8. Out of Scope

- File upload / avatar image (deferred to file infrastructure work)
- Multi-user auth
- AI-writable profile fields (future: agent could update interests based on conversation)
- Structured/tokenized interests (future: tags UI with autocomplete)
