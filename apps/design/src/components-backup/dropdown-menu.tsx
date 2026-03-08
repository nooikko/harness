import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

const popupSpring = { type: 'spring' as const, stiffness: 400, damping: 28 };

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  outline: 'none',
  userSelect: 'none',
  fontFamily: 'inherit',
  borderRadius: 'var(--radius-sm)',
};

type DropdownMenuProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: React.ComponentProps<typeof DropdownMenuPrimitive.Content>['align'];
  sideOffset?: number;
};

const DropdownMenu = ({ open: controlledOpen, onOpenChange, trigger, children, align = 'start', sideOffset = 6 }: DropdownMenuProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DropdownMenuPrimitive.Portal forceMount>
            <DropdownMenuPrimitive.Content forceMount sideOffset={sideOffset} align={align} style={{ zIndex: 50, outline: 'none' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={popupSpring}
                style={{
                  transformOrigin: 'top left',
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
          </DropdownMenuPrimitive.Portal>
        )}
      </AnimatePresence>
    </DropdownMenuPrimitive.Root>
  );
};

type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  icon?: React.ReactNode;
  destructive?: boolean;
};

const DropdownMenuItem = ({ icon, destructive = false, children, ...props }: DropdownMenuItemProps) => (
  <DropdownMenuPrimitive.Item
    style={{ ...itemStyle, color: destructive ? 'var(--destructive)' : 'var(--text-primary)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = destructive ? 'oklch(0.96 0.03 20)' : 'var(--surface-hover)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
    {...props}
  >
    {icon && <span style={{ color: destructive ? undefined : 'var(--text-tertiary)', width: 14 }}>{icon}</span>}
    {children}
  </DropdownMenuPrimitive.Item>
);

const DropdownMenuSeparator = () => <DropdownMenuPrimitive.Separator style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />;

export { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator };
