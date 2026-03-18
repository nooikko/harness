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
    expect(typeof result).toBe('object');
    const structured = result as { text: string; blocks: Array<{ type: string; data: Record<string, unknown> }> };
    const parsed = JSON.parse(structured.text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Meeting tomorrow');
    expect(parsed[0].from).toContain('Alice');

    expect(structured.blocks).toHaveLength(1);
    expect(structured.blocks[0]?.type).toBe('email-list');
    const emails = (structured.blocks[0]?.data as { emails: Array<{ subject: string; from: { name: string; email: string } }> }).emails;
    expect(emails[0]?.from).toEqual({ name: 'Alice', email: 'alice@example.com' });
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
    const structured = result as { text: string };
    const parsed = JSON.parse(structured.text);

    expect(parsed[0].bodyPreview).toHaveLength(200);
  });
});
