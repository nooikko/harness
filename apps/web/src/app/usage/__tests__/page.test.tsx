import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    metric: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { value: 0 } }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentRun: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { default: UsagePage } = await import('../page');

describe('UsagePage', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  });

  it('uses custom budget when NEXT_PUBLIC_TOKEN_BUDGET_USD is set', async () => {
    process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD = '250';
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('$250.00');
  });

  it('renders the page heading', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Token Usage');
  });

  it('renders the description text', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Monitor token consumption');
  });

  it('renders the budget warning component', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Monthly Budget');
  });

  it('renders the summary cards section', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Total Tokens');
    expect(html).toContain('Total Cost');
  });

  it('renders the usage over time chart', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Usage Over Time');
  });

  it('renders the usage by model table', async () => {
    const element = await UsagePage();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Usage by Model');
  });
});
