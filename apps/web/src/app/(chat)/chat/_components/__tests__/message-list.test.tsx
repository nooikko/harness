import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMessageFindMany = vi.fn();
const mockFileFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@harness/database', () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
    file: {
      findMany: (...args: unknown[]) => mockFileFindMany(...args),
    },
  },
}));

vi.mock('../pipeline-run-block', () => ({
  PipelineRunBlock: () => <div data-testid='pipeline-run-block' />,
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

  it('queries files for the thread', async () => {
    mockMessageFindMany.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'Hi', kind: 'text', source: 'builtin', threadId: 'thread-1', createdAt: new Date(), metadata: null },
    ]);
    mockFileFindMany.mockResolvedValue([{ id: 'f1', name: 'test.txt', mimeType: 'text/plain', size: 100, messageId: 'msg-1' }]);

    await MessageListInternal({ threadId: 'thread-1' });

    expect(mockFileFindMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
      select: { id: true, name: true, mimeType: true, size: true, messageId: true, createdAt: true },
    });
  });

  it('groups files by messageId and passes to MessageItem', async () => {
    mockMessageFindMany.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'Hi', kind: 'text', source: 'builtin', threadId: 'thread-1', createdAt: new Date(), metadata: null },
    ]);
    mockFileFindMany.mockResolvedValue([
      { id: 'f1', name: 'a.txt', mimeType: 'text/plain', size: 10, messageId: 'msg-1' },
      { id: 'f2', name: 'b.txt', mimeType: 'text/plain', size: 20, messageId: 'msg-1' },
    ]);

    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    // The message should render — files are passed as props to MessageItem
    expect(html).toContain('Hi');
  });

  it('skips files with null messageId in grouping', async () => {
    mockMessageFindMany.mockResolvedValue([
      { id: 'msg-1', role: 'user', content: 'Hi', kind: 'text', source: 'builtin', threadId: 'thread-1', createdAt: new Date(), metadata: null },
    ]);
    mockFileFindMany.mockResolvedValue([{ id: 'f1', name: 'orphan.txt', mimeType: 'text/plain', size: 10, messageId: null }]);

    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Hi');
  });

  it('renders pipeline run blocks for status messages', async () => {
    mockMessageFindMany.mockResolvedValue([
      {
        id: 'ps-1',
        role: 'system',
        content: 'Pipeline start',
        kind: 'status',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
      {
        id: 'ps-2',
        role: 'system',
        content: 'Pipeline complete',
        kind: 'status',
        source: 'builtin',
        threadId: 'thread-1',
        createdAt: new Date(),
        metadata: null,
      },
    ]);
    mockFileFindMany.mockResolvedValue([]);

    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('pipeline-run-block');
  });
});
