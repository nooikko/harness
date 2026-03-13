import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    pluginConfig: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../../_actions/toggle-plugin', () => ({
  togglePlugin: vi.fn(),
}));

vi.mock('../plugin-toggle', () => ({
  PluginToggle: ({ id, enabled }: { id: string; enabled: boolean }) => (
    <span data-testid='plugin-toggle' data-id={id} data-enabled={enabled}>
      {enabled ? 'on' : 'off'}
    </span>
  ),
}));

vi.mock('../../../_components/status-dot', () => ({
  StatusDot: ({ status }: { status: string }) => <span data-testid='status-dot'>{status}</span>,
}));

vi.mock('../../../_components/row-menu', () => ({
  RowMenu: ({ actions }: { actions: Array<{ label: string }> }) => (
    <div data-testid='row-menu'>
      {actions.map((a) => (
        <span key={a.label}>{a.label}</span>
      ))}
    </div>
  ),
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
    expect(html).toContain('No plugins configured');
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
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('discord');
    expect(html).toContain('web');
    expect(html).toContain('enabled');
    expect(html).toContain('disabled');
  });

  it('renders inline toggle for enabled state', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_toggle',
        pluginName: 'identity',
        enabled: true,
        metadata: null,
        settings: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="plugin-toggle"');
    expect(html).toContain('data-enabled="true"');
  });

  it('renders disabled toggle for disabled plugins', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_off',
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
    expect(html).toContain('data-enabled="false"');
    expect(html).toContain('off');
  });

  it('renders settings link for plugins with configurable settings', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_settings',
        pluginName: 'validator',
        enabled: true,
        metadata: null,
        settings: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/admin/plugins/validator');
    expect(html).toContain('Settings');
  });

  it('uses StatusDot for status display', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'pc_status',
        pluginName: 'metrics',
        enabled: true,
        metadata: null,
        settings: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await PluginsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="status-dot"');
  });
});
