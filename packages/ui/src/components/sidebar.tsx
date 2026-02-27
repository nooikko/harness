'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../index';

/**
 * Simplified shadcn/ui Sidebar primitives — structural layout only.
 * No collapsible/mobile behaviour (Sheet dependency omitted).
 * Follows the same API surface as the full shadcn sidebar so upgrading
 * to the collapsible version later is a drop-in change.
 */

const Sidebar = ({ className, children, ...props }: React.ComponentProps<'aside'>) => (
  <aside data-slot='sidebar' className={cn('bg-sidebar text-sidebar-foreground flex h-full flex-col', className)} {...props}>
    {children}
  </aside>
);

const SidebarHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-header' data-sidebar='header' className={cn('flex flex-col gap-2 p-2', className)} {...props} />
);

const SidebarFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-footer' data-sidebar='footer' className={cn('flex flex-col gap-2 p-2', className)} {...props} />
);

const SidebarContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-content' data-sidebar='content' className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto', className)} {...props} />
);

const SidebarGroup = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-group' data-sidebar='group' className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
);

type SidebarGroupLabelProps = React.ComponentProps<'div'> & { asChild?: boolean };

const SidebarGroupLabel = ({ className, asChild = false, ...props }: SidebarGroupLabelProps) => {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      data-slot='sidebar-group-label'
      data-sidebar='group-label'
      className={cn(
        'text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-[margin,opacity] duration-200 ease-linear',
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroupContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-group-content' data-sidebar='group-content' className={cn('w-full text-sm', className)} {...props} />
);

const SidebarMenu = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul data-slot='sidebar-menu' data-sidebar='menu' className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
);

const SidebarMenuItem = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li data-slot='sidebar-menu-item' data-sidebar='menu-item' className={cn('group/menu-item relative', className)} {...props} />
);

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline: 'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type SidebarMenuButtonProps = React.ComponentProps<'button'> & {
  asChild?: boolean;
  isActive?: boolean;
} & VariantProps<typeof sidebarMenuButtonVariants>;

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  className,
  ...props
}: SidebarMenuButtonProps) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot='sidebar-menu-button'
      data-sidebar='menu-button'
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
};

const SidebarMenuAction = ({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean; showOnHover?: boolean }) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot='sidebar-menu-action'
      data-sidebar='menu-action'
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-none transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  );
};

const SidebarMenuBadge = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='sidebar-menu-badge'
    data-sidebar='menu-badge'
    className={cn(
      'text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none',
      'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
      'peer-data-[size=sm]/menu-button:top-1',
      'peer-data-[size=default]/menu-button:top-1.5',
      'peer-data-[size=lg]/menu-button:top-2.5',
      className,
    )}
    {...props}
  />
);

const SidebarSeparator = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-separator' data-sidebar='separator' className={cn('bg-sidebar-border mx-2 h-px w-auto', className)} {...props} />
);

export {
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
  sidebarMenuButtonVariants,
};
