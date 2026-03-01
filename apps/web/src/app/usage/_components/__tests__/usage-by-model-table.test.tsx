import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockGroupBy = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agentRun: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
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
  it('renders empty state when no models exist', async () => {
    mockGroupBy.mockResolvedValue([]);
    const element = await UsageByModelTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No usage data available yet.');
  });

  it('renders table with model data', async () => {
    mockGroupBy.mockResolvedValue([
      {
        model: 'claude-opus-4-6',
        _sum: { inputTokens: 10000, outputTokens: 5000, costEstimate: 1.5 },
        _count: 12,
      },
      {
        model: 'claude-sonnet-4-6',
        _sum: { inputTokens: null, outputTokens: null, costEstimate: null },
        _count: 8,
      },
    ]);
    const element = await UsageByModelTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('claude-opus-4-6');
    expect(html).toContain('claude-sonnet-4-6');
    expect(html).toContain('Usage by Model');
  });
});
