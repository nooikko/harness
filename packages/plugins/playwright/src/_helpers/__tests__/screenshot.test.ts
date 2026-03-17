import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { screenshot } from '../screenshot';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

vi.mock('../temp-tracker', () => ({
  ensureTraceDir: vi.fn().mockReturnValue('/tmp/harness-playwright/trace-1'),
  trackFile: vi.fn(),
}));

import { getPage } from '../browser-manager';
import { ensureTraceDir, trackFile } from '../temp-tracker';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1', traceId: 'trace-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('screenshot', () => {
  it('takes a screenshot and returns the file path', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Screenshot saved:');
    expect(result).toContain('https://example.com');
    expect(result).toContain('auto-deleted');
    expect(ensureTraceDir).toHaveBeenCalledWith('trace-1');
    expect(trackFile).toHaveBeenCalledWith('trace-1', expect.stringContaining('screenshot-'));
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

  it('uses "unknown" traceId when meta.traceId is missing', async () => {
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
      url: vi.fn().mockReturnValue('https://example.com'),
    };
    (getPage as Mock).mockResolvedValue(mockPage);

    await screenshot(mockCtx, {}, { threadId: 'thread-1' });
    expect(ensureTraceDir).toHaveBeenCalledWith('unknown');
  });

  it('returns error on failure', async () => {
    const mockPage = { screenshot: vi.fn().mockRejectedValue(new Error('page closed')) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await screenshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Error taking screenshot');
    expect(result).toContain('page closed');
  });
});
