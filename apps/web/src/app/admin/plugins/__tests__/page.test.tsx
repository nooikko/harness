import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: PluginsPage, metadata } = await import('../page');

describe('PluginsPage', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Plugins | Admin | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('Configure and manage orchestrator plugins.');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<PluginsPage />);
    expect(html).toContain('Plugins');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<PluginsPage />);
    expect(html).toContain('Configure and manage orchestrator plugins.');
  });

  it('renders Suspense fallback skeleton', () => {
    const html = renderToStaticMarkup(<PluginsPage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
