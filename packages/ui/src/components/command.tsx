'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../cn';
import { Kbd } from './kbd';

const spring = { type: 'spring' as const, stiffness: 400, damping: 28 };

// ─── Command root ─────────────────────────────────────────────────────────────

const Command = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    data-slot='command'
    className={cn('bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md', className)}
    {...props}
  />
);

// ─── CommandDialog — self-contained modal (own animation, upper-center position) ──

type CommandDialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  title?: string;
  description?: string;
  className?: string;
};

const CommandDialog = ({
  children,
  open: controlledOpen,
  onOpenChange: controlledChange,
  title = 'Command palette',
  description = 'Search for commands and actions',
  className,
  ...props
}: CommandDialogProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleChange = (next: boolean) => {
    setInternalOpen(next);
    controlledChange?.(next);
  };

  React.useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleChange} data-slot='command-dialog' {...props}>
      {mounted && (
        <DialogPrimitive.Portal>
          <AnimatePresence>
            {open && (
              <motion.div
                key='command-backdrop'
                className='fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            )}
          </AnimatePresence>
          <DialogPrimitive.Content
            data-slot='command-dialog-content'
            forceMount
            className='fixed inset-0 z-50 flex items-start justify-center pt-[15vh] outline-none'
            style={{ pointerEvents: 'none' }}
          >
            <DialogPrimitive.Title className='sr-only'>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className='sr-only'>{description}</DialogPrimitive.Description>
            <AnimatePresence onExitComplete={() => setMounted(false)}>
              {open && (
                <motion.div
                  key='command-panel'
                  className={cn('overflow-hidden rounded-xl border border-border', className)}
                  style={{
                    width: 520,
                    pointerEvents: 'auto',
                    background: 'var(--surface-page)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                  initial={{ opacity: 0, scale: 0.95, y: -16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={spring}
                >
                  <Command>{children}</Command>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
};

// ─── Composable sub-components ────────────────────────────────────────────────

const CommandInput = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) => (
  <div data-slot='command-input-wrapper' className='flex h-10 items-center gap-2 border-b border-border px-3'>
    <SearchIcon className='size-4 shrink-0 text-muted-foreground' />
    <CommandPrimitive.Input
      data-slot='command-input'
      className={cn(
        'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
);

const CommandList = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    data-slot='command-list'
    className={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
    {...props}
  />
);

const CommandEmpty = ({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty data-slot='command-empty' className='py-6 text-center text-sm text-muted-foreground' {...props} />
);

const CommandGroup = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    data-slot='command-group'
    className={cn(
      'text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium',
      className,
    )}
    {...props}
  />
);

const CommandSeparator = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator data-slot='command-separator' className={cn('bg-border -mx-1 h-px', className)} {...props} />
);

const CommandItem = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    data-slot='command-item'
    className={cn(
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
);

const CommandShortcut = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span data-slot='command-shortcut' className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)} {...props} />
);

// ─── CommandFooter — design system addition, not in shadcn ───────────────────

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
  <div className='flex gap-4 border-t border-border px-3.5 py-2'>
    {hints.map(([key, label]) => (
      <div key={label} className='flex items-center gap-1.5 text-[11px] text-muted-foreground'>
        <Kbd>{key}</Kbd>
        {label}
      </div>
    ))}
  </div>
);

export type { CommandFooterHint, CommandFooterProps };
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
