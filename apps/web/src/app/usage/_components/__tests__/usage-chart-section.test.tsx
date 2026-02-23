import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    metric: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { UsageChartSection, UsageChartSkeleton } = await import('../usage-chart-section');

describe('UsageChartSection', () => {
  it('renders the usage over time chart', async () => {
    const element = await UsageChartSection();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Usage Over Time');
  });
});

describe('UsageChartSkeleton', () => {
  it('renders a skeleton placeholder', () => {
    const html = renderToStaticMarkup((<UsageChartSkeleton />) as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});
