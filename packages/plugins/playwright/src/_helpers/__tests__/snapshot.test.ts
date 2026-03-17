import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { snapshot } from '../snapshot';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('snapshot', () => {
  it('returns aria snapshot of the page', async () => {
    const mockLocator = {
      ariaSnapshot: vi.fn().mockResolvedValue('- heading "Test Page" [level=1]\n- button "Submit"'),
    };
    const mockPage = { locator: vi.fn().mockReturnValue(mockLocator) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await snapshot(mockCtx, {}, mockMeta);
    expect(result).toContain('heading "Test Page"');
    expect(result).toContain('button "Submit"');
    expect(mockPage.locator).toHaveBeenCalledWith(':root');
  });

  it('returns empty message when tree is empty', async () => {
    const mockLocator = { ariaSnapshot: vi.fn().mockResolvedValue('') };
    const mockPage = { locator: vi.fn().mockReturnValue(mockLocator) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await snapshot(mockCtx, {}, mockMeta);
    expect(result).toContain('empty accessibility tree');
  });

  it('returns error on failure', async () => {
    const mockLocator = { ariaSnapshot: vi.fn().mockRejectedValue(new Error('page crashed')) };
    const mockPage = { locator: vi.fn().mockReturnValue(mockLocator) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await snapshot(mockCtx, {}, mockMeta);
    expect(result).toContain('Error taking snapshot');
    expect(result).toContain('page crashed');
  });
});
