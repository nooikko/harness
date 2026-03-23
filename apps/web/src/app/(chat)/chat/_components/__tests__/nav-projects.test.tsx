import type { Project, Thread } from '@harness/database';
import { SidebarProvider } from '@harness/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('../new-project-thread-button', () => ({
  NewProjectThreadButton: ({ projectId }: { projectId: string }) => (
    <button type='button' data-project-id={projectId}>
      New chat
    </button>
  ),
}));

vi.mock('@harness/database', () => ({}));

import { usePathname } from 'next/navigation';
import { NavProjects } from '../nav-projects';

const makeThread = (overrides: Partial<Thread> = {}): Thread => ({
  id: 'thread-1',
  source: 'web',
  sourceId: 'src-1',
  name: 'Thread One',
  kind: 'general',
  status: 'active',
  sessionId: null,
  model: null,
  effort: null,
  customInstructions: null,
  parentThreadId: null,
  agentId: null,
  projectId: 'proj-1',
  storyId: null,
  lastActivity: new Date('2026-01-01T10:00:00Z'),
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

const makeProject = (overrides: Partial<Project & { threads: Thread[] }> = {}): Project & { threads: Thread[] } => ({
  id: 'proj-1',
  name: 'Project Alpha',
  description: null,
  instructions: null,
  memory: null,
  model: null,
  workingDirectory: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  threads: [],
  ...overrides,
});

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('NavProjects', () => {
  it('renders nothing when no projects', () => {
    const { container } = renderWithProvider(<NavProjects projects={[]} />);
    const menuItems = container.querySelectorAll('[data-slot="sidebar-menu-item"]');
    expect(menuItems).toHaveLength(0);
  });

  it('renders a project by name', () => {
    const project = makeProject({ name: 'My Project' });
    renderWithProvider(<NavProjects projects={[project]} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders threads within a project', () => {
    const thread = makeThread({ name: 'Alpha Thread' });
    const project = makeProject({ threads: [thread] });
    renderWithProvider(<NavProjects projects={[project]} />);
    expect(screen.getByText('Alpha Thread')).toBeInTheDocument();
  });

  it('falls back to kind when thread name is null', () => {
    const thread = makeThread({ name: null, kind: 'general' });
    const project = makeProject({ threads: [thread] });
    renderWithProvider(<NavProjects projects={[project]} />);
    expect(screen.getByText('general')).toBeInTheDocument();
  });

  it('renders the correct href for a thread link', () => {
    const thread = makeThread({ id: 'thread-99', name: 'Chat 99' });
    const project = makeProject({ threads: [thread] });
    renderWithProvider(<NavProjects projects={[project]} />);
    const link = screen.getByRole('link', { name: /Chat 99/i });
    expect(link).toHaveAttribute('href', '/chat/thread-99');
  });

  it('renders a settings link for each project', () => {
    const project = makeProject({ id: 'proj-abc', name: 'My Project' });
    renderWithProvider(<NavProjects projects={[project]} />);
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink).toHaveAttribute('href', '/chat/projects/proj-abc/settings');
  });

  it('marks an active thread link', () => {
    vi.mocked(usePathname).mockReturnValue('/chat/thread-1');
    const thread = makeThread({ id: 'thread-1', name: 'Active Chat' });
    const project = makeProject({ threads: [thread] });
    renderWithProvider(<NavProjects projects={[project]} />);
    const link = screen.getByRole('link', { name: /Active Chat/i });
    expect(link).toHaveAttribute('data-active', 'true');
  });

  it('renders multiple projects', () => {
    const p1 = makeProject({ id: 'p1', name: 'Alpha' });
    const p2 = makeProject({ id: 'p2', name: 'Beta' });
    renderWithProvider(<NavProjects projects={[p1, p2]} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});
