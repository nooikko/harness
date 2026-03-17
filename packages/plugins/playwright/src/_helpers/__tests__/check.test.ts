import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { check } from '../check';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('check', () => {
  it('returns error when selector is missing', async () => {
    const result = await check(mockCtx, {}, mockMeta);
    expect(result).toBe('Error: selector is required.');
  });

  it('checks a checkbox by default', async () => {
    const mockPage = { check: vi.fn().mockResolvedValue(undefined) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await check(mockCtx, { selector: '#marketing' }, mockMeta);
    expect(result).toBe('Checked: #marketing');
    expect(mockPage.check).toHaveBeenCalledWith('#marketing', { timeout: 10_000 });
  });

  it('unchecks when checked=false', async () => {
    const mockPage = { uncheck: vi.fn().mockResolvedValue(undefined) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await check(mockCtx, { selector: '#marketing', checked: false }, mockMeta);
    expect(result).toBe('Unchecked: #marketing');
    expect(mockPage.uncheck).toHaveBeenCalledWith('#marketing', { timeout: 10_000 });
  });

  it('returns error on failure', async () => {
    const mockPage = { check: vi.fn().mockRejectedValue(new Error('Not a checkbox')) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await check(mockCtx, { selector: '#div' }, mockMeta);
    expect(result).toContain('Error toggling checkbox');
  });
});
