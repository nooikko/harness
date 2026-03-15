import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectHeader } from '../project-header';

describe('ProjectHeader', () => {
  it('renders the project name', () => {
    const html = renderToStaticMarkup(
      ProjectHeader({
        projectId: 'proj-1',
        name: 'My Project',
      }) as React.ReactElement,
    );
    expect(html).toContain('My Project');
  });

  it('renders a link back to all projects', () => {
    const html = renderToStaticMarkup(
      ProjectHeader({
        projectId: 'proj-1',
        name: 'My Project',
      }) as React.ReactElement,
    );
    expect(html).toContain('href="/chat/projects"');
    expect(html).toContain('All projects');
  });

  it('renders a settings link with the correct project id', () => {
    const html = renderToStaticMarkup(
      ProjectHeader({
        projectId: 'proj-42',
        name: 'Test',
      }) as React.ReactElement,
    );
    expect(html).toContain('href="/chat/projects/proj-42/settings"');
  });
});
