# User Profile Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a singleton UserProfile model, a polished profile page at `/admin/profile`, a user dropdown in the top bar, and user context injection into AI prompts.

**Architecture:** Singleton `UserProfile` row in PostgreSQL (fixed ID "singleton"). Profile page at `/admin/profile` with async server component + client form. TopBar becomes async to fetch profile name for the user dropdown. Context plugin injects profile into prompts via `onBeforeInvoke`.

**Tech Stack:** Prisma 6, Next.js 16 App Router, React 19, shadcn/ui (Card, Input, Label, Textarea, DropdownMenu), Tailwind CSS 4, Vitest

**Spec:** `AI_RESEARCH/user-profile-design.md`

---

## Chunk 1: Data Layer

### Task 1: Add UserProfile model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add UserProfile model**

Add at the end of the schema file, before closing:

```prisma
model UserProfile {
  id        String   @id @default("singleton")
  name      String   @default("User")
  pronouns  String?
  age       Int?
  gender    String?
  location  String?
  interests String?
  bio       String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Generate Prisma client**

Run: `pnpm db:generate`
Expected: Prisma client regenerated with `UserProfile` type available

- [ ] **Step 3: Push schema to database**

Run: `pnpm db:push`
Expected: `UserProfile` table created in PostgreSQL

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add UserProfile singleton model"
```

---

### Task 2: Seed default UserProfile

**Files:**
- Modify: `packages/database/prisma/seed.ts`

- [ ] **Step 1: Add seedUserProfile function**

Add after the `seedCronJobs` function, before `seed`:

```typescript
type SeedUserProfile = () => Promise<void>;

const seedUserProfile: SeedUserProfile = async () => {
  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {},
  });
};
```

The `create: {}` uses all schema defaults — `id: "singleton"`, `name: "User"`, everything else null.

- [ ] **Step 2: Call seedUserProfile in the seed function**

Add after the cron jobs seed call:

```typescript
await seedUserProfile();
console.log('User profile seeded');
```

- [ ] **Step 3: Run seed to verify**

Run: `pnpm --filter database db:push && npx --filter database prisma db seed`
Expected: "User profile seeded" in output, no errors

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat(database): seed default UserProfile singleton"
```

---

## Chunk 2: Context Plugin — AI Injection

### Task 3: Create format-user-profile-section helper

**Files:**
- Create: `packages/plugins/context/src/_helpers/format-user-profile-section.ts`
- Create: `packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, expect, it } from 'vitest';
import { formatUserProfileSection } from '../format-user-profile-section';

