import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: UsagePage } = await import('../page');

describe('UsagePage', () => {
  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<UsagePage />);
    expect(html).toContain('Token Usage');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<UsagePage />);
    expect(html).toContain('Monitor token consumption, costs, and usage patterns across agent runs.');
  });

  it('renders Suspense fallback skeletons before data loads', () => {
    const html = renderToStaticMarkup(<UsagePage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
