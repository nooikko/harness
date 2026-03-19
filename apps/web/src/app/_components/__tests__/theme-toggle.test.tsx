import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockSetTheme = vi.fn();
let mockTheme = 'system';

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: mockTheme }),
}));

vi.mock('@harness/ui', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button type='button' onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

const { ThemeToggle } = await import('../theme-toggle');

describe('ThemeToggle', () => {
  afterEach(() => {
    cleanup();
    mockSetTheme.mockClear();
    mockTheme = 'system';
  });

  it('renders toggle button with sr-only label', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Toggle theme')).toBeDefined();
  });

  it('renders all three theme options', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Light')).toBeDefined();
    expect(screen.getByText('Dark')).toBeDefined();
    expect(screen.getByText('System')).toBeDefined();
  });

  it("calls setTheme('light') when Light is clicked", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Light'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it("calls setTheme('dark') when Dark is clicked", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it("calls setTheme('system') when System is clicked", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('System'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('highlights the active theme option', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    const darkButton = screen.getByText('Dark').closest('button');
    expect(darkButton?.className).toContain('text-foreground');
  });

  it('does not highlight inactive theme options', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    const lightButton = screen.getByText('Light').closest('button');
    expect(lightButton?.className).not.toContain('text-foreground');
  });
});
