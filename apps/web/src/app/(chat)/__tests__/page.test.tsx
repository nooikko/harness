import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error('REDIRECT');
  },
}));

const { default: ChatIndexPage } = await import('../page');

describe('ChatIndexPage', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockRedirect.mockReset();
  });

  it('redirects to primary thread when one exists', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'primary-thread-1' });

    await expect(ChatIndexPage()).rejects.toThrow('REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/chat/primary-thread-1');
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kind: 'primary', status: { not: 'archived' } },
      }),
    );
  });

  it('redirects to newest thread when no primary exists', async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // no primary
      .mockResolvedValueOnce({ id: 'newest-thread-1' });

    await expect(ChatIndexPage()).rejects.toThrow('REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/chat/newest-thread-1');
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  it('renders empty state when no threads exist', async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // no primary
      .mockResolvedValueOnce(null); // no threads at all

    const element = await ChatIndexPage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Select a thread');
    expect(html).toContain('Choose a thread from the sidebar');
  });

  it('queries newest thread ordered by lastActivity desc', async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // no primary
      .mockResolvedValueOnce({ id: 'thread-recent' });

    await expect(ChatIndexPage()).rejects.toThrow('REDIRECT');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'archived' } },
        orderBy: { lastActivity: 'desc' },
      }),
    );
  });
});
