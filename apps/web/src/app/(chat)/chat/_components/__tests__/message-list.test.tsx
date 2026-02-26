import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMessageFindMany = vi.fn();
const mockAgentRunFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
    agentRun: {
      findMany: (...args: unknown[]) => mockAgentRunFindMany(...args),
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
    mockAgentRunFindMany.mockReset();
  });
  it('renders empty state when there are no messages', async () => {
    mockMessageFindMany.mockResolvedValue([]);
    mockAgentRunFindMany.mockResolvedValue([]);
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
        threadId: 'thread-1',
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        threadId: 'thread-1',
        createdAt: new Date(),
      },
    ]);
    mockAgentRunFindMany.mockResolvedValue([]);
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
        threadId: 'thread-1',
        createdAt: new Date(),
      },
    ]);
    mockAgentRunFindMany.mockResolvedValue([]);
    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-scroll-anchor');
  });

  it('fetches agent runs for the thread when messages exist', async () => {
    mockMessageFindMany.mockResolvedValue([{ id: 'msg-1', role: 'user', content: 'Hi', threadId: 'thread-42', createdAt: new Date() }]);
    mockAgentRunFindMany.mockResolvedValue([]);
    await MessageListInternal({ threadId: 'thread-42' });
    expect(mockAgentRunFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: 'thread-42' },
        orderBy: { startedAt: 'asc' },
      }),
    );
  });

  it('does not fetch agent runs when there are no messages', async () => {
    mockMessageFindMany.mockResolvedValue([]);
    await MessageListInternal({ threadId: 'thread-1' });
    expect(mockAgentRunFindMany).not.toHaveBeenCalled();
  });

  it('passes matched agentRun data to assistant MessageItem', async () => {
    const msgTime = new Date('2026-02-23T10:00:10Z');
    const runTime = new Date('2026-02-23T10:00:05Z');

    mockMessageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Response',
        model: null,
        threadId: 'thread-1',
        createdAt: msgTime,
      },
    ]);
    mockAgentRunFindMany.mockResolvedValue([
      {
        id: 'run-1',
        threadId: 'thread-1',
        model: 'claude-sonnet-4-6',
        inputTokens: 500,
        outputTokens: 200,
        durationMs: 1500,
        startedAt: runTime,
      },
    ]);

    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    // The ActivityChips component renders model/token/duration data
    // We verify the run data flows through by checking for ActivityChips output
    expect(html).toContain('Sonnet');
  });

  it('does not pass agentRun to user messages', async () => {
    const msgTime = new Date('2026-02-23T10:00:10Z');
    const runTime = new Date('2026-02-23T10:00:05Z');

    mockMessageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        model: null,
        threadId: 'thread-1',
        createdAt: msgTime,
      },
    ]);
    mockAgentRunFindMany.mockResolvedValue([
      {
        id: 'run-1',
        threadId: 'thread-1',
        model: 'claude-sonnet-4-6',
        inputTokens: 500,
        outputTokens: 200,
        durationMs: 1500,
        startedAt: runTime,
      },
    ]);

    const element = await MessageListInternal({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    // User messages should NOT have any ActivityChips content
    expect(html).not.toContain('Sonnet');
    expect(html).not.toContain('tokens');
  });
});
