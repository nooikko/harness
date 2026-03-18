import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn().mockResolvedValue(null),
}));

import { graphFetch } from '../graph-fetch';
import { sendEmail } from '../send-email';

const mockCtx = {} as never;

describe('sendEmail', () => {
  it('sends email via Graph API', async () => {
    const result = await sendEmail(mockCtx, {
      to: ['bob@example.com'],
      subject: 'Hello',
      body: 'World',
    });

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/sendMail',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          message: expect.objectContaining({
            subject: 'Hello',
          }),
        }),
      }),
    );
    expect(result).toContain('Email sent');
  });

  it('sends HTML email when isHtml is true', async () => {
    const result = await sendEmail(mockCtx, {
      to: ['bob@example.com'],
      subject: 'HTML',
      body: '<p>Hello</p>',
      isHtml: true,
    });

    expect(result).toContain('Email sent');
    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/sendMail',
      expect.objectContaining({
        body: expect.objectContaining({
          message: expect.objectContaining({
            body: { contentType: 'HTML', content: '<p>Hello</p>' },
          }),
        }),
      }),
    );
  });

  it('includes cc and bcc recipients', async () => {
    const result = await sendEmail(mockCtx, {
      to: ['a@example.com'],
      cc: ['b@example.com'],
      bcc: ['c@example.com'],
      subject: 'Test',
      body: 'Body',
    });

    expect(result).toContain('a@example.com');
    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/sendMail',
      expect.objectContaining({
        body: expect.objectContaining({
          message: expect.objectContaining({
            ccRecipients: [{ emailAddress: { address: 'b@example.com' } }],
            bccRecipients: [{ emailAddress: { address: 'c@example.com' } }],
          }),
        }),
      }),
    );
  });

  it('sends to multiple recipients', async () => {
    const result = await sendEmail(mockCtx, {
      to: ['a@test.com', 'b@test.com'],
      subject: 'Multi',
      body: 'Hello all',
    });

    expect(result).toContain('a@test.com');
    expect(result).toContain('b@test.com');
  });
});
