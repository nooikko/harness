# Plugin WebSocket Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make plugin connection status (starting with Discord) display in near real-time on the admin settings page via WebSocket broadcasts.

**Architecture:** Lift the existing `WsProvider` from the chat route group to the root app layout so any page can subscribe to events. The Discord plugin broadcasts connection state changes via `ctx.broadcast()` and persists state to `PluginConfig.metadata` so page loads show the last-known state. A generic `ConnectionStatus` client component reads initial state from the server and subscribes to live updates — any plugin following the `{name}:connection` + `metadata.connection` convention gets this for free.

**Tech Stack:** React 19 client components, Next.js 16 App Router, Discord.js Events, existing WsProvider (subscribe/useWs pattern), Prisma JSON metadata field

---

## Codebase Context

Read these before starting:
- `apps/web/src/app/(chat)/chat/_components/ws-provider.tsx` — the WsProvider + useWs hook being moved
- `apps/web/src/app/(chat)/layout.tsx` — currently mounts WsProvider (needs it removed)
- `apps/web/src/app/layout.tsx` — root layout (needs WsProvider added)
- `apps/web/src/app/(chat)/chat/_components/chat-area.tsx` — imports useWs (needs import path update)
- `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx` — imports useWs (needs import path update)
- `packages/plugins/discord/src/index.ts` — Discord plugin, `start` function at line 138 has ClientReady/ShardDisconnect/ShardResume event handlers where we add broadcasts

**Code style rules (from CLAUDE.md):**
- Arrow functions only — no `function` keyword declarations. Define type separately (PascalCase), annotate the const (camelCase).
- `'use client'` at top of any component using hooks
- Import from module directory, never reach into `_helpers/` from outside
- Tests in `__tests__/` subdirectories
- One export per helper file
- Run `pnpm check` after file changes (auto-formats via Biome)

---

### Task 1: Lift WsProvider to root app layout

Move the existing WsProvider out of the chat route group so every page in the app can access it via `useWs`.

**Files:**
- Create: `apps/web/src/app/_components/ws-provider.tsx` (copy from chat, same content)
- Delete: `apps/web/src/app/(chat)/chat/_components/ws-provider.tsx`
- Modify: `apps/web/src/app/layout.tsx` (add WsProvider wrapper, convert to arrow function)
- Modify: `apps/web/src/app/(chat)/layout.tsx` (remove WsProvider import + wrapper)
- Modify: `apps/web/src/app/(chat)/chat/_components/chat-area.tsx` (update import path)
- Modify: `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx` (update import path)
- Create: `apps/web/src/app/_components/__tests__/ws-provider.test.tsx` (copy from chat, update import)
- Delete: `apps/web/src/app/(chat)/chat/_components/__tests__/ws-provider.test.tsx`

**Step 1: Create new WsProvider at root components location**

`apps/web/src/app/_components/ws-provider.tsx` — identical content to the current file at `apps/web/src/app/(chat)/chat/_components/ws-provider.tsx`, just at the new path. No content changes needed.

**Step 2: Run existing ws-provider tests to confirm baseline**

```bash
pnpm --filter web test --run -- ws-provider
```

Expected: all tests pass (running from old location still).

**Step 3: Copy ws-provider tests to new location**

Create `apps/web/src/app/_components/__tests__/ws-provider.test.tsx` — same content as the current test at `apps/web/src/app/(chat)/chat/_components/__tests__/ws-provider.test.tsx`, but update the import path:

```typescript
// Old import:
import { WsProvider, useWs } from '../ws-provider';

// New import (same relative path since test is now in _components/__tests__/):
import { WsProvider, useWs } from '../ws-provider';
```

The relative path is the same (`../ws-provider`), so no content change is needed — just copy the file to the new location.

**Step 4: Update root app layout to mount WsProvider**

