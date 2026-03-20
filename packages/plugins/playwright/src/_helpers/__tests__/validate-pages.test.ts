import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { validatePages } from '../validate-pages';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

vi.mock('../validate-url', () => ({
  validateUrl: vi.fn().mockReturnValue({ valid: true }),
}));

import { getPage } from '../browser-manager';
import { validateUrl } from '../validate-url';

const mockUploadFile = vi.fn().mockResolvedValue({ fileId: 'file-1', relativePath: 'test' });
const mockCtx = { uploadFile: mockUploadFile } as unknown as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1', traceId: 'trace-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validatePages', () => {
  it('screenshots each URL and returns file IDs', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    (getPage as Mock).mockResolvedValue(mockPage);
    mockUploadFile.mockResolvedValueOnce({ fileId: 'file-a', relativePath: 'a' }).mockResolvedValueOnce({ fileId: 'file-b', relativePath: 'b' });

    const result = await validatePages(mockCtx, { urls: ['https://example.com', 'https://example.com/about'] }, mockMeta);

    expect(result).toContain('2/2 pages captured');
    expect(result).toContain('file ID: file-a');
    expect(result).toContain('file ID: file-b');
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
    expect(mockUploadFile).toHaveBeenCalledTimes(2);
  });

  it('returns error for empty urls', async () => {
    const result = await validatePages(mockCtx, { urls: [] }, mockMeta);
    expect(result).toContain('urls array is required');
  });

  it('returns error for missing urls', async () => {
    const result = await validatePages(mockCtx, {}, mockMeta);
    expect(result).toContain('urls array is required');
  });

  it('rejects more than 20 URLs', async () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`);
    const result = await validatePages(mockCtx, { urls }, mockMeta);
    expect(result).toContain('Maximum 20 URLs');
  });

  it('continues on individual page failure', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await validatePages(mockCtx, { urls: ['https://a.com', 'https://b.com', 'https://c.com'] }, mockMeta);

    expect(result).toContain('2/3 pages captured');
    expect(result).toContain('timeout');
  });

  it('handles browser initialization failure', async () => {
    (getPage as Mock).mockRejectedValue(new Error('browser not launched'));

    const result = await validatePages(mockCtx, { urls: ['https://example.com'] }, mockMeta);
    expect(result).toContain('Error initializing browser');
  });

  it('blocks unsafe URLs via validateUrl', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    (getPage as Mock).mockResolvedValue(mockPage);
    (validateUrl as Mock)
      .mockReturnValueOnce({ valid: true })
      .mockReturnValueOnce({ valid: false, reason: 'Private IP address' })
      .mockReturnValueOnce({ valid: true });

    const result = await validatePages(mockCtx, { urls: ['https://public.com', 'http://192.168.1.1', 'https://other.com'] }, mockMeta);

    expect(result).toContain('2/3 pages captured');
    expect(result).toContain('Blocked: Private IP address');
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
  });
});
