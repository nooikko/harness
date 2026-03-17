import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { pressKey } from '../press-key';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

import { getPage } from '../browser-manager';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pressKey', () => {
  it('returns error when key is missing', async () => {
    const result = await pressKey(mockCtx, {}, mockMeta);
    expect(result).toContain('Error: key is required');
  });

  it('presses the key and returns confirmation', async () => {
    const mockPage = { keyboard: { press: vi.fn().mockResolvedValue(undefined) } };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await pressKey(mockCtx, { key: 'Enter' }, mockMeta);
    expect(result).toBe('Pressed key: Enter');
    expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('returns error on failure', async () => {
    const mockPage = { keyboard: { press: vi.fn().mockRejectedValue(new Error('Unknown key')) } };
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await pressKey(mockCtx, { key: 'BadKey' }, mockMeta);
    expect(result).toContain('Error pressing key');
    expect(result).toContain('Unknown key');
  });
});
