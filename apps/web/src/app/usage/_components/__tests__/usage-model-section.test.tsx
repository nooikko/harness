import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    agentRun: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { UsageModelSection, UsageModelSkeleton } = await import('../usage-model-section');

describe('UsageModelSection', () => {
  it('renders the usage by model table', async () => {
    const element = await UsageModelSection();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Usage by Model');
  });
});

describe('UsageModelSkeleton', () => {
  it('renders a skeleton placeholder', () => {
    const html = renderToStaticMarkup((<UsageModelSkeleton />) as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});
