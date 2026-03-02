import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    project: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha Project',
        description: 'A test project',
        instructions: 'Be helpful',
        memory: null,
        model: null,
        settings: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('../_components/project-settings-form', () => ({
  ProjectSettingsForm: ({ project }: { project: { name: string } }) => <div data-testid='project-settings-form'>{project.name}</div>,
}));

import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import ProjectSettingsPage from '../page';

describe('ProjectSettingsPage', () => {
  it('renders the page heading', async () => {
    const element = await ProjectSettingsPage({ params: Promise.resolve({ 'project-id': 'proj-1' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Project Settings');
  });

  it('renders the ProjectSettingsForm with project data', async () => {
    const element = await ProjectSettingsPage({ params: Promise.resolve({ 'project-id': 'proj-1' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Alpha Project');
  });

  it('calls notFound when project does not exist', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(ProjectSettingsPage({ params: Promise.resolve({ 'project-id': 'nonexistent' }) })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