Replace `apps/web/src/app/layout.tsx` with (note: convert to arrow function per code style, add WsProvider wrapper):

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { WsProvider } from './_components/ws-provider';
import { TopBar } from './_components/top-bar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Harness Dashboard',
  description: 'Orchestrator dashboard — threads, tasks, crons, and real-time monitoring',
};

type RootLayoutProps = {
  children: React.ReactNode;
};

type RootLayoutComponent = (props: RootLayoutProps) => React.ReactNode;

const RootLayout: RootLayoutComponent = ({ children }) => {
  return (
    <html lang='en'>
      <body className={`${inter.className} flex h-screen flex-col`}>
        <WsProvider>
          <TopBar />
          <div className='flex min-h-0 flex-1'>{children}</div>
        </WsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
```

**Step 5: Update (chat)/layout.tsx to remove WsProvider**

`apps/web/src/app/(chat)/layout.tsx` — remove WsProvider import and wrapper. Root layout now provides it:

```tsx
import type { Metadata } from 'next';
import { ThreadSidebar } from './chat/_components/thread-sidebar';

export const metadata: Metadata = {
  title: 'Chat | Harness Dashboard',
  description: 'Multi-thread chat interface for the Harness orchestrator',
};

type ChatLayoutProps = {
  children: React.ReactNode;
};

type ChatLayoutComponent = (props: ChatLayoutProps) => React.ReactNode;

const ChatLayout: ChatLayoutComponent = ({ children }) => {
  return (
    <div className='flex h-full flex-1'>
      <ThreadSidebar />
      <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
    </div>
  );
};

export default ChatLayout;
```

**Step 6: Update import paths in chat-area.tsx and pipeline-activity.tsx**

In `apps/web/src/app/(chat)/chat/_components/chat-area.tsx`, find the ws-provider import and change it:

```typescript
// Old:
import { useWs } from './ws-provider';

// New:
import { useWs } from '@/app/_components/ws-provider';
```

In `apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx`, same change:

```typescript
// Old:
import { useWs } from './ws-provider';

// New:
import { useWs } from '@/app/_components/ws-provider';
```

**Step 7: Delete the old ws-provider files**

```bash
git rm apps/web/src/app/\(chat\)/chat/_components/ws-provider.tsx
git rm apps/web/src/app/\(chat\)/chat/_components/__tests__/ws-provider.test.tsx
```

**Step 8: Run tests to verify nothing broke**

```bash
pnpm --filter web test --run -- ws-provider
pnpm --filter web test --run -- chat-area
pnpm --filter web test --run -- pipeline-activity
```

Expected: all tests pass. If chat-area tests fail because of the WsProvider mock, update the mock import path.

**Step 9: Run typecheck and lint**

```bash
pnpm --filter web tsc --noEmit
pnpm lint
```

Expected: no errors.

**Step 10: Commit**

```bash
git add apps/web/src/app/_components/ws-provider.tsx
git add apps/web/src/app/_components/__tests__/ws-provider.test.tsx
git add apps/web/src/app/layout.tsx
git add "apps/web/src/app/(chat)/layout.tsx"
git add "apps/web/src/app/(chat)/chat/_components/chat-area.tsx"
git add "apps/web/src/app/(chat)/chat/_components/pipeline-activity.tsx"
git rm "apps/web/src/app/(chat)/chat/_components/ws-provider.tsx"
git rm "apps/web/src/app/(chat)/chat/_components/__tests__/ws-provider.test.tsx"
git commit -m "refactor(web): lift WsProvider to root app layout"
```

---

### Task 2: Discord plugin broadcasts connection state

Add `ctx.broadcast()` calls and `PluginConfig.metadata` persistence to the Discord plugin's connection event handlers so the admin UI can observe real-time connection status.

**Files:**
- Modify: `packages/plugins/discord/src/index.ts` (lines 150–170 in `start` — the Ready/Disconnect/Resume handlers)
- Modify: `packages/plugins/discord/src/__tests__/index.test.ts` (add broadcast assertions)

**Broadcast event name:** `'discord:connection'`
**Payload shape:** `{ connected: boolean; username?: string }`

This naming convention (`{pluginName}:connection`) is intentional — any plugin can follow it, making the ConnectionStatus component in Task 3 reusable without plugin-specific code in the web app.

**Step 1: Read the existing Discord plugin test file**

```bash
cat packages/plugins/discord/src/__tests__/index.test.ts
```

Note how `ctx` is mocked (look for `broadcast` mock) and how Discord.js client events are simulated. The mock ctx should already have a `broadcast` mock since it's on PluginContext.

**Step 2: Write failing tests for the broadcast calls**

In `packages/plugins/discord/src/__tests__/index.test.ts`, add these test cases inside the describe block that covers the `start` function. The existing mock client must be an EventEmitter so we can `.emit()` events on it.

```typescript
describe('start: connection broadcasts', () => {
  it('broadcasts connected status when ClientReady fires', async () => {
    await plugin.start!(mockCtx);

    const readyClient = { user: { tag: 'HarnessBot#1234' } };
    mockClient.emit('ready', readyClient);

    expect(mockCtx.broadcast).toHaveBeenCalledWith('discord:connection', {
      connected: true,
      username: 'HarnessBot#1234',
    });
  });

  it('broadcasts disconnected status when ShardDisconnect fires', async () => {
    await plugin.start!(mockCtx);

    mockClient.emit('shardDisconnect');

    expect(mockCtx.broadcast).toHaveBeenCalledWith('discord:connection', {
      connected: false,
    });
  });

  it('broadcasts connected status when ShardResume fires', async () => {
    await plugin.start!(mockCtx);

    mockClient.emit('shardResume');

    expect(mockCtx.broadcast).toHaveBeenCalledWith('discord:connection', {
      connected: true,
    });
  });
});
```

Note: adapt the `mockClient.emit()` call to use the actual event string constants from the existing test setup. Check the Discord.js `Events` enum — `Events.ClientReady` is `'ready'`, `Events.ShardDisconnect` is `'shardDisconnect'`, `Events.ShardResume` is `'shardResume'`.

**Step 3: Run tests to verify they fail**

```bash
pnpm --filter '@harness/plugin-discord' test --run
```

Expected: the 3 new tests fail.

**Step 4: Add broadcasts to the Discord plugin start function**

In `packages/plugins/discord/src/index.ts`, update the `start` function's event handlers. Find and replace the three existing handlers (ClientReady, ShardDisconnect, ShardResume) with versions that also broadcast and persist:

```typescript
client.once(Events.ClientReady, (readyClient) => {
  state.connected = true;
  ctx.logger.info(`Discord plugin: connected as ${readyClient.user.tag}`);
  void ctx.broadcast('discord:connection', { connected: true, username: readyClient.user.tag });
  void ctx.db.pluginConfig
    .update({
      where: { pluginName: 'discord' },
      data: { metadata: { connection: { connected: true, username: readyClient.user.tag } } },
    })
    .catch((err: unknown) => {
      ctx.logger.warn(
        `Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
});

client.on(Events.ShardDisconnect, () => {
  state.connected = false;
  ctx.logger.warn('Discord plugin: disconnected from gateway');
  void ctx.broadcast('discord:connection', { connected: false });
  void ctx.db.pluginConfig
    .update({
      where: { pluginName: 'discord' },
      data: { metadata: { connection: { connected: false } } },
    })
    .catch((err: unknown) => {
      ctx.logger.warn(
        `Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
});

client.on(Events.ShardReconnecting, () => {
  ctx.logger.info('Discord plugin: reconnecting to gateway...');
});

client.on(Events.ShardResume, () => {
  state.connected = true;
  ctx.logger.info('Discord plugin: reconnected to gateway');
  void ctx.broadcast('discord:connection', { connected: true });
  void ctx.db.pluginConfig
    .update({
      where: { pluginName: 'discord' },
      data: { metadata: { connection: { connected: true } } },
    })
    .catch((err: unknown) => {
      ctx.logger.warn(
        `Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
});
```

**Note on `void` + `.catch()`:** `void` because these are fire-and-forget (we don't want to block the Discord event handler on a DB write). `.catch()` prevents unhandled promise rejections from crashing the process.

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter '@harness/plugin-discord' test --run
```

Expected: all tests pass.

**Step 6: Typecheck the discord plugin**

```bash
pnpm --filter '@harness/plugin-discord' tsc --noEmit
```

Expected: no errors.

**Step 7: Commit**

```bash
git add packages/plugins/discord/src/index.ts
git add packages/plugins/discord/src/__tests__/index.test.ts
git commit -m "feat(discord): broadcast and persist connection state changes"
```

---

### Task 3: Plugin settings page shows connection status

Add a `ConnectionStatus` component that shows current connection state from DB on page load and updates in real-time via WebSocket. Any plugin that broadcasts `{name}:connection` events and stores `metadata.connection` gets this indicator automatically.

**Files:**
- Create: `apps/web/src/app/admin/plugins/[name]/_components/connection-status.tsx`
- Create: `apps/web/src/app/admin/plugins/[name]/_components/__tests__/connection-status.test.tsx`
- Modify: `apps/web/src/app/admin/plugins/[name]/page.tsx` (read metadata, render ConnectionStatus)
- Modify: `apps/web/src/app/admin/plugins/[name]/__tests__/page.test.tsx` (add ConnectionStatus test cases)

**Step 1: Write failing tests for ConnectionStatus**

`apps/web/src/app/admin/plugins/[name]/_components/__tests__/connection-status.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from '../connection-status';

vi.mock('@/app/_components/ws-provider', () => ({
  useWs: vi.fn(() => ({ lastEvent: null, isConnected: false })),
}));

import { useWs } from '@/app/_components/ws-provider';

const mockUseWs = vi.mocked(useWs);

describe('ConnectionStatus', () => {
  it('shows connected state with username from initial props', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: true });

    render(
      <ConnectionStatus
        pluginName='discord'
        initialState={{ connected: true, username: 'HarnessBot#1234' }}
      />,
    );

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByText(/HarnessBot#1234/)).toBeInTheDocument();
  });

  it('shows disconnected state from initial props', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    render(
      <ConnectionStatus
        pluginName='discord'
        initialState={{ connected: false }}
      />,
    );

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.queryByText(/as /)).not.toBeInTheDocument();
  });

  it('updates to connected when WebSocket event fires', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    const { rerender } = render(
      <ConnectionStatus
        pluginName='discord'
        initialState={{ connected: false }}
      />,
    );

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();

    mockUseWs.mockReturnValue({
      lastEvent: { connected: true, username: 'HarnessBot#1234' },
      isConnected: true,
    });

    await act(async () => {
      rerender(
        <ConnectionStatus
          pluginName='discord'
          initialState={{ connected: false }}
        />,
      );
    });

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('subscribes to the correct event name based on pluginName', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    render(
      <ConnectionStatus
        pluginName='discord'
        initialState={{ connected: false }}
      />,
    );

    expect(mockUseWs).toHaveBeenCalledWith('discord:connection');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter web test --run -- connection-status
```

Expected: FAIL — `ConnectionStatus` module not found.

**Step 3: Implement ConnectionStatus component**

`apps/web/src/app/admin/plugins/[name]/_components/connection-status.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useWs } from '@/app/_components/ws-provider';

type ConnectionState = {
  connected: boolean;
  username?: string;
};

type ConnectionStatusProps = {
  pluginName: string;
  initialState: ConnectionState;
};

type ConnectionStatusComponent = (props: ConnectionStatusProps) => React.ReactNode;

export const ConnectionStatus: ConnectionStatusComponent = ({ pluginName, initialState }) => {
  const [state, setState] = useState<ConnectionState>(initialState);
  const { lastEvent } = useWs(`${pluginName}:connection`);

  useEffect(() => {
    if (lastEvent !== null) {
      setState(lastEvent as ConnectionState);
    }
  }, [lastEvent]);

  return (
    <div className='flex items-center gap-2 text-sm'>
      <span
        className={`inline-block h-2 w-2 rounded-full ${state.connected ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span>{state.connected ? 'Connected' : 'Disconnected'}</span>
      {state.connected && state.username && (
        <span className='text-muted-foreground'>as {state.username}</span>
      )}
    </div>
  );
};
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter web test --run -- connection-status
```

Expected: all 4 tests pass.

**Step 5: Update the plugin settings page to render ConnectionStatus**

In `apps/web/src/app/admin/plugins/[name]/page.tsx`:

Add import at top:
```typescript
import { ConnectionStatus } from './_components/connection-status';
```

After the existing `config` variable (which holds the full PluginConfig row), add:
```typescript
type PluginConnectionState = {
  connected: boolean;
  username?: string;
};

type PluginMetadata = {
  connection?: PluginConnectionState;
};

const metadata = (config?.metadata ?? null) as PluginMetadata | null;
```

In the JSX, add the ConnectionStatus before the SettingsForm (after the page heading/title):
```tsx
{metadata?.connection !== undefined && (
  <ConnectionStatus
    pluginName={name}
    initialState={metadata.connection ?? { connected: false }}
  />
)}
```

**Step 6: Update page tests to add ConnectionStatus cases**

In `apps/web/src/app/admin/plugins/[name]/__tests__/page.test.tsx`:

Add the ConnectionStatus mock near the top of the test file with the other mocks:
```typescript
vi.mock('../_components/connection-status', () => ({
  ConnectionStatus: ({
    pluginName,
    initialState,
  }: {
    pluginName: string;
    initialState: { connected: boolean };
  }) => (
    <div
      data-testid='connection-status'
      data-plugin={pluginName}
      data-connected={String(initialState.connected)}
    />
  ),
}));
```

Add two test cases:
```typescript
it('renders ConnectionStatus when PluginConfig metadata has connection field', async () => {
  mockFindUnique.mockResolvedValue({
    pluginName: 'discord',
    enabled: true,
    settings: null,
    metadata: { connection: { connected: true, username: 'HarnessBot#1234' } },
  });

  render(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));

  const status = screen.getByTestId('connection-status');
  expect(status).toBeInTheDocument();
  expect(status).toHaveAttribute('data-connected', 'true');
});

it('does not render ConnectionStatus when PluginConfig metadata has no connection field', async () => {
  mockFindUnique.mockResolvedValue({
    pluginName: 'discord',
    enabled: true,
    settings: null,
    metadata: null,
  });

  render(await PluginSettingsPage({ params: Promise.resolve({ name: 'discord' }) }));

  expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();
});
```

**Step 7: Run all affected tests**

```bash
pnpm --filter web test --run -- connection-status
pnpm --filter web test --run -- "plugins"
```

Expected: all pass.

**Step 8: Run full validation**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: no errors, clean build.

**Step 9: Commit**

```bash
git add "apps/web/src/app/admin/plugins/[name]/_components/connection-status.tsx"
git add "apps/web/src/app/admin/plugins/[name]/_components/__tests__/connection-status.test.tsx"
git add "apps/web/src/app/admin/plugins/[name]/page.tsx"
git add "apps/web/src/app/admin/plugins/[name]/__tests__/page.test.tsx"
git commit -m "feat(web): add real-time connection status to plugin settings page"
```

---

## Final Verification

After all three tasks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

All should pass. The one known OOM in `chat-area.test.tsx` is a pre-existing issue unrelated to this work — it causes a worker crash but all other 74 test files still pass.
