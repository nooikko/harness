import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { screenshot } from '../screenshot';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockUploadFile = vi.fn().mockResolvedValue({ fileId: 'file-123', relativePath: 'threads/thread-1/file-123-screenshot.png' });
const mockCtx = { uploadFile: mockUploadFile } as unknown as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1', traceId: 'trace-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('screenshot', () => {
  it('takes a screenshot and persists as file attachment', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Screenshot saved:');
    expect(result).toContain('file ID: file-123');
    expect(result).toContain('https://example.com');
    expect(result).toContain('persisted as a file attachment');
    expect(mockUploadFile).toHaveBeenCalledWith({
      filename: expect.stringContaining('screenshot-'),
      buffer: expect.any(Buffer),
      mimeType: 'image/png',
      scope: 'THREAD',
      threadId: 'thread-1',
    });
    expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: false, timeout: 15_000 }));
  });

  it('supports full_page option', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    await screenshot(mockCtx, { full_page: true }, mockMeta);
    expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
  });

  it('returns error on screenshot failure', async () => {
    const mockPage = { screenshot: vi.fn().mockRejectedValue(new Error('page closed')) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Error taking screenshot');
    expect(result).toContain('page closed');
  });

  it('defaults to viewport screenshot when full_page is explicitly false', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    await screenshot(mockCtx, { full_page: false }, mockMeta);
    expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: false }));
  });

  it('handles non-Error throw', async () => {
    (getPage as Mock).mockRejectedValue('string error');

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Error taking screenshot');
    expect(result).toContain('string error');
  });

  it('returns error on upload failure', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);
    mockUploadFile.mockRejectedValueOnce(new Error('disk full'));

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Error taking screenshot');
    expect(result).toContain('disk full');
  });
});