describe('formatUserProfileSection', () => {
  it('returns empty string for null profile', () => {
    expect(formatUserProfileSection(null)).toBe('');
  });

  it('returns empty string for default profile (name "User", everything else null)', () => {
    const profile = {
      id: 'singleton',
      name: 'User',
      pronouns: null,
      age: null,
      gender: null,
      location: null,
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(formatUserProfileSection(profile)).toBe('');
  });

  it('formats full profile with all fields', () => {
    const profile = {
      id: 'singleton',
      name: 'Quinn',
      pronouns: 'they/them',
      age: 28,
      gender: 'Non-binary',
      location: 'Phoenix, AZ',
      interests: 'homelab, TypeScript, AI',
      bio: 'I build things.',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('<user_profile>');
    expect(result).toContain('</user_profile>');
    expect(result).toContain('Name: Quinn');
    expect(result).toContain('Pronouns: they/them');
    expect(result).toContain('Age: 28');
    expect(result).toContain('Gender: Non-binary');
    expect(result).toContain('Location: Phoenix, AZ');
    expect(result).toContain('Interests: homelab, TypeScript, AI');
    expect(result).toContain('Bio: I build things.');
  });

  it('omits null fields from output', () => {
    const profile = {
      id: 'singleton',
      name: 'Quinn',
      pronouns: null,
      age: null,
      gender: null,
      location: 'Phoenix, AZ',
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('Name: Quinn');
    expect(result).toContain('Location: Phoenix, AZ');
    expect(result).not.toContain('Pronouns');
    expect(result).not.toContain('Age');
    expect(result).not.toContain('Gender');
    expect(result).not.toContain('Interests');
    expect(result).not.toContain('Bio');
  });

  it('includes name even when it is "User" if other fields are present', () => {
    const profile = {
      id: 'singleton',
      name: 'User',
      pronouns: null,
      age: null,
      gender: null,
      location: 'Phoenix, AZ',
      interests: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = formatUserProfileSection(profile);
    expect(result).toContain('Name: User');
    expect(result).toContain('Location: Phoenix, AZ');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the helper**

```typescript
import type { UserProfile } from '@prisma/client';

type FormatUserProfileSection = (profile: UserProfile | null) => string;

export const formatUserProfileSection: FormatUserProfileSection = (profile) => {
  if (!profile) {
    return '';
  }

  // Collect all non-null optional fields first
  const optionalLines: string[] = [];
  if (profile.pronouns) optionalLines.push(`Pronouns: ${profile.pronouns}`);
  if (profile.age !== null) optionalLines.push(`Age: ${profile.age}`);
  if (profile.gender) optionalLines.push(`Gender: ${profile.gender}`);
  if (profile.location) optionalLines.push(`Location: ${profile.location}`);
  if (profile.interests) optionalLines.push(`Interests: ${profile.interests}`);
  if (profile.bio) optionalLines.push(`Bio: ${profile.bio}`);

  // If name is default "User" and no other fields, omit entirely
  if (profile.name === 'User' && optionalLines.length === 0) {
    return '';
  }

  const lines = [`Name: ${profile.name}`, ...optionalLines];
  return `<user_profile>\n${lines.join('\n')}\n</user_profile>`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/context/src/_helpers/format-user-profile-section.ts packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts
git commit -m "feat(plugin-context): add format-user-profile-section helper with tests"
```

---

### Task 4: Wire user profile injection into context plugin

**Files:**
- Modify: `packages/plugins/context/src/index.ts`

- [ ] **Step 1: Add import**

Add to the imports at the top of the file:

```typescript
import { formatUserProfileSection } from './_helpers/format-user-profile-section';
```

- [ ] **Step 2: Add profile query inside the existing try/catch block**

Inside `onBeforeInvoke`, add the profile query inside the existing thread query try block (around line 82-96). Add it after `thread = await ctx.db.thread.findUnique(...)` and before the `catch`:

```typescript
// Inside the existing try block, after the thread query:
const profile = await ctx.db.userProfile.findUnique({ where: { id: 'singleton' } });
userProfileSection = formatUserProfileSection(profile);
```

And declare `let userProfileSection = '';` before the try/catch block (alongside the existing `let thread` and `let dbAvailable` declarations). If DB fails, both thread and profile are skipped together — this matches the existing error handling pattern.

- [ ] **Step 3: Add userProfileSection to buildPrompt call**

Update the `return buildPrompt(...)` call at the end of `onBeforeInvoke` to include `userProfileSection` between `projectMemorySection` and `contextSection`:

Change:
```typescript
return buildPrompt([projectInstructionsSection ?? '', projectMemorySection ?? '', contextSection, summarySection, historySection, prompt]);
```

To:
```typescript
return buildPrompt([projectInstructionsSection ?? '', projectMemorySection ?? '', userProfileSection, contextSection, summarySection, historySection, prompt]);
```

- [ ] **Step 4: Run context plugin tests**

Run: `pnpm vitest run packages/plugins/context/`
Expected: All existing tests pass (profile query is behind try/catch, won't break existing behavior)

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/context/src/index.ts
git commit -m "feat(plugin-context): inject user profile into AI prompts via onBeforeInvoke"
```

---

## Chunk 3: Top Bar User Dropdown

### Task 5: Create UserMenu client component

**Files:**
- Create: `apps/web/src/app/_components/user-menu.tsx`

- [ ] **Step 1: Write the UserMenu component**

```tsx
'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@harness/ui';
import { BarChart2, Settings, User } from 'lucide-react';
import Link from 'next/link';

type UserMenuProps = {
  name: string;
};

type UserMenuComponent = (props: UserMenuProps) => React.ReactNode;

export const UserMenu: UserMenuComponent = ({ name }) => {
  const initial = name.charAt(0).toUpperCase();
  const isDefault = name === 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          aria-label='User menu'
        >
          {isDefault ? <User className='h-4 w-4' /> : initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 rounded-lg' align='end' sideOffset={8}>
        <DropdownMenuLabel className='font-normal'>
          <span className='text-sm font-medium'>{isDefault ? 'Set up your profile' : name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href='/admin/profile'>
              <User className='h-4 w-4' />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/admin'>
              <Settings className='h-4 w-4' />
              Admin
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/admin/usage'>
              <BarChart2 className='h-4 w-4' />
              Usage
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/_components/user-menu.tsx
git commit -m "feat(web): add UserMenu dropdown component"
```

---

### Task 6: Convert TopBar to async and wire UserMenu

**Files:**
- Modify: `apps/web/src/app/_components/top-bar.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Rewrite top-bar.tsx**

Replace the entire file:

```tsx
import { prisma } from '@harness/database';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { UserMenu } from './user-menu';

type TopBarComponent = () => Promise<React.ReactNode>;

export const TopBar: TopBarComponent = async () => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
    select: { name: true },
  });

  const name = profile?.name ?? 'User';

  return (
    <header className='flex h-12 shrink-0 items-center border-b border-border bg-background px-4'>
      <Link href='/' className='text-sm font-semibold tracking-tight text-foreground'>
        Harness
      </Link>
      <div className='mx-auto'>
        <button
          type='button'
          className='flex w-64 items-center gap-2 rounded-md border border-border/60 px-2.5 py-1 text-left transition-colors hover:bg-muted/50'
          aria-label='Open command palette'
        >
          <Search className='h-3 w-3 shrink-0 text-muted-foreground/60' />
          <span className='flex-1 text-xs text-muted-foreground/60'>Search…</span>
          <kbd className='rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60'>⌘K</kbd>
        </button>
      </div>
      <UserMenu name={name} />
    </header>
  );
};
```

- [ ] **Step 2: Delete settings-menu.tsx**

Delete `apps/web/src/app/_components/settings-menu.tsx` — it is fully replaced by `user-menu.tsx`.

- [ ] **Step 3: Update root layout to async**

In `apps/web/src/app/layout.tsx`, change the layout function signature from sync to async. The only change is adding `async` to the function:

Change:
```typescript
const RootLayout: RootLayoutComponent = ({ children }) => {
```
To:
```typescript
const RootLayout: RootLayoutComponent = async ({ children }) => {
```

And update the type:
```typescript
type RootLayoutComponent = (props: RootLayoutProps) => Promise<React.ReactNode>;
```

- [ ] **Step 4: Update top-bar tests**

Rewrite `apps/web/src/app/_components/__tests__/top-bar.test.tsx` to test the async server component using `renderToStaticMarkup`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../user-menu', () => ({
  UserMenu: ({ name }: { name: string }) => <span data-testid='user-menu'>{name}</span>,
}));

const { TopBar } = await import('../top-bar');

describe('TopBar', () => {
  it('renders Harness link', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Harness');
    expect(html).toContain('href="/"');
  });

  it('renders search button with ⌘K hint', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Search…');
    expect(html).toContain('⌘K');
  });

  it('passes profile name to UserMenu', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="user-menu"');
    expect(html).toContain('Quinn');
  });

  it('falls back to "User" when no profile exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('User');
  });
});
```

- [ ] **Step 5: Run top-bar tests**

Run: `pnpm vitest run apps/web/src/app/_components/__tests__/top-bar.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/_components/top-bar.tsx apps/web/src/app/_components/user-menu.tsx apps/web/src/app/_components/__tests__/top-bar.test.tsx apps/web/src/app/layout.tsx
git rm apps/web/src/app/_components/settings-menu.tsx
git commit -m "feat(web): replace SettingsMenu with UserMenu dropdown in top bar"
```

---

## Chunk 4: Admin Sidebar & Breadcrumb

### Task 7: Add Profile to admin sidebar and breadcrumb

**Files:**
- Modify: `apps/web/src/app/admin/_components/admin-sidebar.tsx`
- Modify: `apps/web/src/app/admin/_components/admin-breadcrumb.tsx`

- [ ] **Step 1: Add Account group to admin sidebar**

In `admin-sidebar.tsx`, add `User` to the lucide-react import:

```typescript
import { Activity, BarChart3, Calendar, CheckSquare, MessageSquare, Puzzle, User } from 'lucide-react';
```

Add a new nav group at the beginning of the `NAV_GROUPS` array:

```typescript
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [{ href: '/admin/profile', label: 'Profile', icon: User }],
  },
  {
    label: 'Configuration',
    // ... existing items
  },
  // ... rest unchanged
];
```

- [ ] **Step 2: Add profile to SEGMENT_LABELS in breadcrumb**

In `admin-breadcrumb.tsx`, add to the `SEGMENT_LABELS` object:

```typescript
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  profile: 'Profile',
  'cron-jobs': 'Scheduled Tasks',
  // ... rest unchanged
};
```

- [ ] **Step 3: Update admin sidebar tests**

In `apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx`:

Update the link count test from 6 to 7:

```typescript
it('renders all 7 navigation links', () => {
  renderWithProvider(<AdminSidebar />);
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(7);
});
```

Add a new test for the Profile link:

```typescript
it('renders the Profile link', () => {
  renderWithProvider(<AdminSidebar />);
  expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/admin/profile');
});
```

Replace the existing test that checks for `'Admin'` group label (which no longer exists — the groups are Account, Configuration, Activity, Analytics):

```typescript
it('renders the Account group label', () => {
  renderWithProvider(<AdminSidebar />);
  expect(screen.getByText('Account')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run sidebar tests**

Run: `pnpm vitest run apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx`
Expected: All tests PASS (10 tests — 9 existing updated + 1 new)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/_components/admin-sidebar.tsx apps/web/src/app/admin/_components/admin-breadcrumb.tsx apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx
git commit -m "feat(web): add Profile link to admin sidebar and breadcrumb"
```

---

## Chunk 5: Profile Page

### Task 8: Create update-profile server action

**Files:**
- Create: `apps/web/src/app/admin/profile/_actions/update-profile.ts`

- [ ] **Step 1: Write the server action**

```typescript
'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateProfile = (formData: FormData) => Promise<void>;

export const updateProfile: UpdateProfile = async (formData) => {
  const name = formData.get('name') as string;
  const pronouns = (formData.get('pronouns') as string) || null;
  const ageRaw = formData.get('age') as string;
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : null;
  const gender = (formData.get('gender') as string) || null;
  const location = (formData.get('location') as string) || null;
  const interests = (formData.get('interests') as string) || null;
  const bio = (formData.get('bio') as string) || null;

  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    create: { name, pronouns, age, gender, location, interests, bio },
    update: { name, pronouns, age, gender, location, interests, bio },
  });

  revalidatePath('/admin/profile');
  revalidatePath('/');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/profile/_actions/update-profile.ts
git commit -m "feat(web): add update-profile server action"
```

---

### Task 9: Create ProfileForm client component

**Files:**
- Create: `apps/web/src/app/admin/profile/_components/profile-form.tsx`

- [ ] **Step 1: Write the ProfileForm component**

This is the most design-intensive component. It should feel like a personal identity page, not a generic admin form.

```tsx
'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Separator, Textarea } from '@harness/ui';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { updateProfile } from '../_actions/update-profile';

type ProfileFormProps = {
  profile: {
    name: string;
    pronouns: string | null;
    age: number | null;
    gender: string | null;
    location: string | null;
    interests: string | null;
    bio: string | null;
  };
};

type ProfileFormComponent = (props: ProfileFormProps) => React.ReactNode;

export const ProfileForm: ProfileFormComponent = ({ profile }) => {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await updateProfile(formData);
      setSaved(true);
    });
  };

  const isDefault = profile.name === 'User' && !profile.pronouns && !profile.location;

  // Build subtitle parts for the header display
  const subtitleParts: string[] = [];
  if (profile.pronouns) subtitleParts.push(profile.pronouns);
  if (profile.location) subtitleParts.push(profile.location);

  return (
    <div className='flex flex-col gap-8'>
      {/* Profile Header Card — read-only display of current saved state */}
      <Card>
        <CardContent className='flex items-center gap-5 p-6'>
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary'>
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className='flex flex-col gap-0.5'>
            {isDefault ? (
              <>
                <p className='text-lg font-semibold text-foreground'>Set up your profile</p>
                <p className='text-sm text-muted-foreground'>
                  Tell your AI assistant about yourself to personalize your experience.
                </p>
              </>
            ) : (
              <>
                <p className='text-lg font-semibold text-foreground'>{profile.name}</p>
                {subtitleParts.length > 0 && (
                  <p className='text-sm text-muted-foreground'>{subtitleParts.join(' · ')}</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <form ref={formRef} action={handleSubmit} className='flex flex-col gap-8'>
        {/* Identity Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>Identity</CardTitle>
            <CardDescription>How you'd like to be addressed.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-5'>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='name'>Name</Label>
                <Input id='name' name='name' defaultValue={profile.name} required />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='pronouns'>Pronouns</Label>
                <Input id='pronouns' name='pronouns' defaultValue={profile.pronouns ?? ''} placeholder='e.g. they/them' />
              </div>
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='age'>Age</Label>
                <Input id='age' name='age' type='number' min={0} max={150} defaultValue={profile.age ?? ''} />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='gender'>Gender</Label>
                <Input id='gender' name='gender' defaultValue={profile.gender ?? ''} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Interests Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>Location & Interests</CardTitle>
            <CardDescription>Context that helps your AI understand you better.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-5'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='location'>Location</Label>
              <Input id='location' name='location' defaultValue={profile.location ?? ''} placeholder='e.g. Phoenix, AZ' />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='interests'>Interests</Label>
              <Input id='interests' name='interests' defaultValue={profile.interests ?? ''} placeholder='e.g. homelab, TypeScript, AI agents' />
              <p className='text-xs text-muted-foreground'>Separate interests with commas.</p>
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-sm font-medium'>About</CardTitle>
            <CardDescription>Anything else you'd like your AI to know about you.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='bio'>Bio</Label>
              <Textarea
                id='bio'
                name='bio'
                defaultValue={profile.bio ?? ''}
                className='min-h-[120px] resize-y'
                placeholder='Tell your assistant about yourself...'
              />
            </div>
            <Separator />
            <p className='text-xs text-muted-foreground'>
              This information is shared with your AI assistant to personalize responses.
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className='flex justify-end'>
          <Button type='submit' disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Saving…
              </>
            ) : saved ? (
              <>
                <Check className='h-4 w-4' />
                Saved
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/profile/_components/profile-form.tsx
git commit -m "feat(web): add ProfileForm client component with sectioned card layout"
```

---

### Task 10: Create profile page

**Files:**
- Create: `apps/web/src/app/admin/profile/page.tsx`
- Create: `apps/web/src/app/admin/profile/__tests__/page.test.tsx`

- [ ] **Step 1: Write page tests**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../_components/profile-form', () => ({
  ProfileForm: ({ profile }: { profile: { name: string } }) => (
    <div data-testid='profile-form' data-name={profile.name} />
  ),
}));

vi.mock('../../../_components/admin-breadcrumb', () => ({
  AdminBreadcrumb: () => <nav data-testid='breadcrumb'>Admin &gt; Profile</nav>,
}));

const { default: ProfilePage } = await import('../page');

describe('ProfilePage', () => {
  it('renders breadcrumb', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn', pronouns: null, age: null, gender: null, location: null, interests: null, bio: null });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="breadcrumb"');
  });

  it('renders page heading', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn', pronouns: null, age: null, gender: null, location: null, interests: null, bio: null });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Profile');
  });

  it('passes profile data to ProfileForm', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn', pronouns: 'they/them', age: 28, gender: null, location: 'Phoenix', interests: null, bio: null });
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="profile-form"');
    expect(html).toContain('data-name="Quinn"');
  });

  it('uses default profile when none exists in DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const element = await ProfilePage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-name="User"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/web/src/app/admin/profile/__tests__/page.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the profile page**

```tsx
import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { AdminBreadcrumb } from '../../_components/admin-breadcrumb';
import { ProfileForm } from './_components/profile-form';

export const metadata: Metadata = {
  title: 'Profile | Admin | Harness Dashboard',
};

type ProfilePageComponent = () => Promise<React.ReactNode>;

const ProfilePage: ProfilePageComponent = async () => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
    select: {
      name: true,
      pronouns: true,
      age: true,
      gender: true,
      location: true,
      interests: true,
      bio: true,
    },
  });

  const data = profile ?? {
    name: 'User',
    pronouns: null,
    age: null,
    gender: null,
    location: null,
    interests: null,
    bio: null,
  };

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Profile</h1>
          <p className='text-sm text-muted-foreground'>Manage your personal information and AI context.</p>
        </div>
      </div>
      <ProfileForm profile={data} />
    </div>
  );
};

export default ProfilePage;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run apps/web/src/app/admin/profile/__tests__/page.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/profile/page.tsx apps/web/src/app/admin/profile/__tests__/page.test.tsx apps/web/src/app/admin/profile/_actions/update-profile.ts apps/web/src/app/admin/profile/_components/profile-form.tsx
git commit -m "feat(web): add /admin/profile page with form and server action"
```

---

## Chunk 6: Verification

### Task 11: Full verification pass

- [ ] **Step 1: Run all affected tests**

Run: `pnpm vitest run apps/web/src/app/_components/__tests__/top-bar.test.tsx apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx apps/web/src/app/admin/profile/__tests__/page.test.tsx packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts`

Expected: All tests pass

- [ ] **Step 2: Run typecheck on affected packages**

Run: `pnpm --filter web typecheck && pnpm --filter @harness/plugin-context typecheck`

Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `pnpm --filter web lint && pnpm --filter @harness/plugin-context lint`

Expected: No lint errors

- [ ] **Step 4: Run build for web**

Run: `pnpm --filter web build`

Expected: Build succeeds

---

## File Summary

### New files (7)
| File | Purpose |
|------|---------|
| `apps/web/src/app/_components/user-menu.tsx` | Client dropdown replacing settings-menu |
| `apps/web/src/app/admin/profile/page.tsx` | Profile page (async server component) |
| `apps/web/src/app/admin/profile/_components/profile-form.tsx` | Client form with card sections |
| `apps/web/src/app/admin/profile/_actions/update-profile.ts` | Server action (upserts singleton) |
| `apps/web/src/app/admin/profile/__tests__/page.test.tsx` | Page tests |
| `packages/plugins/context/src/_helpers/format-user-profile-section.ts` | Profile prompt formatter |
| `packages/plugins/context/src/_helpers/__tests__/format-user-profile-section.test.ts` | Formatter tests |

### Modified files (6)
| File | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | Add UserProfile model |
| `packages/database/prisma/seed.ts` | Seed default profile |
| `apps/web/src/app/_components/top-bar.tsx` | Async, fetch profile, render UserMenu |
| `apps/web/src/app/layout.tsx` | Make async |
| `apps/web/src/app/admin/_components/admin-sidebar.tsx` | Add Account group |
| `apps/web/src/app/admin/_components/admin-breadcrumb.tsx` | Add profile segment label |
| `packages/plugins/context/src/index.ts` | Add user profile query + injection |

### Deleted files (1)
| File | Reason |
|------|--------|
| `apps/web/src/app/_components/settings-menu.tsx` | Replaced by user-menu.tsx |

### Test files updated (1)
| File | Change |
|------|--------|
| `apps/web/src/app/_components/__tests__/top-bar.test.tsx` | Rewritten for async + UserMenu |
| `apps/web/src/app/admin/_components/__tests__/admin-sidebar.test.tsx` | Profile link + count update |
