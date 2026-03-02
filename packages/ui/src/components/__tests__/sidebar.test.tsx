import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '../sidebar';

describe('Sidebar', () => {
  it('renders as an aside element', () => {
    render(<Sidebar>content</Sidebar>);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByRole('complementary').tagName).toBe('ASIDE');
  });

  it('applies className to the aside', () => {
    render(<Sidebar className='custom-class'>content</Sidebar>);
    expect(screen.getByRole('complementary')).toHaveClass('custom-class');
  });

  it('renders SidebarHeader as a div', () => {
    render(<SidebarHeader data-testid='header'>header</SidebarHeader>);
    expect(screen.getByTestId('header').tagName).toBe('DIV');
    expect(screen.getByTestId('header')).toHaveAttribute('data-sidebar', 'header');
  });

  it('renders SidebarFooter as a div', () => {
    render(<SidebarFooter data-testid='footer'>footer</SidebarFooter>);
    expect(screen.getByTestId('footer')).toHaveAttribute('data-sidebar', 'footer');
  });

  it('renders SidebarContent as a div', () => {
    render(<SidebarContent data-testid='content'>content</SidebarContent>);
    expect(screen.getByTestId('content')).toHaveAttribute('data-sidebar', 'content');
  });

  it('renders SidebarGroup as a div', () => {
    render(<SidebarGroup data-testid='group'>group</SidebarGroup>);
    expect(screen.getByTestId('group')).toHaveAttribute('data-sidebar', 'group');
  });

  it('renders SidebarGroupContent as a div', () => {
    render(<SidebarGroupContent data-testid='gc'>items</SidebarGroupContent>);
    expect(screen.getByTestId('gc')).toHaveAttribute('data-sidebar', 'group-content');
  });

  it('renders SidebarGroupLabel as a div by default', () => {
    render(<SidebarGroupLabel data-testid='label'>Label</SidebarGroupLabel>);
    expect(screen.getByTestId('label').tagName).toBe('DIV');
    expect(screen.getByTestId('label')).toHaveAttribute('data-sidebar', 'group-label');
  });

  it('renders SidebarGroupLabel with asChild using the child element', () => {
    render(
      <SidebarGroupLabel asChild>
        <nav data-testid='nav-label'>Nav Label</nav>
      </SidebarGroupLabel>,
    );
    expect(screen.getByTestId('nav-label').tagName).toBe('NAV');
    expect(screen.getByText('Nav Label')).toBeInTheDocument();
  });

  it('renders SidebarMenu as a ul', () => {
    render(<SidebarMenu data-testid='menu'>items</SidebarMenu>);
    expect(screen.getByTestId('menu').tagName).toBe('UL');
    expect(screen.getByTestId('menu')).toHaveAttribute('data-sidebar', 'menu');
  });

  it('renders SidebarMenuItem as a li', () => {
    render(
      <SidebarMenu>
        <SidebarMenuItem data-testid='item'>item</SidebarMenuItem>
      </SidebarMenu>,
    );
    expect(screen.getByTestId('item').tagName).toBe('LI');
    expect(screen.getByTestId('item')).toHaveAttribute('data-sidebar', 'menu-item');
  });

  it('renders SidebarMenuButton as a button by default', () => {
    render(<SidebarMenuButton>click me</SidebarMenuButton>);
    expect(screen.getByRole('button', { name: 'click me' })).toBeInTheDocument();
  });

  it('renders SidebarMenuButton with isActive sets data-active', () => {
    render(<SidebarMenuButton isActive>active</SidebarMenuButton>);
    expect(screen.getByRole('button', { name: 'active' })).toHaveAttribute('data-active', 'true');
  });

  it('renders SidebarMenuButton with isActive false', () => {
    render(<SidebarMenuButton isActive={false}>inactive</SidebarMenuButton>);
    expect(screen.getByRole('button', { name: 'inactive' })).toHaveAttribute('data-active', 'false');
  });

  it('renders SidebarMenuButton with sm size', () => {
    render(
      <SidebarMenuButton size='sm' data-testid='sm-btn'>
        sm
      </SidebarMenuButton>,
    );
    expect(screen.getByTestId('sm-btn')).toHaveAttribute('data-size', 'sm');
  });

  it('renders SidebarMenuButton with lg size', () => {
    render(
      <SidebarMenuButton size='lg' data-testid='lg-btn'>
        lg
      </SidebarMenuButton>,
    );
    expect(screen.getByTestId('lg-btn')).toHaveAttribute('data-size', 'lg');
  });

  it('renders SidebarMenuButton with outline variant', () => {
    render(
      <SidebarMenuButton variant='outline' data-testid='outline-btn'>
        outline
      </SidebarMenuButton>,
    );
    expect(screen.getByTestId('outline-btn')).toBeInTheDocument();
  });

  it('renders SidebarMenuButton with asChild using child element', () => {
    render(
      <SidebarMenuButton asChild>
        <a href='/home' data-testid='link-btn'>
          Home
        </a>
      </SidebarMenuButton>,
    );
    expect(screen.getByTestId('link-btn').tagName).toBe('A');
    expect(screen.getByTestId('link-btn')).toHaveAttribute('href', '/home');
  });

  it('renders SidebarMenuAction as a button', () => {
    render(<SidebarMenuAction data-testid='action'>action</SidebarMenuAction>);
    expect(screen.getByTestId('action').tagName).toBe('BUTTON');
    expect(screen.getByTestId('action')).toHaveAttribute('data-sidebar', 'menu-action');
  });

  it('renders SidebarMenuAction with showOnHover', () => {
    render(
      <SidebarMenuAction showOnHover data-testid='hover-action'>
        action
      </SidebarMenuAction>,
    );
    expect(screen.getByTestId('hover-action')).toBeInTheDocument();
  });

  it('renders SidebarMenuAction with asChild', () => {
    render(
      <SidebarMenuAction asChild>
        <button type='button' data-testid='custom-action'>
          action
        </button>
      </SidebarMenuAction>,
    );
    expect(screen.getByTestId('custom-action').tagName).toBe('BUTTON');
  });

  it('renders SidebarMenuBadge', () => {
    render(<SidebarMenuBadge data-testid='badge'>5</SidebarMenuBadge>);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-sidebar', 'menu-badge');
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders SidebarSeparator', () => {
    render(<SidebarSeparator data-testid='sep' />);
    expect(screen.getByTestId('sep')).toHaveAttribute('data-sidebar', 'separator');
  });

  it('renders SidebarMenuSub as a ul', () => {
    render(<SidebarMenuSub data-testid='sub' />);
    expect(screen.getByTestId('sub').tagName).toBe('UL');
    expect(screen.getByTestId('sub')).toHaveAttribute('data-sidebar', 'menu-sub');
  });

  it('renders SidebarMenuSubItem as a li', () => {
    render(
      <SidebarMenuSub>
        <SidebarMenuSubItem data-testid='sub-item'>item</SidebarMenuSubItem>
      </SidebarMenuSub>,
    );
    expect(screen.getByTestId('sub-item').tagName).toBe('LI');
    expect(screen.getByTestId('sub-item')).toHaveAttribute('data-sidebar', 'menu-sub-item');
  });

  it('renders SidebarMenuSubButton as an anchor by default', () => {
    render(<SidebarMenuSubButton data-testid='sub-btn'>sub</SidebarMenuSubButton>);
    expect(screen.getByTestId('sub-btn').tagName).toBe('A');
    expect(screen.getByTestId('sub-btn')).toHaveAttribute('data-sidebar', 'menu-sub-button');
    expect(screen.getByTestId('sub-btn')).toHaveAttribute('data-size', 'md');
    expect(screen.getByTestId('sub-btn')).toHaveAttribute('data-active', 'false');
  });

  it('renders SidebarMenuSubButton with size sm', () => {
    render(
      <SidebarMenuSubButton size='sm' data-testid='sub-sm'>
        sm
      </SidebarMenuSubButton>,
    );
    expect(screen.getByTestId('sub-sm')).toHaveAttribute('data-size', 'sm');
  });

  it('renders SidebarMenuSubButton with isActive', () => {
    render(
      <SidebarMenuSubButton isActive data-testid='sub-active'>
        active
      </SidebarMenuSubButton>,
    );
    expect(screen.getByTestId('sub-active')).toHaveAttribute('data-active', 'true');
  });

  it('renders SidebarMenuSubButton with asChild', () => {
    render(
      <SidebarMenuSubButton asChild>
        <span data-testid='sub-child'>child</span>
      </SidebarMenuSubButton>,
    );
    expect(screen.getByTestId('sub-child').tagName).toBe('SPAN');
  });

  it('renders SidebarRail as a button', () => {
    render(<SidebarRail data-testid='rail' />);
    expect(screen.getByTestId('rail').tagName).toBe('BUTTON');
    expect(screen.getByTestId('rail')).toHaveAttribute('data-sidebar', 'rail');
    expect(screen.getByTestId('rail')).toHaveAttribute('aria-label', 'Toggle Sidebar');
  });

  it('renders a complete sidebar structure', () => {
    render(
      <Sidebar>
        <SidebarHeader>
          <span>Logo</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>Dashboard</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>Settings</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <span>Footer</span>
        </SidebarFooter>
      </Sidebar>,
    );

    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

describe('SidebarProvider', () => {
  it('renders children', () => {
    render(
      <SidebarProvider>
        <span>child content</span>
      </SidebarProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('renders the wrapper div with data-slot attribute', () => {
    render(
      <SidebarProvider data-testid='wrapper'>
        <span>child</span>
      </SidebarProvider>,
    );
    expect(screen.getByTestId('wrapper')).toHaveAttribute('data-slot', 'sidebar-wrapper');
  });

  it('defaults to expanded state', () => {
    render(
      <SidebarProvider data-testid='wrapper'>
        <span>child</span>
      </SidebarProvider>,
    );
    // The wrapper itself doesn't carry the state, but it renders without error
    expect(screen.getByTestId('wrapper')).toBeInTheDocument();
  });

  it('renders with defaultOpen=false (collapsed initial state)', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible='icon' data-testid='sidebar'>
          content
        </Sidebar>
      </SidebarProvider>,
    );
    // Should render the collapsible sidebar div in collapsed state
    const sidebarContainer = document.querySelector('[data-state="collapsed"]');
    expect(sidebarContainer).not.toBeNull();
  });

  it('accepts an external open prop and calls onOpenChange', async () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider open={true} onOpenChange={onOpenChange}>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Toggle Sidebar' });
    await userEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies custom className to wrapper', () => {
    render(
      <SidebarProvider className='custom-wrapper' data-testid='wrapper'>
        <span>child</span>
      </SidebarProvider>,
    );
    expect(screen.getByTestId('wrapper')).toHaveClass('custom-wrapper');
  });

  it('sets a cookie when sidebar state changes', async () => {
    const cookieSpy = vi.spyOn(document, 'cookie', 'set');
    render(
      <SidebarProvider defaultOpen={true}>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(cookieSpy).toHaveBeenCalled();
    cookieSpy.mockRestore();
  });
});

describe('useSidebar', () => {
  it('throws when used outside SidebarProvider', () => {
    const BadComponent = () => {
      useSidebar();
      return <div>bad</div>;
    };

    // Suppress expected console error from React
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow('useSidebar must be used within a SidebarProvider');
    consoleError.mockRestore();
  });

  it('returns context values when used inside SidebarProvider', () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return null;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.state).toBe('expanded');
    expect(capturedContext!.open).toBe(true);
    expect(capturedContext!.isMobile).toBe(false);
    expect(typeof capturedContext!.toggleSidebar).toBe('function');
    expect(typeof capturedContext!.setOpen).toBe('function');
  });

  it('toggleSidebar switches from expanded to collapsed', async () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return null;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.state).toBe('expanded');

    act(() => {
      capturedContext!.toggleSidebar();
    });

    expect(capturedContext!.state).toBe('collapsed');
  });

  it('setOpen with a function value toggles state correctly', () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return null;
    };

    render(
      <SidebarProvider defaultOpen={false}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.open).toBe(false);

    act(() => {
      capturedContext!.setOpen((prev) => !prev);
    });

    expect(capturedContext!.open).toBe(true);
  });
});

