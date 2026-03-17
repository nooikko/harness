import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('readEmail', () => {
  it('returns full email details', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { readEmail } = await import('../read-email');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'msg-1',
      subject: 'Test Email',
      from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
      toRecipients: [{ emailAddress: { name: 'Bob', address: 'bob@example.com' } }],
      ccRecipients: [],
      receivedDateTime: '2026-03-17T10:00:00Z',
      body: { contentType: 'Text', content: 'Hello Bob!' },
      hasAttachments: false,
    });

    const result = await readEmail({} as Parameters<typeof readEmail>[0], 'msg-1');
    const parsed = JSON.parse(result);

    expect(parsed.subject).toBe('Test Email');
    expect(parsed.from).toContain('Alice');
    expect(parsed.to).toHaveLength(1);
    expect(parsed.body).toBe('Hello Bob!');
  });
});
