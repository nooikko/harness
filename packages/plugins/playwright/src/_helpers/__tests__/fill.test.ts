import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fill } from '../fill';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fill', () => {
  it('returns error when selector is missing', async () => {
    const result = await fill(mockCtx, { value: 'test' }, mockMeta);
    expect(result).toBe('Error: selector is required.');
  });

  it('returns error when value is missing', async () => {
    const result = await fill(mockCtx, { selector: '#name' }, mockMeta);
    expect(result).toBe('Error: value is required.');
  });

  it('fills the field and returns confirmation', async () => {
    const mockPage = { fill: vi.fn().mockResolvedValue(undefined) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await fill(mockCtx, { selector: '#email', value: 'test@example.com' }, mockMeta);
    expect(result).toContain('Filled "#email"');
    expect(mockPage.fill).toHaveBeenCalledWith('#email', 'test@example.com', { timeout: 10_000 });
  });

  it('returns error on fill failure', async () => {
    const mockPage = { fill: vi.fn().mockRejectedValue(new Error('Element is not an input')) };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await fill(mockCtx, { selector: '#div', value: 'text' }, mockMeta);
    expect(result).toContain('Error filling');
  });
});
