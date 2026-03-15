import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectMemoryPanel } from '../project-memory-panel';

describe('ProjectMemoryPanel', () => {
  it('renders empty state when memory is null', () => {
    const html = renderToStaticMarkup(ProjectMemoryPanel({ memory: null }) as React.ReactElement);
    expect(html).toContain('No memory yet');
  });

  it('renders memory content when provided', () => {
    const html = renderToStaticMarkup(
      ProjectMemoryPanel({
        memory: 'User prefers dark mode',
      }) as React.ReactElement,
    );
    expect(html).toContain('User prefers dark mode');
    expect(html).not.toContain('No memory yet');
  });

  it('renders the Memory label', () => {
    const html = renderToStaticMarkup(ProjectMemoryPanel({ memory: null }) as React.ReactElement);
    expect(html).toContain('Memory');
  });
});
