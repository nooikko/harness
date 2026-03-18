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
    const structured = result as { text: string; blocks: Array<{ type: string; data: Record<string, unknown> }> };
    const parsed = JSON.parse(structured.text);

    expect(parsed.subject).toBe('Test Email');
    expect(parsed.from).toContain('Alice');
    expect(parsed.to).toHaveLength(1);
    expect(parsed.body).toBe('Hello Bob!');

    expect(structured.blocks).toHaveLength(1);
    expect(structured.blocks[0]?.type).toBe('email-list');
    const emails = (structured.blocks[0]?.data as { emails: Array<{ from: { name: string; email: string }; hasAttachments: boolean }> }).emails;
    expect(emails[0]?.from).toEqual({ name: 'Alice', email: 'alice@example.com' });
    expect(emails[0]?.hasAttachments).toBe(false);
  });
});
