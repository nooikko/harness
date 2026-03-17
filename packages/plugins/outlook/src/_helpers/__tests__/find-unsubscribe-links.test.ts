import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

import { findUnsubscribeLinks } from '../find-unsubscribe-links';
import { graphFetch } from '../graph-fetch';

const mockCtx = {} as never;

describe('findUnsubscribeLinks', () => {
  it('extracts unsubscribe links from email HTML', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Newsletter',
          from: {
            emailAddress: {
              name: 'Newsletter',
              address: 'news@example.com',
            },
          },
          body: {
            content: '<a href="https://example.com/unsubscribe?id=123">Unsubscribe</a>',
          },
        },
      ],
    });

    const result = await findUnsubscribeLinks(mockCtx);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].unsubscribeLinks).toContain('https://example.com/unsubscribe?id=123');
  });

  it('returns no results message when no emails found', async () => {
    vi.mocked(graphFetch).mockResolvedValue({ value: [] });

    const result = await findUnsubscribeLinks(mockCtx);
    expect(result).toContain('No emails with unsubscribe links found');
  });

  it('deduplicates links within a single email', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Newsletter',
          from: {
            emailAddress: { name: 'News', address: 'news@example.com' },
          },
          body: {
            content: '<a href="https://example.com/unsubscribe">Unsubscribe</a> <a href="https://example.com/unsubscribe">Unsubscribe</a>',
          },
        },
      ],
    });

    const result = await findUnsubscribeLinks(mockCtx);
    const parsed = JSON.parse(result);

    expect(parsed[0].unsubscribeLinks).toHaveLength(1);
  });

  it('returns message when emails found but no links extracted', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Newsletter',
          from: {
            emailAddress: { name: 'News', address: 'news@example.com' },
          },
          body: {
            content: 'Please unsubscribe by emailing us.',
          },
        },
      ],
    });

    const result = await findUnsubscribeLinks(mockCtx);
    expect(result).toContain('could not extract');
  });
});
