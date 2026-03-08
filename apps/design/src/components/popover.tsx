import * as PopoverPrimitive from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 };

// ─── Context ───────────────────────────────────────────────────────────────────

type PopoverContextValue = { open: boolean };
const PopoverContext = React.createContext<PopoverContextValue>({ open: false });

// ─── Root ──────────────────────────────────────────────────────────────────────

const Popover = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <PopoverContext.Provider value={{ open }}>
      <PopoverPrimitive.Root data-slot='popover' open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </PopoverPrimitive.Root>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = ({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) => (
  <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />
);

// ─── Content ───────────────────────────────────────────────────────────────────

type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content> & {
  width?: number;
  padding?: number;
};

const PopoverContent = ({ children, sideOffset = 8, align = 'start', width = 240, padding = 16, style, ...props }: PopoverContentProps) => {
  const { open } = React.useContext(PopoverContext);
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            data-slot='popover-content'
            forceMount
            sideOffset={sideOffset}
            align={align}
            style={{ zIndex: 50, outline: 'none' }}
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
              style={{
                transformOrigin: 'top left',
                width,
                background: 'var(--surface-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                padding,
                overflow: 'hidden',
                ...style,
              }}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  );
};

const PopoverClose = ({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Close>) => (
  <PopoverPrimitive.Close data-slot='popover-close' {...props} />
);

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
