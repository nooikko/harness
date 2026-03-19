'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type * as React from 'react';
import { cn } from '../cn';

const Select = ({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) => <SelectPrimitive.Root data-slot='select' {...props} />;

const SelectGroup = ({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) => (
  <SelectPrimitive.Group data-slot='select-group' {...props} />
);

const SelectValue = ({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) => (
  <SelectPrimitive.Value data-slot='select-value' {...props} />
);

const SelectTrigger = ({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) => (
  <SelectPrimitive.Trigger
    data-slot='select-trigger'
    className={cn(
      'border-input data-placeholder:text-muted-foreground flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]',
      'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
      'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className='size-4 opacity-50' />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);

const SelectScrollUpButton = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) => (
  <SelectPrimitive.ScrollUpButton
    data-slot='select-scroll-up-button'
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUpIcon className='size-4' />
  </SelectPrimitive.ScrollUpButton>
);

const SelectScrollDownButton = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) => (
  <SelectPrimitive.ScrollDownButton
    data-slot='select-scroll-down-button'
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDownIcon className='size-4' />
  </SelectPrimitive.ScrollDownButton>
);

const SelectContent = ({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      data-slot='select-content'
      className={cn(
        'bg-background text-foreground relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border border-border shadow-md',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'w-full min-w-(--radix-select-trigger-width)')}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </motion.div>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);

const SelectLabel = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) => (
  <SelectPrimitive.Label data-slot='select-label' className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props} />
);

const SelectItem = ({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) => (
  <SelectPrimitive.Item
    data-slot='select-item'
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm text-foreground outline-none',
      'hover:bg-accent focus:bg-accent',
      'data-disabled:pointer-events-none data-disabled:opacity-50',
      '[&_svg]:pointer-events-none [&_svg]:shrink-0',
      className,
    )}
    {...props}
  >
    <span className='absolute right-2 flex size-3.5 items-center justify-center'>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className='size-4' />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);

const SelectSeparator = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) => (
  <SelectPrimitive.Separator data-slot='select-separator' className={cn('bg-border -mx-1 my-1 h-px', className)} {...props} />
);

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
