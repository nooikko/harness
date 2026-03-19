'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../cn';

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 };

type DialogContextValue = { open: boolean };
const DialogContext = React.createContext<DialogContextValue>({ open: false });

const Dialog = ({ children, open: controlledOpen, onOpenChange: controlledChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <DialogContext.Provider value={{ open }}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} data-slot='dialog' {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

const DialogTrigger = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) => (
  <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />
);

const DialogPortal = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) => (
  <DialogPrimitive.Portal data-slot='dialog-portal' {...props} />
);

const DialogClose = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) => (
  <DialogPrimitive.Close data-slot='dialog-close' {...props} />
);

// DialogOverlay is available for custom usage; animation is bundled into DialogContent.
const DialogOverlay = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay data-slot='dialog-overlay' className={cn('fixed inset-0 z-50 bg-black/50', className)} {...props} />
);

const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) => {
  const { open } = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <DialogPrimitive.Portal>
      {/* Animated backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key='dialog-backdrop'
            className='fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
      {/* Radix Content: pointer-events-none container, provides focus trap + a11y */}
      <DialogPrimitive.Content
        data-slot='dialog-content'
        forceMount
        className='fixed inset-0 z-50 flex items-center justify-center p-4 outline-none'
        style={{ pointerEvents: 'none' }}
        {...props}
      >
        <AnimatePresence onExitComplete={() => setMounted(false)}>
          {open && (
            <motion.div
              key='dialog-panel'
              className={cn('relative w-full max-w-[calc(100%-2rem)] rounded-lg border border-border p-6 sm:max-w-lg', className)}
              style={{
                pointerEvents: 'auto',
                background: 'var(--surface-page)',
                boxShadow: 'var(--shadow-lg)',
              }}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
            >
              {children}
              {showCloseButton && (
                <DialogPrimitive.Close
                  data-slot='dialog-close'
                  className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  <XIcon />
                  <span className='sr-only'>Close</span>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

const DialogHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='dialog-header' className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='dialog-footer' className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);

const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title data-slot='dialog-title' className={cn('text-lg leading-none font-semibold', className)} {...props} />
);

const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description data-slot='dialog-description' className={cn('text-muted-foreground text-sm', className)} {...props} />
);

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger };
