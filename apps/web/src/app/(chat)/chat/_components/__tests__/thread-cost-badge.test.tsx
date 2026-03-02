import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetThreadCost = vi.fn();

vi.mock('../../_actions/get-thread-cost', () => ({
  getThreadCost: (...args: unknown[]) => mockGetThreadCost(...args),
}));

const { ThreadCostBadge, ThreadCostBadgeSkeleton } = await import('../thread-cost-badge');

describe('ThreadCostBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the formatted cost when totalCost is greater than zero', async () => {
    mockGetThreadCost.mockResolvedValue({
      mainCost: 0.05,
      subAgentCost: 0.03,
      totalCost: 0.08,
    });

    const element = await ThreadCostBadge({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('$0.08');
  });

  it('renders nothing (null) when totalCost is zero', async () => {
    mockGetThreadCost.mockResolvedValue({
      mainCost: 0,
      subAgentCost: 0,
      totalCost: 0,
    });

    const result = await ThreadCostBadge({ threadId: 'thread-1' });

    expect(result).toBeNull();
  });

  it('uses 4 decimal places for small costs', async () => {
    mockGetThreadCost.mockResolvedValue({
      mainCost: 0.0042,
      subAgentCost: 0,
      totalCost: 0.0042,
    });

    const element = await ThreadCostBadge({ threadId: 'thread-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('$0.0042');
  });
});

describe('ThreadCostBadgeSkeleton', () => {
  it('renders an animated pulse span', () => {
    const element = ThreadCostBadgeSkeleton();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('animate-pulse');
  });
});
