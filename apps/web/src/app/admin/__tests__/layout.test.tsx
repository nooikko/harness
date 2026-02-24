import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/cron-jobs',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: AdminLayout, metadata } = await import('../layout');

describe('AdminLayout', () => {
  it('exports metadata with correct title', () => {
    expect(metadata.title).toBe('Admin | Harness Dashboard');
  });

  it('exports metadata with correct description', () => {
    expect(metadata.description).toBe('Manage cron jobs, plugins, tasks, agent runs, and threads');
  });

  it('renders children within the layout', () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Test child content</p>
      </AdminLayout>,
    );
    expect(html).toContain('Test child content');
  });

  it('renders a main element wrapping children', () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Main content</p>
      </AdminLayout>,
    );
    expect(html).toContain('<main');
    expect(html).toContain('Main content');
  });

  it("renders the AdminSidebar with 'Admin' heading", () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Content</p>
      </AdminLayout>,
    );
    expect(html).toContain('Admin');
  });

  it('renders all admin section links', () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Content</p>
      </AdminLayout>,
    );
    expect(html).toContain('Cron Jobs');
    expect(html).toContain('Plugins');
    expect(html).toContain('Tasks');
    expect(html).toContain('Agent Runs');
    expect(html).toContain('Threads');
  });

  it('renders the sidebar aside element', () => {
    const html = renderToStaticMarkup(
      <AdminLayout>
        <p>Content</p>
      </AdminLayout>,
    );
    expect(html).toContain('<aside');
  });
});