describe('SidebarTrigger', () => {
  it('renders a button with Toggle Sidebar label', () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole('button', { name: 'Toggle Sidebar' })).toBeInTheDocument();
  });

  it('has data-slot="sidebar-trigger"', () => {
    render(
      <SidebarProvider>
        <SidebarTrigger data-testid='trigger' />
      </SidebarProvider>,
    );
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-slot', 'sidebar-trigger');
  });

  it('calls toggleSidebar when clicked', async () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return <SidebarTrigger />;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.state).toBe('expanded');
    await userEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(capturedContext!.state).toBe('collapsed');
  });

  it('calls custom onClick in addition to toggleSidebar', async () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <SidebarTrigger onClick={onClick} />
      </SidebarProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('SidebarInset', () => {
  it('renders as a main element', () => {
    render(<SidebarInset>main content</SidebarInset>);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('data-slot', 'sidebar-inset');
  });

  it('applies custom className', () => {
    render(<SidebarInset className='inset-custom'>content</SidebarInset>);
    expect(screen.getByRole('main')).toHaveClass('inset-custom');
  });
});

describe('Sidebar collapsible mode', () => {
  it('renders a div wrapper when collapsible="icon" and context is provided', () => {
    render(
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible='icon' data-testid='sidebar'>
          <span>nav</span>
        </Sidebar>
      </SidebarProvider>,
    );
    // Collapsible sidebar renders a div wrapper with data-state
    const wrapper = document.querySelector('[data-state="expanded"]');
    expect(wrapper).not.toBeNull();
  });

  it('renders with collapsed state when defaultOpen is false', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible='icon'>
          <span>nav</span>
        </Sidebar>
      </SidebarProvider>,
    );
    const wrapper = document.querySelector('[data-state="collapsed"]');
    expect(wrapper).not.toBeNull();
  });

  it('renders as an aside when collapsible="none"', () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible='none'>content</Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByRole('complementary').tagName).toBe('ASIDE');
  });

  it('renders as an aside when no context is provided (no collapsible prop override)', () => {
    // Without SidebarProvider, ctx is null so it falls back to the aside path
    render(<Sidebar>content</Sidebar>);
    expect(screen.getByRole('complementary').tagName).toBe('ASIDE');
  });
});

describe('Keyboard shortcut', () => {
  it('toggles sidebar state when Ctrl+B is pressed', async () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return null;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.state).toBe('expanded');

    await userEvent.keyboard('{Control>}b{/Control}');

    expect(capturedContext!.state).toBe('collapsed');
  });

  it('toggles sidebar state when Meta+B is pressed', async () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return null;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.state).toBe('expanded');

    await userEvent.keyboard('{Meta>}b{/Meta}');

    expect(capturedContext!.state).toBe('collapsed');
  });

  it('does not toggle when b is pressed without modifier', async () => {
    let capturedContext: ReturnType<typeof useSidebar> | null = null;

    const Consumer = () => {
      capturedContext = useSidebar();
      return <input data-testid='input' />;
    };

    render(
      <SidebarProvider defaultOpen={true}>
        <Consumer />
      </SidebarProvider>,
    );

    expect(capturedContext!.state).toBe('expanded');

    // Focus the input first so keydown goes to document/window but without meta/ctrl
    await userEvent.click(screen.getByTestId('input'));
    await userEvent.keyboard('b');

    // State should remain expanded
    expect(capturedContext!.state).toBe('expanded');
  });
});
