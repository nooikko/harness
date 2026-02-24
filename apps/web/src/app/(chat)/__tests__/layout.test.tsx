import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: ChatLayout, metadata } = await import('../layout');

describe('ChatLayout', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Chat | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('Multi-thread chat interface for the Harness orchestrator');
  });

  it('renders children within the layout structure', () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Test child</p>
      </ChatLayout>,
    );
    expect(html).toContain('Test child');
  });

  it('renders a main content area', () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Main content</p>
      </ChatLayout>,
    );
    expect(html).toContain('<main');
    expect(html).toContain('Main content');
  });

  it('renders sidebar skeleton as Suspense fallback', () => {
    const html = renderToStaticMarkup(
      <ChatLayout>
        <p>Content</p>
      </ChatLayout>,
    );
    expect(html).toContain('data-slot="skeleton"');
  });
});
