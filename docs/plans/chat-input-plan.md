# Chat Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a chat input to the web dashboard so the user can send messages in threads and receive AI responses from the orchestrator.

**Architecture:** Next.js server action sends messages to the orchestrator's existing `POST /api/chat` endpoint and writes user messages to the DB for immediate display. A client-side WebSocket connection to the orchestrator's broadcaster pushes `pipeline:complete` events back, triggering `router.refresh()` to show the assistant's response. A "New Chat" button creates threads from the web UI.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), React 19, WebSocket (native browser API), Prisma 6, ShadCN UI components from `"ui"` package, Vitest + Testing Library.

---

## Conventions Reference

Before starting any task, know these project conventions:

- **Arrow functions only.** Define type separately (PascalCase), then `const name: Type = ...`
- **File naming:** kebab-case only. `_components/`, `_helpers/`, `_actions/` for private modules.
- **Tests:** `__tests__/` directory next to what they test. Mock database with `vi.mock('database', ...)`.
- **Server actions:** `'use server'` directive at top. Import `prisma` from `'database'`, `revalidatePath` from `'next/cache'`.
- **Components import UI from `"ui"`:** `import { Button, Input, ScrollArea } from "ui"`
- **Client components:** `'use client'` directive at top.
- **Types co-located** in the file that uses them. No centralized types.ts.
- **One export per helper file.** Named to match kebab-case filename.
- **Imports:** Always from module directory, never reach into `_helpers/`. No file extensions.
- **Test async server components:** Use `renderToStaticMarkup`. Client components use `@testing-library/react`.
- **Dynamic imports in tests:** Use `const { fn } = await import('../module')` after `vi.mock(...)`.

---

### Task 1: Environment Variable for Orchestrator URL

**Files:**
- Modify: `.env.example:8` (add new env var)
- Create: `apps/web/src/app/_helpers/get-orchestrator-url.ts`
- Create: `apps/web/src/app/_helpers/__tests__/get-orchestrator-url.test.ts`

**Context:** The Next.js app (port 4000) needs to call the orchestrator's web plugin (port 4001). We need a server-side helper to read the URL, and a `NEXT_PUBLIC_` env var for the client-side WebSocket connection.

**Step 1: Write the failing test**

Create `apps/web/src/app/_helpers/__tests__/get-orchestrator-url.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getOrchestratorUrl } = await import('../get-orchestrator-url');

describe('getOrchestratorUrl', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the ORCHESTRATOR_URL env var when set', () => {
    process.env = { ...originalEnv, ORCHESTRATOR_URL: 'http://custom:9999' };
    expect(getOrchestratorUrl()).toBe('http://custom:9999');
  });

  it('returns default localhost:4001 when env var is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.ORCHESTRATOR_URL;
    expect(getOrchestratorUrl()).toBe('http://localhost:4001');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/_helpers/__tests__/get-orchestrator-url.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/_helpers/get-orchestrator-url.ts`:

```typescript
type GetOrchestratorUrl = () => string;

export const getOrchestratorUrl: GetOrchestratorUrl = () => {
  return process.env.ORCHESTRATOR_URL ?? 'http://localhost:4001';
};
```

**Step 4: Add env var to .env.example**

Add to `.env.example` after the existing orchestrator section:

```
# Orchestrator connection (for web dashboard → orchestrator API)
ORCHESTRATOR_URL="http://localhost:4001"
NEXT_PUBLIC_ORCHESTRATOR_WS_URL="ws://localhost:4001/ws"
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/_helpers/__tests__/get-orchestrator-url.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/app/_helpers/get-orchestrator-url.ts apps/web/src/app/_helpers/__tests__/get-orchestrator-url.test.ts .env.example
git commit -m "feat(web): add orchestrator URL helper and env config"
```

---

### Task 2: sendMessage Server Action

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_actions/send-message.ts`
- Create: `apps/web/src/app/(chat)/chat/_actions/__tests__/send-message.test.ts`

**Context:** This server action does two things: (1) writes the user message to the DB immediately so it appears in the UI, and (2) POSTs to the orchestrator's `POST /api/chat` endpoint to trigger the AI pipeline. The orchestrator endpoint expects `{ threadId: string, content: string }`.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_actions/__tests__/send-message.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockGetOrchestratorUrl = vi.fn().mockReturnValue('http://localhost:4001');
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => mockGetOrchestratorUrl(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { sendMessage } = await import('../send-message');

describe('sendMessage', () => {
  it('creates a message in the database', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    await sendMessage('thread-1', 'Hello');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'user',
        content: 'Hello',
      },
    });
  });

  it('updates thread lastActivity', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    await sendMessage('thread-1', 'Hello');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { lastActivity: expect.any(Date) },
    });
  });

  it('posts to orchestrator API', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    await sendMessage('thread-1', 'Hello');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1', content: 'Hello' }),
    });
  });

  it('revalidates the chat path', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    await sendMessage('thread-1', 'Hello');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat/thread-1');
  });

  it('returns error when content is empty', async () => {
    const result = await sendMessage('thread-1', '   ');
    expect(result).toEqual({ error: 'Message cannot be empty' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when orchestrator is unreachable', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await sendMessage('thread-1', 'Hello');

    expect(result).toEqual({ error: 'Could not reach orchestrator. Make sure it is running.' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_actions/__tests__/send-message.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/(chat)/chat/_actions/send-message.ts`:

```typescript
'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type SendMessageResult = { error: string } | undefined;

type SendMessage = (threadId: string, content: string) => Promise<SendMessageResult>;

export const sendMessage: SendMessage = async (threadId, content) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: 'Message cannot be empty' };
  }

  await prisma.message.create({
    data: {
      threadId,
      role: 'user',
      content: trimmed,
    },
  });

  await prisma.thread.update({
    where: { id: threadId },
    data: { lastActivity: new Date() },
  });

  revalidatePath(`/chat/${threadId}`);

  try {
    await fetch(`${getOrchestratorUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content: trimmed }),
    });
  } catch {
    return { error: 'Could not reach orchestrator. Make sure it is running.' };
  }
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_actions/__tests__/send-message.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_actions/send-message.ts apps/web/src/app/\(chat\)/chat/_actions/__tests__/send-message.test.ts
git commit -m "feat(web): add sendMessage server action"
```

---

### Task 3: createThread Server Action

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_actions/create-thread.ts`
- Create: `apps/web/src/app/(chat)/chat/_actions/__tests__/create-thread.test.ts`

**Context:** Creates a new Thread record with `source: "web"`, a generated `sourceId`, `kind: "general"`, `status: "open"`. Returns the new thread ID so the client can navigate to it.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_actions/__tests__/create-thread.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    thread: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createThread } = await import('../create-thread');

describe('createThread', () => {
  it('creates a thread with source "web" and kind "general"', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'open',
      },
    });
  });

  it('returns the new thread id', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    const result = await createThread();

    expect(result).toEqual({ threadId: 'new-thread-1' });
  });

  it('revalidates the root path for sidebar refresh', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_actions/__tests__/create-thread.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/(chat)/chat/_actions/create-thread.ts`:

```typescript
'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';

type CreateThreadResult = { threadId: string };

type CreateThread = () => Promise<CreateThreadResult>;

export const createThread: CreateThread = async () => {
  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'general',
      status: 'open',
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_actions/__tests__/create-thread.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_actions/create-thread.ts apps/web/src/app/\(chat\)/chat/_actions/__tests__/create-thread.test.ts
git commit -m "feat(web): add createThread server action"
```

---

### Task 4: WebSocket Provider

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/ws-provider.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/ws-provider.test.tsx`

**Context:** A React context provider that connects to the orchestrator's WebSocket at `/ws`. Exposes a `useWs()` hook that lets child components subscribe to events by name. The WebSocket broadcasts JSON messages shaped `{ event: string, data: unknown, timestamp: number }`. Auto-reconnects on disconnect with exponential backoff.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_components/__tests__/ws-provider.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let mockOnMessage: ((event: MessageEvent) => void) | null = null;

const mockWsInstance = {
  close: vi.fn(),
  addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
    if (event === 'message') mockOnMessage = handler;
  }),
  removeEventListener: vi.fn(),
  readyState: 1,
};

vi.stubGlobal(
  'WebSocket',
  vi.fn(() => mockWsInstance),
);

const { WsProvider, useWs } = await import('../ws-provider');

const TestConsumer = ({ event }: { event: string }) => {
  const { lastEvent } = useWs(event);
  return <div data-testid='event-data'>{lastEvent ? JSON.stringify(lastEvent) : 'none'}</div>;
};

describe('WsProvider', () => {
  it('renders children', () => {
    render(
      <WsProvider>
        <div>child content</div>
      </WsProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('creates WebSocket connection on mount', () => {
    render(
      <WsProvider>
        <div>test</div>
      </WsProvider>,
    );
    expect(WebSocket).toHaveBeenCalled();
  });

  it('provides event data to consumers via useWs', async () => {
    render(
      <WsProvider>
        <TestConsumer event='pipeline:complete' />
      </WsProvider>,
    );

    expect(screen.getByTestId('event-data')).toHaveTextContent('none');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/ws-provider.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/(chat)/chat/_components/ws-provider.tsx`:

```typescript
'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type WsMessage = {
  event: string;
  data: unknown;
  timestamp: number;
};

type WsContextValue = {
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  isConnected: boolean;
};

const WsContext = createContext<WsContextValue | null>(null);

type WsProviderProps = {
  children: React.ReactNode;
};

type WsProviderComponent = (props: WsProviderProps) => React.ReactNode;

export const WsProvider: WsProviderComponent = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback((event: string, callback: (data: unknown) => void) => {
    const subs = subscribersRef.current;
    if (!subs.has(event)) {
      subs.set(event, new Set());
    }
    subs.get(event)!.add(callback);

    return () => {
      subs.get(event)?.delete(callback);
    };
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_WS_URL ?? 'ws://localhost:4001/ws';
    let attempt = 0;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setIsConnected(true);
        attempt = 0;
      });

      ws.addEventListener('close', () => {
        setIsConnected(false);
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          const callbacks = subscribersRef.current.get(msg.event);
          if (callbacks) {
            for (const cb of callbacks) {
              cb(msg.data);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      });
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  return <WsContext.Provider value={{ subscribe, isConnected }}>{children}</WsContext.Provider>;
};

type UseWsResult = {
  lastEvent: unknown;
  isConnected: boolean;
};

type UseWs = (eventName: string) => UseWsResult;

export const useWs: UseWs = (eventName) => {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWs must be used within a WsProvider');
  }

  const [lastEvent, setLastEvent] = useState<unknown>(null);

  useEffect(() => {
    return ctx.subscribe(eventName, setLastEvent);
  }, [ctx, eventName]);

  return { lastEvent, isConnected: ctx.isConnected };
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/ws-provider.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/ws-provider.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/ws-provider.test.tsx
git commit -m "feat(web): add WebSocket provider with auto-reconnect"
```

---

### Task 5: ChatInput Component

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/chat-input.test.tsx`

**Context:** A client component rendered at the bottom of the thread detail page. Contains a `<textarea>` and send `<Button>` (from `"ui"`). On submit, calls the `sendMessage` server action. Shows a "Thinking..." indicator while waiting for the orchestrator response (cleared when a `pipeline:complete` event matches the threadId). Enter submits, Shift+Enter inserts newline. Disabled during submission.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_components/__tests__/chat-input.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockSendMessage = vi.fn();
vi.mock('../../_actions/send-message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockUseWs = vi.fn().mockReturnValue({ lastEvent: null, isConnected: true });
vi.mock('../ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { ChatInput } = await import('../chat-input');

describe('ChatInput', () => {
  it('renders a textarea and send button', () => {
    render(<ChatInput threadId='thread-1' />);
    expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('calls sendMessage on form submit', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello world');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockSendMessage).toHaveBeenCalledWith('thread-1', 'Hello world');
  });

  it('clears textarea after successful send', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(textarea).toHaveValue('');
  });

  it('does not submit when textarea is empty', async () => {
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('shows error message from sendMessage', async () => {
    mockSendMessage.mockResolvedValue({ error: 'Could not reach orchestrator. Make sure it is running.' });
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    await user.type(screen.getByPlaceholderText('Send a message...'), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/Could not reach orchestrator/)).toBeInTheDocument();
  });

  it('submits on Enter key', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('thread-1', 'Hello');
  });

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup();

    render(<ChatInput threadId='thread-1' />);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/chat-input.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from 'ui';
import { SendHorizontal } from 'lucide-react';
import { sendMessage } from '../_actions/send-message';
import { useWs } from './ws-provider';

type ChatInputProps = {
  threadId: string;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({ threadId }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { lastEvent } = useWs('pipeline:complete');

  useEffect(() => {
    if (lastEvent && typeof lastEvent === 'object' && 'threadId' in lastEvent) {
      const event = lastEvent as { threadId: string };
      if (event.threadId === threadId) {
        setIsThinking(false);
        router.refresh();
      }
    }
  }, [lastEvent, threadId, router]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isPending) return;

    setError(null);
    setIsThinking(true);
    setValue('');

    startTransition(async () => {
      const result = await sendMessage(threadId, trimmed);
      if (result?.error) {
        setError(result.error);
        setIsThinking(false);
        setValue(trimmed);
      }
    });
  };

  type HandleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  const handleKeyDown: HandleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className='border-t border-border px-4 py-3'>
      {isThinking && (
        <div className='mb-2 text-xs text-muted-foreground animate-pulse'>Thinking...</div>
      )}
      {error && (
        <div className='mb-2 text-xs text-destructive'>{error}</div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className='flex items-end gap-2'
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Send a message...'
          rows={1}
          className='flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
          disabled={isPending}
        />
        <Button type='submit' size='sm' disabled={isPending || !value.trim()} aria-label='Send message'>
          <SendHorizontal className='h-4 w-4' />
        </Button>
      </form>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/chat-input.test.tsx`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/chat-input.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/chat-input.test.tsx
git commit -m "feat(web): add ChatInput component with send and keyboard handling"
```

---

### Task 6: NewThreadButton Component

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_components/new-thread-button.tsx`
- Create: `apps/web/src/app/(chat)/chat/_components/__tests__/new-thread-button.test.tsx`

**Context:** Client component that calls the `createThread` server action and navigates to the new thread. Replaces the static `MessageSquarePlus` icon in the thread sidebar header.

**Step 1: Write the failing test**

Create `apps/web/src/app/(chat)/chat/_components/__tests__/new-thread-button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateThread = vi.fn();
vi.mock('../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

const { NewThreadButton } = await import('../new-thread-button');

describe('NewThreadButton', () => {
  it('renders a button with new chat label', () => {
    render(<NewThreadButton />);
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('calls createThread and navigates on click', async () => {
    mockCreateThread.mockResolvedValue({ threadId: 'new-1' });
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(mockCreateThread).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/chat/new-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/new-thread-button.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `apps/web/src/app/(chat)/chat/_components/new-thread-button.tsx`:

```typescript
'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createThread } from '../_actions/create-thread';

type NewThreadButtonComponent = () => React.ReactNode;

export const NewThreadButton: NewThreadButtonComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { threadId } = await createThread();
      router.push(`/chat/${threadId}`);
    });
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={isPending}
      className='rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
      aria-label='New chat'
    >
      <MessageSquarePlus className='h-4 w-4' />
    </button>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/app/\\(chat\\)/chat/_components/__tests__/new-thread-button.test.tsx`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/chat/_components/new-thread-button.tsx apps/web/src/app/\(chat\)/chat/_components/__tests__/new-thread-button.test.tsx
git commit -m "feat(web): add NewThreadButton component"
```

---

### Task 7: Wire Everything Together

**Files:**
- Modify: `apps/web/src/app/(chat)/layout.tsx` — wrap children in WsProvider
- Modify: `apps/web/src/app/(chat)/chat/[thread-id]/page.tsx` — add ChatInput below MessageList
- Modify: `apps/web/src/app/(chat)/chat/_components/thread-sidebar.tsx` — replace static icon with NewThreadButton

**Context:** This task integrates all the components built in Tasks 1-6. No new files, just wiring.

**Step 1: Update chat layout to include WsProvider**

Modify `apps/web/src/app/(chat)/layout.tsx`. The current file is:

```typescript
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

Change it to:

```typescript
import type { Metadata } from 'next';
import { ThreadSidebar } from './chat/_components/thread-sidebar';
import { WsProvider } from './chat/_components/ws-provider';

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
    <WsProvider>
      <div className='flex h-full flex-1'>
        <ThreadSidebar />
        <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
      </div>
    </WsProvider>
  );
};

export default ChatLayout;
```

**Step 2: Add ChatInput to thread detail page**

Modify `apps/web/src/app/(chat)/chat/[thread-id]/page.tsx`. Currently the return JSX is:

```tsx
<div className='flex h-full flex-col'>
  <header className='flex items-center gap-3 border-b border-border px-6 py-3'>
    ...
  </header>
  <MessageList threadId={threadId} />
</div>
```

Change it to:

```tsx
<div className='flex h-full flex-col'>
  <header className='flex items-center gap-3 border-b border-border px-6 py-3'>
    ...
  </header>
  <MessageList threadId={threadId} />
  <ChatInput threadId={threadId} />
</div>
```

Add the import at the top: `import { ChatInput } from '../_components/chat-input';`

**Step 3: Replace static icon with NewThreadButton in sidebar**

Modify `apps/web/src/app/(chat)/chat/_components/thread-sidebar.tsx`.

Replace:
```tsx
import { MessageSquarePlus } from 'lucide-react';
```

With:
```tsx
import { NewThreadButton } from './new-thread-button';
```

Replace the static icon span:
```tsx
<span role='img' title='New chat' aria-label='New chat'>
  <MessageSquarePlus className='h-4 w-4 text-muted-foreground' />
</span>
```

With:
```tsx
<NewThreadButton />
```

**Step 4: Run all tests to verify nothing broke**

Run: `pnpm test`
Expected: All tests pass (existing + new)

**Step 5: Commit**

```bash
git add apps/web/src/app/\(chat\)/layout.tsx apps/web/src/app/\(chat\)/chat/\[thread-id\]/page.tsx apps/web/src/app/\(chat\)/chat/_components/thread-sidebar.tsx
git commit -m "feat(web): wire ChatInput, WsProvider, and NewThreadButton into chat pages"
```

---

### Task 8: Update Existing Tests for Modified Files

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_components/__tests__/thread-sidebar.test.tsx` (if it exists) or check existing tests are compatible
- Create any missing test updates

**Context:** Task 7 modified the thread sidebar (replaced `MessageSquarePlus` import with `NewThreadButton`). Existing tests may reference the old icon. Check and fix.

**Step 1: Check existing thread-sidebar tests**

Read `apps/web/src/app/(chat)/chat/_components/__tests__/thread-sidebar.test.tsx` (may not exist — the sidebar is a server component tested with `renderToStaticMarkup`).

If it exists and references `MessageSquarePlus` or `New chat` aria-label, update the test to account for the `NewThreadButton` being a client component (it won't render inside `renderToStaticMarkup`).

If it doesn't exist, verify all existing tests still pass with `pnpm test`.

**Step 2: Verify all tests pass**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Commit (only if changes were needed)**

```bash
git add -A
git commit -m "test(web): update tests for chat input integration"
```

---

### Task 9: Final Verification

**Step 1: Run full CI pipeline**

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

All four must pass.

**Step 2: Manual smoke test (optional)**

If orchestrator is running:
1. Start web: `pnpm --filter web dev`
2. Open browser to `http://localhost:4000`
3. Click "New Chat" in sidebar — new thread appears, navigates to it
4. Type a message, hit Enter — user message appears immediately
5. If orchestrator is running, assistant response appears after a few seconds

**Step 3: Commit any remaining fixes**

If any CI checks fail, fix and commit.
