import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    pluginConfig: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../../_actions/toggle-plugin', () => ({
  togglePlugin: vi.fn(),
}));

const { PluginsTable, PluginsTableInternal } = await import('../plugins-table');

describe('PluginsTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = PluginsTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('PluginsTableInternal', () => {
  it('renders empty state when no plugins exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No plugins configured.');
  });

  it('renders table with plugin data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_1',
        pluginName: 'discord',
        enabled: true,
        metadata: null,
        settings: { token: '***', guildId: '123' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-02-20T00:00:00Z'),
      },
      {
        id: 'pc_2',
        pluginName: 'web',
        enabled: false,
        metadata: null,
        settings: null,
        createdAt: new Date('2026-01-15T00:00:00Z'),
        updatedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('discord');
    expect(html).toContain('Enabled');
    expect(html).toContain('Configured');
    expect(html).toContain('web');
    expect(html).toContain('Disabled');
    expect(html).toContain('No settings');
  });

  it('renders enable button for disabled plugins', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_3',
        pluginName: 'context',
        enabled: false,
        metadata: null,
        settings: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Enable');
  });

  it('shows No settings for empty settings object', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_4',
        pluginName: 'empty-settings',
        enabled: true,
        metadata: null,
        settings: {},
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No settings');
  });
});
