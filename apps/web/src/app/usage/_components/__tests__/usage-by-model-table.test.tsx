import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    metric: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { UsageByModelTable, UsageByModelTableInternal } = await import('../usage-by-model-table');

describe('UsageByModelTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = UsageByModelTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('UsageByModelTableInternal', () => {
  it('renders empty state when no metrics exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await UsageByModelTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No usage data available yet.');
  });

  it('renders table with model data aggregated from Metric records', async () => {
    mockFindMany.mockImplementation(({ where }: { where: { name: string } }) => {
      if (where.name === 'token.input') {
        return Promise.resolve([
          { value: 10000, tags: { model: 'claude-opus-4-6' } },
          { value: 3000, tags: { model: 'claude-haiku-4-5' } },
        ]);
      }
      if (where.name === 'token.output') {
        return Promise.resolve([
          { value: 5000, tags: { model: 'claude-opus-4-6' } },
          { value: 1000, tags: { model: 'claude-haiku-4-5' } },
        ]);
      }
      if (where.name === 'token.cost') {
        return Promise.resolve([
          { value: 1.5, tags: { model: 'claude-opus-4-6' } },
          { value: 1.5, tags: { model: 'claude-opus-4-6' } },
          { value: 0.02, tags: { model: 'claude-haiku-4-5' } },
        ]);
      }
      return Promise.resolve([]);
    });

    const element = await UsageByModelTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('claude-opus-4-6');
    expect(html).toContain('claude-haiku-4-5');
    expect(html).toContain('Usage by Model');
  });

  it('handles metrics with null tags gracefully', async () => {
    mockFindMany.mockImplementation(({ where }: { where: { name: string } }) => {
      if (where.name === 'token.input') {
        return Promise.resolve([{ value: 500, tags: null }]);
      }
      if (where.name === 'token.output') {
        return Promise.resolve([{ value: 200, tags: null }]);
      }
      if (where.name === 'token.cost') {
        return Promise.resolve([{ value: 0.01, tags: null }]);
      }
      return Promise.resolve([]);
    });

    const element = await UsageByModelTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('unknown');
    expect(html).toContain('Usage by Model');
  });
});
