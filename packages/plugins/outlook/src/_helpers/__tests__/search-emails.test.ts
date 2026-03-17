import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

import { graphFetch } from '../graph-fetch';
import { searchEmails } from '../search-emails';

const mockCtx = {} as never;

describe('searchEmails', () => {
  it('returns formatted search results', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Meeting tomorrow',
          from: {
            emailAddress: { name: 'Alice', address: 'alice@example.com' },
          },
          receivedDateTime: '2026-03-16T10:00:00Z',
          bodyPreview: "Let's discuss the project...",
        },
      ],
    });

    const result = await searchEmails(mockCtx, 'meeting');
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Meeting tomorrow');
    expect(parsed[0].from).toContain('Alice');
  });

  it('returns message when no results', async () => {
    vi.mocked(graphFetch).mockResolvedValue({ value: [] });

    const result = await searchEmails(mockCtx, 'nonexistent');
    expect(result).toContain('No emails found');
  });

  it('truncates body preview to 200 chars', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Long email',
          from: {
            emailAddress: { name: 'Bob', address: 'bob@example.com' },
          },
          receivedDateTime: '2026-03-16T10:00:00Z',
          bodyPreview: 'x'.repeat(300),
        },
      ],
    });

    const result = await searchEmails(mockCtx, 'long');
    const parsed = JSON.parse(result);

    expect(parsed[0].bodyPreview).toHaveLength(200);
  });
});
