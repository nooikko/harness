import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
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
  it('renders empty state when there are no messages', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No messages in this thread yet.');
  });

  it('renders messages when data is available', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'Hello', threadId: 'thread-1', createdAt: new Date() },
      { id: 'msg-2', role: 'assistant', content: 'Hi there', threadId: 'thread-1', createdAt: new Date() },
    ]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Hello');
    expect(html).toContain('Hi there');
  });

  it('renders ScrollAnchor after messages', async () => {
    mockFindMany.mockResolvedValue([{ id: 'msg-1', role: 'user', content: 'Hello', threadId: 'thread-1', createdAt: new Date() }]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-scroll-anchor');
  });
});
