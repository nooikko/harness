import { render, screen } from '@testing-library/react';
import type { PluginConfig } from 'database';
import { describe, expect, it, vi } from 'vitest';

// Mock next/navigation for usePathname
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/admin/plugins'),
}));

// Mock next/link as simple anchor
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { PluginsNav } = await import('../plugins-nav');

const mockConfigs: PluginConfig[] = [
  {
    id: '1',
    pluginName: 'context',
    enabled: true,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    pluginName: 'discord',
    enabled: false,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('PluginsNav', () => {
  it('renders All Plugins link', () => {
    render(<PluginsNav configs={[]} />);
    expect(screen.getByText('All Plugins')).toBeDefined();
  });

  it('renders a link for each plugin config', () => {
    render(<PluginsNav configs={mockConfigs} />);
    expect(screen.getByText('context')).toBeDefined();
    expect(screen.getByText('discord')).toBeDefined();
  });

  it('links to correct plugin URL', () => {
    render(<PluginsNav configs={mockConfigs} />);
    const contextLink = screen.getByText('context').closest('a');
    expect(contextLink?.getAttribute('href')).toBe('/admin/plugins/context');
  });

  it('renders enabled indicator for enabled plugin', () => {
    const { container } = render(<PluginsNav configs={mockConfigs} />);
    // Enabled plugin has bg-green-500 indicator dot
    const greenDots = container.querySelectorAll('.bg-green-500');
    expect(greenDots.length).toBe(1);
  });

  it('renders muted indicator for disabled plugin', () => {
    const { container } = render(<PluginsNav configs={mockConfigs} />);
    // Disabled plugin has bg-muted-foreground indicator dot
    const mutedDots = container.querySelectorAll('.bg-muted-foreground');
    expect(mutedDots.length).toBe(1);
  });

  it('applies active class to All Plugins link when on /admin/plugins', () => {
    render(<PluginsNav configs={[]} />);
    const link = screen.getByText('All Plugins').closest('a');
    expect(link?.className).toContain('bg-muted');
    expect(link?.className).toContain('font-medium');
  });

  it('renders nav element wrapping the links', () => {
    const { container } = render(<PluginsNav configs={mockConfigs} />);
    expect(container.querySelector('nav')).toBeDefined();
  });

  it('renders empty nav when no configs provided', () => {
    render(<PluginsNav configs={[]} />);
    // Only "All Plugins" link should be present
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(1);
  });
});
