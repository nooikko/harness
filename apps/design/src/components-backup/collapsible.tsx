import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

type CollapsibleProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: React.CSSProperties;
};

const Collapsible = ({ trigger, children, open: controlledOpen, onOpenChange, defaultOpen = false, style }: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={handleOpenChange} style={style}>
      <CollapsiblePrimitive.Trigger asChild>
        <motion.button
          whileHover={{ backgroundColor: 'var(--surface-hover)' }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.1 }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {trigger}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ display: 'inline-block', fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            ▾
          </motion.span>
        </motion.button>
      </CollapsiblePrimitive.Trigger>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              overflow: 'hidden',
              willChange: 'height',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </CollapsiblePrimitive.Root>
  );
};

export { Collapsible };
