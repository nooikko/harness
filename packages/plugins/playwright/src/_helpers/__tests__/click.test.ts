import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { click } from '../click';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('click', () => {
  it('returns error when selector is missing', async () => {
    const result = await click(mockCtx, {}, mockMeta);
    expect(result).toBe('Error: selector is required.');
  });

  it('clicks the element and returns confirmation', async () => {
    const mockPage = { click: vi.fn().mockResolvedValue(undefined), waitForTimeout: vi.fn().mockResolvedValue(undefined) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await click(mockCtx, { selector: '#submit-btn' }, mockMeta);
    expect(result).toBe('Clicked: #submit-btn');
    expect(mockPage.click).toHaveBeenCalledWith('#submit-btn', { timeout: 10_000 });
  });

  it('returns error on click failure', async () => {
    const mockPage = { click: vi.fn().mockRejectedValue(new Error('Element not found')), waitForTimeout: vi.fn() };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await click(mockCtx, { selector: '#missing' }, mockMeta);
    expect(result).toContain('Error clicking');
    expect(result).toContain('Element not found');
  });
});
