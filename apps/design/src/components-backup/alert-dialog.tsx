import * as Dialog from '@radix-ui/react-dialog';
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

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  children: React.ReactNode;
};

const AlertDialog = ({ open, onOpenChange, trigger, children }: AlertDialogProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      {mounted && (
        <Dialog.Portal>
          <AnimatePresence>
            {open && (
              <motion.div
                key='alert-overlay'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={overlayStyle}
              />
            )}
          </AnimatePresence>
          <Dialog.Content forceMount style={contentContainerStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ display: 'none' }}>Alert dialog</Dialog.Title>
            <AnimatePresence onExitComplete={() => setMounted(false)}>
              {open && (
                <motion.div
                  key='alert-content'
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
                    padding: 28,
                    width: 420,
                  }}
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
};

const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{children}</p>
);

const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>{children}</p>
);

const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{children}</div>
);

const AlertDialogClose = Dialog.Close;

export { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle };
