import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: AgentRunsPage, metadata } = await import('../page');

describe('AgentRunsPage', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Agent Runs | Admin | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('View model invocations, token usage, and costs per run.');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<AgentRunsPage />);
    expect(html).toContain('Agent Runs');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<AgentRunsPage />);
    expect(html).toContain('View model invocations, token usage, and costs per run.');
  });

  it('renders Suspense fallback skeleton', () => {
    const html = renderToStaticMarkup(<AgentRunsPage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
