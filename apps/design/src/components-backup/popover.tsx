import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

const popupSpring = { type: 'spring' as const, stiffness: 400, damping: 28 };

type PopoverProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  padding?: number;
  sideOffset?: number;
  align?: React.ComponentProps<typeof PopoverPrimitive.Content>['align'];
};

const Popover = ({
  open: controlledOpen,
  onOpenChange,
  trigger,
  children,
  width = 240,
  padding = 16,
  sideOffset = 8,
  align = 'start',
}: PopoverProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content forceMount sideOffset={sideOffset} align={align} style={{ zIndex: 50, outline: 'none' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={popupSpring}
                style={{
                  transformOrigin: 'top left',
                  width,
                  background: 'var(--surface-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  padding,
                  overflow: 'hidden',
                }}
              >
                {children}
              </motion.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  );
};

export { Popover };
