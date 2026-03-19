'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { PanelLeft } from 'lucide-react';
import * as React from 'react';

import { cn } from '../cn';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type SidebarContextType = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextType | null>(null);

const useSidebar = () => {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

// ---------------------------------------------------------------------------
// SidebarProvider
// ---------------------------------------------------------------------------

type SidebarProviderProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SidebarProvider = React.forwardRef<HTMLDivElement, SidebarProviderProps>(
  ({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
    const isMobile = false;
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;

    const setOpen = React.useCallback(
      (value: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof value === 'function' ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(next);
        } else {
          _setOpen(next);
        }
        // biome-ignore lint/suspicious/noDocumentCookie: sidebar state persistence
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [open, setOpenProp],
    );

    const toggleSidebar = React.useCallback(() => setOpen((v) => !v), [setOpen]);

    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    const state: 'expanded' | 'collapsed' = open ? 'expanded' : 'collapsed';

    const contextValue = React.useMemo<SidebarContextType>(
      () => ({ state, open, setOpen, isMobile, toggleSidebar }),
      [state, open, setOpen, isMobile, toggleSidebar],
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <div
          data-slot='sidebar-wrapper'
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn('group/sidebar-wrapper flex h-full w-full', className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = 'SidebarProvider';

// ---------------------------------------------------------------------------
// SidebarInset
// ---------------------------------------------------------------------------

const SidebarInset = React.forwardRef<HTMLElement, React.ComponentProps<'main'>>(({ className, ...props }, ref) => (
  <main
    data-slot='sidebar-inset'
    ref={ref}
    className={cn('bg-background relative flex w-full min-w-0 flex-1 flex-col overflow-hidden', className)}
    {...props}
  />
));
SidebarInset.displayName = 'SidebarInset';

// ---------------------------------------------------------------------------
// SidebarTrigger
// ---------------------------------------------------------------------------

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-slot='sidebar-trigger'
      data-sidebar='trigger'
      ref={ref}
      type='button'
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className='sr-only'>Toggle Sidebar</span>
    </button>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

type SidebarProps = React.ComponentProps<'aside'> & {
  collapsible?: 'icon' | 'none';
};

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(({ collapsible = 'none', className, children, ...props }, ref) => {
  const ctx = React.useContext(SidebarContext);
  const state = ctx?.state ?? 'expanded';

  if (collapsible === 'none' || !ctx) {
    return (
      <aside data-slot='sidebar' className={cn('bg-sidebar text-sidebar-foreground flex h-full flex-col', className)} {...props}>
        {children}
      </aside>
    );
  }

  return (
    <div
      ref={ref}
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      className='group peer hidden text-sidebar-foreground md:block'
    >
      {/* Spacer that shrinks when collapsed */}
      <div
        className={cn(
          'relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
        )}
      />
      {/* Fixed sidebar panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-10 hidden h-svh w-[--sidebar-width] flex-col bg-sidebar transition-[width] duration-200 ease-linear md:flex',
          'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[collapsible=icon]:overflow-hidden',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
Sidebar.displayName = 'Sidebar';

// ---------------------------------------------------------------------------
// Layout sub-components
// ---------------------------------------------------------------------------

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
        'text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroupContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='sidebar-group-content' data-sidebar='group-content' className={cn('w-full text-sm', className)} {...props} />
);

// ---------------------------------------------------------------------------
// Menu components
// ---------------------------------------------------------------------------

const SidebarMenu = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul data-slot='sidebar-menu' data-sidebar='menu' className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
);

const SidebarMenuItem = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li data-slot='sidebar-menu-item' data-sidebar='menu-item' className={cn('group/menu-item relative', className)} {...props} />
);

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline: 'bg-background shadow-[0_0_0_1px_var(--border-subtle)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0',
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
  tooltip?: string;
} & VariantProps<typeof sidebarMenuButtonVariants>;

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip: _tooltip,
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

const SidebarMenuSub = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul
    data-slot='sidebar-menu-sub'
    data-sidebar='menu-sub'
    className={cn('border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5', className)}
    {...props}
  />
);

const SidebarMenuSubItem = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li data-slot='sidebar-menu-sub-item' data-sidebar='menu-sub-item' className={cn('group/menu-sub-item relative', className)} {...props} />
);

type SidebarMenuSubButtonProps = React.ComponentProps<'a'> & {
  asChild?: boolean;
  size?: 'sm' | 'md';
  isActive?: boolean;
};

const SidebarMenuSubButton = ({ asChild = false, size = 'md', isActive = false, className, ...props }: SidebarMenuSubButtonProps) => {
  const Comp = asChild ? Slot : 'a';
  return (
    <Comp
      data-slot='sidebar-menu-sub-button'
      data-sidebar='menu-sub-button'
      data-size={size}
      data-active={isActive}
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        className,
      )}
      {...props}
    />
  );
};

const SidebarRail = ({ className, ...props }: React.ComponentProps<'button'>) => (
  <button
    data-slot='sidebar-rail'
    data-sidebar='rail'
    aria-label='Toggle Sidebar'
    tabIndex={-1}
    className={cn(
      'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      'in-data-[side=left]:in-data-[state=collapsed]:cursor-e-resize in-data-[side=right]:in-data-[state=collapsed]:cursor-w-resize',
      className,
    )}
    {...props}
  />
);

export {
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
  sidebarMenuButtonVariants,
  useSidebar,
};
