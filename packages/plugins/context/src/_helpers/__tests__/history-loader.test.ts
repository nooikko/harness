import { describe, expect, it, vi } from 'vitest';
import { loadHistory } from '../history-loader';

type MockDb = {
  message: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (messages: Array<{ role: string; content: string; createdAt: Date }> = []): MockDb => ({
  message: {
    findMany: vi.fn().mockResolvedValue(messages),
  },
});

describe('loadHistory', () => {
  it('loads messages from the database', async () => {
    const now = new Date('2026-02-23T12:00:00Z');
    const earlier = new Date('2026-02-23T11:00:00Z');
    const mockMessages = [
      { role: 'user', content: 'Hello', createdAt: now },
      { role: 'assistant', content: 'Hi there', createdAt: earlier },
    ];
    const db = createMockDb(mockMessages);

    const result = await loadHistory(db as never, 'thread-1');

    expect(db.message.findMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });
    expect(result.threadId).toBe('thread-1');
    // Messages are reversed to be in chronological order
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.content).toBe('Hi there');
    expect(result.messages[1]?.content).toBe('Hello');
  });

  it('uses default limit of 50 when no limit provided', async () => {
    const db = createMockDb();

    await loadHistory(db as never, 'thread-1');

    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('respects custom limit', async () => {
    const db = createMockDb();

    await loadHistory(db as never, 'thread-1', 10);

    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('returns empty messages when thread has no history', async () => {
    const db = createMockDb([]);

    const result = await loadHistory(db as never, 'thread-empty');

    expect(result.messages).toHaveLength(0);
    expect(result.threadId).toBe('thread-empty');
  });

  it('reverses messages to chronological order', async () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Third',
        createdAt: new Date('2026-02-23T12:03:00Z'),
      },
      {
        role: 'user',
        content: 'Second',
        createdAt: new Date('2026-02-23T12:02:00Z'),
      },
      {
        role: 'user',
        content: 'First',
        createdAt: new Date('2026-02-23T12:01:00Z'),
      },
    ];
    const db = createMockDb(messages);

    const result = await loadHistory(db as never, 'thread-1');

    expect(result.messages[0]?.content).toBe('First');
    expect(result.messages[1]?.content).toBe('Second');
    expect(result.messages[2]?.content).toBe('Third');
  });
});
