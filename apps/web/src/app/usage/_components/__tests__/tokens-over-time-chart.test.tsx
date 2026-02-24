import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    metric: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { TokensOverTimeChart, TokensOverTimeChartInternal } = await import('../tokens-over-time-chart');

describe('TokensOverTimeChart', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = TokensOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('TokensOverTimeChartInternal', () => {
  it('renders empty state when no metrics exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await TokensOverTimeChartInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No token data for this period.');
  });

  it('renders meter bars when metrics exist', async () => {
    mockFindMany.mockResolvedValue([
      { value: 500, createdAt: new Date('2025-01-10T10:00:00Z') },
      { value: 300, createdAt: new Date('2025-01-10T14:00:00Z') },
      { value: 700, createdAt: new Date('2025-01-11T10:00:00Z') },
    ]);
    const element = await TokensOverTimeChartInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Tokens Over Time');
    expect(html).toContain('<meter');
    expect(html).toContain('01-10');
    expect(html).toContain('01-11');
  });
});
