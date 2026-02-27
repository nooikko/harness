import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
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
