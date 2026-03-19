'use client';

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type * as React from 'react';
import { cn } from '../cn';

const ScrollBar = ({ className, orientation = 'vertical', ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    data-slot='scroll-area-scrollbar'
    orientation={orientation}
    className={cn(
      'flex touch-none p-px transition-colors select-none bg-secondary',
      orientation === 'vertical' && 'h-full w-1.5 rounded-r-[inherit]',
      orientation === 'horizontal' && 'h-1.5 flex-col rounded-b-[inherit]',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb data-slot='scroll-area-thumb' className='bg-border-strong relative flex-1 rounded-full' />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
);

const ScrollArea = ({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) => (
  <ScrollAreaPrimitive.Root data-slot='scroll-area' className={cn('relative', className)} {...props}>
    <ScrollAreaPrimitive.Viewport
      data-slot='scroll-area-viewport'
      className='focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1'
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);

export { ScrollArea, ScrollBar };
