import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const { default: ThreadPage } = await import('../page');

describe('ThreadPage', () => {
  it('renders a container for thread content', async () => {
    const element = await ThreadPage({ params: Promise.resolve({ 'thread-id': 'thread-abc' }) });
    const { container } = render(element as React.ReactElement);

    // Page renders the outer shell; data loading happens in Suspense children
    const wrapper = container.querySelector('.flex.h-full.flex-col');
    expect(wrapper).toBeInTheDocument();
  });
});
