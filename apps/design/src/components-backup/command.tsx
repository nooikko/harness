import * as Dialog from '@radix-ui/react-dialog';
import { Command as CmdkCommand } from 'cmdk';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { Kbd } from './kbd';

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
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '15vh',
  zIndex: 101,
  pointerEvents: 'none',
  outline: 'none',
};

type CommandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

const CommandDialog = ({ open, onOpenChange, children }: CommandDialogProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {mounted && (
        <Dialog.Portal>
          <AnimatePresence>
            {open && (
              <motion.div
                key='cmd-overlay'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={overlayStyle}
              />
            )}
          </AnimatePresence>
          <Dialog.Content forceMount style={contentContainerStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ display: 'none' }}>Command palette</Dialog.Title>
            <AnimatePresence onExitComplete={() => setMounted(false)}>
              {open && (
                <motion.div
                  key='cmd-content'
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    pointerEvents: 'auto',
                    width: 520,
                    background: 'var(--surface-page)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                  }}
                >
                  <CmdkCommand style={{ fontFamily: 'inherit' }}>{children}</CmdkCommand>
                </motion.div>
              )}
            </AnimatePresence>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
};

const CommandInput = (props: React.ComponentProps<typeof CmdkCommand.Input>) => (
  <div
    style={{
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>⌕</span>
    <CmdkCommand.Input
      style={{
        flex: 1,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: 14,
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
      }}
      {...props}
    />
  </div>
);

const CommandList = (props: React.ComponentProps<typeof CmdkCommand.List>) => (
  <CmdkCommand.List style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }} {...props} />
);

const CommandEmpty = (props: React.ComponentProps<typeof CmdkCommand.Empty>) => (
  <CmdkCommand.Empty style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }} {...props} />
);

type CommandGroupProps = React.ComponentProps<typeof CmdkCommand.Group> & { heading?: string };

const CommandGroup = ({ heading, children, ...props }: CommandGroupProps) => (
  <CmdkCommand.Group {...props}>
    {heading && (
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '6px 10px 4px',
        }}
      >
        {heading}
      </div>
    )}
    {children}
  </CmdkCommand.Group>
);

const CommandItem = (props: React.ComponentProps<typeof CmdkCommand.Item>) => (
  <CmdkCommand.Item
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      fontSize: 13,
      color: 'var(--text-primary)',
      cursor: 'pointer',
      borderRadius: 'var(--radius-md)',
      outline: 'none',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--surface-hover)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
    {...props}
  />
);

type CommandFooterHint = [key: string, label: string];

type CommandFooterProps = {
  hints?: CommandFooterHint[];
};

const CommandFooter = ({
  hints = [
    ['↵', 'Select'],
    ['↑↓', 'Navigate'],
    ['Esc', 'Close'],
  ],
}: CommandFooterProps) => (
  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 16 }}>
    {hints.map(([key, label]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <Kbd>{key}</Kbd>
        {label}
      </div>
    ))}
  </div>
);

export { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandFooter };
