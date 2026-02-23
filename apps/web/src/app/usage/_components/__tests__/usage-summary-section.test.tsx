import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    metric: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { value: 0 } }),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

const { UsageSummarySection, UsageSummarySkeleton } = await import('../usage-summary-section');

describe('UsageSummarySection', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  });

  it('renders budget warning and summary cards', async () => {
    const element = await UsageSummarySection();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Monthly Budget');
    expect(html).toContain('Total Tokens');
    expect(html).toContain('Total Cost');
  });

  it('uses custom budget from env var', async () => {
    process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD = '250';
    const element = await UsageSummarySection();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('$250.00');
  });
});

describe('UsageSummarySkeleton', () => {
  it('renders skeleton placeholders', () => {
    const html = renderToStaticMarkup((<UsageSummarySkeleton />) as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});
