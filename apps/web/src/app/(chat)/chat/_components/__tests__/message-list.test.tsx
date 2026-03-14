import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMessageFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
  },
}));

const { MessageList, MessageListInternal } = await import('../message-list');

describe('MessageList', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = MessageList({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('MessageListInternal', () => {
  beforeEach(() => {
    mockMessageFindMany.mockReset();
  });
  it('renders empty state when there are no messages', async () => {
    mockMessageFindMany.mockResolvedValue([]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No messages in this thread yet.');
  });

  it('renders messages when data is available', async () => {
    mockMessageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        kind: 'text',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        kind: 'text',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
    ]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Hello');
    expect(html).toContain('Hi there');
  });

  it('renders ScrollAnchor after messages', async () => {
    mockMessageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        kind: 'text',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
    ]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-scroll-anchor');
  });

  it('renders user messages with correct aria label', async () => {
    mockMessageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello world',
        kind: 'text',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
    ]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Hello world');
  });
});
