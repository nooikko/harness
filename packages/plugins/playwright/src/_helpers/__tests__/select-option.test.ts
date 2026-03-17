import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { selectOption } from '../select-option';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('selectOption', () => {
  it('returns error when selector is missing', async () => {
    const result = await selectOption(mockCtx, { value: 'opt1' }, mockMeta);
    expect(result).toBe('Error: selector is required.');
  });

  it('returns error when value is missing', async () => {
    const result = await selectOption(mockCtx, { selector: '#country' }, mockMeta);
    expect(result).toBe('Error: value is required.');
  });

  it('selects option and returns confirmation', async () => {
    const mockPage = { selectOption: vi.fn().mockResolvedValue(['us']) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await selectOption(mockCtx, { selector: '#country', value: 'us' }, mockMeta);
    expect(result).toContain('Selected option "us"');
    expect(mockPage.selectOption).toHaveBeenCalledWith('#country', 'us', { timeout: 10_000 });
  });

  it('returns error on failure', async () => {
    const mockPage = { selectOption: vi.fn().mockRejectedValue(new Error('Not a select element')) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await selectOption(mockCtx, { selector: '#input', value: 'x' }, mockMeta);
    expect(result).toContain('Error selecting option');
  });
});
