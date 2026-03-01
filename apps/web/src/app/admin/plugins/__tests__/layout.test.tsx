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

// Mock PluginsNav — it's a client component tested separately
vi.mock('../_components/plugins-nav', () => ({
  PluginsNav: ({ configs }: { configs: unknown[] }) => <nav data-testid='plugins-nav' data-count={configs.length} />,
}));

const { default: PluginsLayout } = await import('../layout');

describe('PluginsLayout', () => {
  it('renders children in main element', async () => {
    mockFindMany.mockResolvedValue([]);
    const html = renderToStaticMarkup(await PluginsLayout({ children: <div id='child'>Hello</div> }));
    expect(html).toContain('Hello');
  });

  it('renders aside with plugins label', async () => {
    mockFindMany.mockResolvedValue([]);
    const html = renderToStaticMarkup(await PluginsLayout({ children: <span /> }));
    expect(html).toContain('Plugins');
  });

  it('renders PluginsNav with loaded configs', async () => {
    const configs = [{ id: '1', pluginName: 'context', enabled: true, settings: {}, createdAt: new Date(), updatedAt: new Date() }];
    mockFindMany.mockResolvedValue(configs);
    const html = renderToStaticMarkup(await PluginsLayout({ children: <span /> }));
    expect(html).toContain('data-testid="plugins-nav"');
    expect(html).toContain('data-count="1"');
  });

  it('queries pluginConfig ordered by pluginName ascending', async () => {
    mockFindMany.mockResolvedValue([]);
    await PluginsLayout({ children: <span /> });
    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { pluginName: 'asc' } });
  });
});
