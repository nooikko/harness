import { render, screen } from '@testing-library/react';
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
    render(
      <ChatLayout>
        <p>Test child</p>
      </ChatLayout>,
    );
    expect(screen.getByText('Test child')).toBeInTheDocument();
  });

  it('renders a main content area', () => {
    render(
      <ChatLayout>
        <p>Main content</p>
      </ChatLayout>,
    );
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Main content');
  });

  it('renders sidebar skeleton as Suspense fallback', () => {
    const { container } = render(
      <ChatLayout>
        <p>Content</p>
      </ChatLayout>,
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
