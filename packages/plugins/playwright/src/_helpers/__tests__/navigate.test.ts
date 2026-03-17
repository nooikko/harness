import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { navigate } from '../navigate';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
}));

vi.mock('../validate-url', () => ({
  validateUrl: vi.fn(),
}));

import { getPage } from '../browser-manager';
import { validateUrl } from '../validate-url';

const mockCtx = {} as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1' };

const createMockPage = () => ({
  goto: vi.fn(),
  title: vi.fn(),
  url: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('navigate', () => {
  it('returns error when url is missing', async () => {
    const result = await navigate(mockCtx, {}, mockMeta);
    expect(result).toBe('Error: url is required.');
  });

  it('returns error when url validation fails', async () => {
    (validateUrl as Mock).mockReturnValue({ valid: false, reason: 'Blocked scheme: file:' });
    const result = await navigate(mockCtx, { url: 'file:///etc/passwd' }, mockMeta);
    expect(result).toBe('Error: Blocked scheme: file:');
  });

  it('navigates and returns page info on success', async () => {
    (validateUrl as Mock).mockReturnValue({ valid: true });
    const mockPage = createMockPage();
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.title.mockResolvedValue('Example Domain');
    mockPage.url.mockReturnValue('https://example.com/');
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await navigate(mockCtx, { url: 'https://example.com' }, mockMeta);

    expect(result).toContain('Navigated to: https://example.com/');
    expect(result).toContain('Title: Example Domain');
    expect(result).toContain('Status: 200');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
  });

  it('returns error on navigation failure', async () => {
    (validateUrl as Mock).mockReturnValue({ valid: true });
    const mockPage = createMockPage();
    mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await navigate(mockCtx, { url: 'https://doesnotexist.invalid' }, mockMeta);
    expect(result).toContain('Error navigating to');
    expect(result).toContain('net::ERR_NAME_NOT_RESOLVED');
  });

  it('handles null response status gracefully', async () => {
    (validateUrl as Mock).mockReturnValue({ valid: true });
    const mockPage = createMockPage();
    mockPage.goto.mockResolvedValue(null);
    mockPage.title.mockResolvedValue('Page');
    mockPage.url.mockReturnValue('https://example.com');
    (getPage as Mock).mockResolvedValue(mockPage);

    const result = await navigate(mockCtx, { url: 'https://example.com' }, mockMeta);
    expect(result).toContain('Status: unknown');
  });
});
