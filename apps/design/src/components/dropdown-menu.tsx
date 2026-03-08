import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from 'ui';

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 };

// ─── Shared item styles ────────────────────────────────────────────────────────

const itemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'default',
  outline: 'none',
  userSelect: 'none',
  position: 'relative',
};

const itemHoverClass =
  'data-[highlighted]:bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-[var(--text-tertiary)]';
const itemDestructiveClass = 'data-[highlighted]:bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/10 [&_svg]:text-[var(--destructive)]';

// ─── Context ───────────────────────────────────────────────────────────────────

type DropdownMenuContextValue = { open: boolean };
const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({ open: false });

type DropdownMenuSubContextValue = { open: boolean };
const DropdownMenuSubContext = React.createContext<DropdownMenuSubContextValue>({ open: false });

// ─── Root ──────────────────────────────────────────────────────────────────────

const DropdownMenu = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <DropdownMenuContext.Provider value={{ open }}>
      <DropdownMenuPrimitive.Root data-slot='dropdown-menu' open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DropdownMenuPrimitive.Root>
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuPortal = ({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) => (
  <DropdownMenuPrimitive.Portal data-slot='dropdown-menu-portal' {...props} />
);

const DropdownMenuTrigger = ({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) => (
  <DropdownMenuPrimitive.Trigger data-slot='dropdown-menu-trigger' {...props} />
);

// ─── Content ───────────────────────────────────────────────────────────────────

const DropdownMenuContent = ({
  className,
  children,
  sideOffset = 6,
  align = 'start',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) => {
  const { open } = React.useContext(DropdownMenuContext);
  return (
    <DropdownMenuPrimitive.Portal>
      <AnimatePresence>
        {open && (
          <DropdownMenuPrimitive.Content
            data-slot='dropdown-menu-content'
            sideOffset={sideOffset}
            align={align}
            forceMount
            style={{ zIndex: 50, outline: 'none' }}
            className={className}
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={spring}
              style={{
                minWidth: 200,
                background: 'var(--surface-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: 4,
                overflow: 'hidden',
              }}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        )}
      </AnimatePresence>
    </DropdownMenuPrimitive.Portal>
  );
};

// ─── Group ─────────────────────────────────────────────────────────────────────

const DropdownMenuGroup = ({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) => (
  <DropdownMenuPrimitive.Group data-slot='dropdown-menu-group' {...props} />
);

// ─── Items ─────────────────────────────────────────────────────────────────────

const DropdownMenuItem = ({
  className,
  inset,
  variant = 'default',
  style,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}) => (
  <DropdownMenuPrimitive.Item
    data-slot='dropdown-menu-item'
    data-variant={variant}
    className={cn(itemHoverClass, variant === 'destructive' && itemDestructiveClass, className)}
    style={{
      ...itemBase,
      paddingLeft: inset ? 32 : 12,
      color: variant === 'destructive' ? 'var(--destructive)' : 'var(--text-primary)',
      ...style,
    }}
    {...props}
  />
);

const DropdownMenuCheckboxItem = ({
  className,
  children,
  checked,
  style,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) => (
  <DropdownMenuPrimitive.CheckboxItem
    data-slot='dropdown-menu-checkbox-item'
    className={cn(itemHoverClass, className)}
    style={{ ...itemBase, paddingLeft: 32, ...style }}
    checked={checked}
    {...props}
  >
    <span style={{ position: 'absolute', left: 8, display: 'flex', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon style={{ width: 14, height: 14 }} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
);

const DropdownMenuRadioGroup = ({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) => (
  <DropdownMenuPrimitive.RadioGroup data-slot='dropdown-menu-radio-group' {...props} />
);

const DropdownMenuRadioItem = ({ className, children, style, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) => (
  <DropdownMenuPrimitive.RadioItem
    data-slot='dropdown-menu-radio-item'
    className={cn(itemHoverClass, className)}
    style={{ ...itemBase, paddingLeft: 32, ...style }}
    {...props}
  >
    <span style={{ position: 'absolute', left: 8, display: 'flex', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <DropdownMenuPrimitive.ItemIndicator>
        <CircleIcon style={{ width: 8, height: 8, fill: 'currentColor' }} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
);

// ─── Label, Separator, Shortcut ────────────────────────────────────────────────

const DropdownMenuLabel = ({ className, inset, style, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) => (
  <DropdownMenuPrimitive.Label
    data-slot='dropdown-menu-label'
    className={className}
    style={{
      padding: '5px 12px',
      paddingLeft: inset ? 32 : 12,
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      ...style,
    }}
    {...props}
  />
);

const DropdownMenuSeparator = ({ className, style, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) => (
  <DropdownMenuPrimitive.Separator
    data-slot='dropdown-menu-separator'
    className={className}
    style={{
      height: 1,
      background: 'var(--border-subtle)',
      margin: '4px 0',
      ...style,
    }}
    {...props}
  />
);

const DropdownMenuShortcut = ({ className, style, ...props }: React.ComponentProps<'span'>) => (
  <span
    data-slot='dropdown-menu-shortcut'
    className={className}
    style={{
      marginLeft: 'auto',
      fontSize: 11,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.05em',
      ...style,
    }}
    {...props}
  />
);

// ─── Sub ───────────────────────────────────────────────────────────────────────

const DropdownMenuSub = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <DropdownMenuSubContext.Provider value={{ open }}>
      <DropdownMenuPrimitive.Sub data-slot='dropdown-menu-sub' open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DropdownMenuPrimitive.Sub>
    </DropdownMenuSubContext.Provider>
  );
};

const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  style,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) => (
  <DropdownMenuPrimitive.SubTrigger
    data-slot='dropdown-menu-sub-trigger'
    className={cn(itemHoverClass, 'data-[state=open]:bg-[var(--surface-hover)]', className)}
    style={{ ...itemBase, paddingLeft: inset ? 32 : 12, ...style }}
    {...props}
  >
    {children}
    <ChevronRightIcon style={{ marginLeft: 'auto', width: 14, height: 14, color: 'var(--text-tertiary)' }} />
  </DropdownMenuPrimitive.SubTrigger>
);

const DropdownMenuSubContent = ({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) => {
  const { open } = React.useContext(DropdownMenuSubContext);
  return (
    <DropdownMenuPrimitive.Portal>
      <AnimatePresence>
        {open && (
          <DropdownMenuPrimitive.SubContent
            data-slot='dropdown-menu-sub-content'
            forceMount
            style={{ zIndex: 50, outline: 'none' }}
            className={className}
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -4 }}
              transition={spring}
              style={{
                minWidth: 180,
                background: 'var(--surface-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: 4,
                overflow: 'hidden',
              }}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.SubContent>
        )}
      </AnimatePresence>
    </DropdownMenuPrimitive.Portal>
  );
};

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
