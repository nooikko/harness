import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(0.160 0.010 285 / 0.35)',
  backdropFilter: 'blur(2px)',
  zIndex: 100,
};

const contentContainerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 101,
  pointerEvents: 'none',
  outline: 'none',
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  width?: number;
  padding?: number;
  children: React.ReactNode;
};

const Dialog = ({ open, onOpenChange, trigger, width = 480, padding = 32, children }: DialogProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      {mounted && (
        <DialogPrimitive.Portal>
          <AnimatePresence>
            {open && (
              <motion.div
                key='dialog-overlay'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={overlayStyle}
              />
            )}
          </AnimatePresence>
          <DialogPrimitive.Content forceMount style={contentContainerStyle} aria-describedby={undefined}>
            <DialogPrimitive.Title style={{ display: 'none' }}>Dialog</DialogPrimitive.Title>
            <AnimatePresence onExitComplete={() => setMounted(false)}>
              {open && (
                <motion.div
                  key='dialog-content'
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    pointerEvents: 'auto',
                    background: 'var(--surface-page)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-lg)',
                    padding,
                    width,
                  }}
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
};

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{children}</p>
);

const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>{children}</p>
);

const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{children}</div>
);

const DialogClose = DialogPrimitive.Close;

export { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle };
