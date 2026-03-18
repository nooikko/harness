import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../_components/project-card', () => ({
  ProjectCard: () => <div data-testid='project-card' />,
}));

const { default: ProjectsPage } = await import('../page');

describe('ProjectsPage', () => {
  it('renders Projects heading', async () => {
    const element = await ProjectsPage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('<h1');
    expect(html).toContain('Projects');
  });

  it('renders New Project link', async () => {
    const element = await ProjectsPage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/chat/projects/new');
    expect(html).toContain('New Project');
  });

  it('renders empty state when no projects exist', async () => {
    const element = await ProjectsPage();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No projects yet');
  });
});
