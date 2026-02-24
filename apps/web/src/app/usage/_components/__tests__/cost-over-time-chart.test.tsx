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

const { CostOverTimeChart, CostOverTimeChartInternal } = await import('../cost-over-time-chart');

describe('CostOverTimeChart', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = CostOverTimeChart();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('CostOverTimeChartInternal', () => {
  it('renders empty state when no metrics exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await CostOverTimeChartInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No cost data for this period.');
  });

  it('renders meter bars when metrics exist', async () => {
    mockFindMany.mockResolvedValue([
      { value: 0.05, createdAt: new Date('2025-01-10T10:00:00Z') },
      { value: 0.03, createdAt: new Date('2025-01-10T14:00:00Z') },
      { value: 0.12, createdAt: new Date('2025-01-11T10:00:00Z') },
    ]);
    const element = await CostOverTimeChartInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Cost Over Time');
    expect(html).toContain('<meter');
    expect(html).toContain('01-10');
    expect(html).toContain('01-11');
  });
});
