'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../index';

type CollapsibleContextValue = { open: boolean };
const CollapsibleContext = React.createContext<CollapsibleContextValue>({ open: false });

const Collapsible = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  defaultOpen = false,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root> & { defaultOpen?: boolean }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };
  return (
    <CollapsibleContext.Provider value={{ open }}>
      <CollapsiblePrimitive.Root data-slot='collapsible' open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </CollapsiblePrimitive.Root>
    </CollapsibleContext.Provider>
  );
};

const CollapsibleTrigger = ({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) => (
  <CollapsiblePrimitive.CollapsibleTrigger data-slot='collapsible-trigger' {...props} />
);

type CollapsibleContentProps = { className?: string; children?: React.ReactNode };

const CollapsibleContent = ({ className, children }: CollapsibleContentProps) => {
  const { open } = React.useContext(CollapsibleContext);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          data-slot='collapsible-content'
          className={cn('overflow-hidden', className)}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
