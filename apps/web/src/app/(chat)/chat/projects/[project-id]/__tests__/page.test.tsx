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
        memory: 'Some memory content',
        model: null,
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

vi.mock('../_components/project-header', () => ({
  ProjectHeader: ({ name }: { name: string }) => <div data-testid='project-header'>{name}</div>,
}));

vi.mock('../_components/project-chat-input', () => ({
  ProjectChatInput: () => <div data-testid='project-chat-input' />,
}));

vi.mock('../_components/project-threads-list', () => ({
  ProjectThreadsList: () => <div data-testid='project-threads-list' />,
}));

vi.mock('../_components/project-memory-panel', () => ({
  ProjectMemoryPanel: ({ memory }: { memory: string | null }) => <div data-testid='project-memory-panel'>{memory}</div>,
}));

vi.mock('../_components/project-instructions-panel', () => ({
  ProjectInstructionsPanel: ({ instructions }: { instructions: string | null }) => <div data-testid='project-instructions-panel'>{instructions}</div>,
}));

vi.mock('../_components/project-files-panel', () => ({
  ProjectFilesPanel: () => <div data-testid='project-files-panel' />,
}));

import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import ProjectHubPage from '../page';

describe('ProjectHubPage', () => {
  it('renders the project header with project name', async () => {
    const element = await ProjectHubPage({ params: Promise.resolve({ 'project-id': 'proj-1' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Alpha Project');
    expect(html).toContain('project-header');
  });

  it('renders the chat input and threads list sections', async () => {
    const element = await ProjectHubPage({ params: Promise.resolve({ 'project-id': 'proj-1' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('project-chat-input');
    expect(html).toContain('Recent threads');
  });

  it('renders the memory and instructions panels', async () => {
    const element = await ProjectHubPage({ params: Promise.resolve({ 'project-id': 'proj-1' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('project-memory-panel');
    expect(html).toContain('project-instructions-panel');
  });

  it('calls notFound when project does not exist', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(ProjectHubPage({ params: Promise.resolve({ 'project-id': 'nonexistent' }) })).rejects.toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
