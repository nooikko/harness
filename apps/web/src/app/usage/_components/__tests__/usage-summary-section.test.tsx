import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAggregate = vi.fn();
const mockCount = vi.fn();

vi.mock('database', () => ({
  prisma: {
    metric: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

const { UsageSummarySection, UsageSummarySectionInternal } = await import('../usage-summary-section');

describe('UsageSummarySection', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = UsageSummarySection();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('UsageSummarySectionInternal', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  });

  it('renders summary cards with aggregated data', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { value: 10000 } })
      .mockResolvedValueOnce({ _sum: { value: 5000 } })
      .mockResolvedValueOnce({ _sum: { value: 1.5 } });
    mockCount.mockResolvedValue(25);

    const element = await UsageSummarySectionInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Total Tokens');
    expect(html).toContain('Total Cost');
  });

  it('handles null aggregate values with fallback to zero', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { value: null } })
      .mockResolvedValueOnce({ _sum: { value: null } })
      .mockResolvedValueOnce({ _sum: { value: null } });
    mockCount.mockResolvedValue(0);

    const element = await UsageSummarySectionInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Total Tokens');
  });

  it('passes budget to BudgetWarning when env var is set', async () => {
    process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD = '100';
    mockAggregate.mockResolvedValue({ _sum: { value: 50 } });
    mockCount.mockResolvedValue(10);

    const element = await UsageSummarySectionInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Total Tokens');
  });
});
