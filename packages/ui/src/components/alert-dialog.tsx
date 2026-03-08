'use client';

// AlertDialog is built on @radix-ui/react-dialog (the only available dialog primitive in this app).
// It exposes the same composable API as the shadcn alert-dialog package.
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../index';

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 };

type AlertDialogContextValue = { open: boolean; onOpenChange: (open: boolean) => void };
const AlertDialogContext = React.createContext<AlertDialogContextValue>({ open: false, onOpenChange: () => {} });

const AlertDialog = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} data-slot='alert-dialog' {...props}>
        {children}
      </DialogPrimitive.Root>
    </AlertDialogContext.Provider>
  );
};

const AlertDialogTrigger = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) => (
  <DialogPrimitive.Trigger data-slot='alert-dialog-trigger' {...props} />
);

const AlertDialogPortal = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) => (
  <DialogPrimitive.Portal data-slot='alert-dialog-portal' {...props} />
);

const AlertDialogOverlay = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay data-slot='alert-dialog-overlay' className={cn('fixed inset-0 z-50 bg-black/50', className)} {...props} />
);

const AlertDialogContent = ({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) => {
  const { open } = React.useContext(AlertDialogContext);
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
            key='alert-dialog-backdrop'
            className='fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
      {/* Dialog Content: pointer-events-none container, provides focus trap + a11y */}
      <DialogPrimitive.Content
        data-slot='alert-dialog-content'
        forceMount
        className='fixed inset-0 z-50 flex items-center justify-center p-4 outline-none'
        style={{ pointerEvents: 'none' }}
        {...props}
      >
        <AnimatePresence onExitComplete={() => setMounted(false)}>
          {open && (
            <motion.div
              key='alert-dialog-panel'
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
            </motion.div>
          )}
        </AnimatePresence>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

const AlertDialogHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='alert-dialog-header' className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
);

const AlertDialogFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='alert-dialog-footer' className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);

const AlertDialogTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title data-slot='alert-dialog-title' className={cn('text-lg leading-none font-semibold', className)} {...props} />
);

const AlertDialogDescription = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description data-slot='alert-dialog-description' className={cn('text-muted-foreground text-sm', className)} {...props} />
);

type AlertDialogActionProps = React.ComponentProps<'button'> & { asChild?: boolean };

const AlertDialogAction = ({ className, onClick, ...props }: AlertDialogActionProps) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return (
    <button
      data-slot='alert-dialog-action'
      type='button'
      className={cn(
        'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    />
  );
};

type AlertDialogCancelProps = React.ComponentProps<'button'>;

const AlertDialogCancel = ({ className, onClick, ...props }: AlertDialogCancelProps) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return (
    <button
      data-slot='alert-dialog-cancel'
      type='button'
      className={cn(
        'border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mt-2 inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 sm:mt-0',
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    />
  );
};

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
