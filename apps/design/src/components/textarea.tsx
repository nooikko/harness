import type * as React from 'react';
import { cn } from 'ui';

const Textarea = ({ className, ...props }: React.ComponentProps<'textarea'>) => (
  <textarea
    data-slot='textarea'
    className={cn(
      'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] resize-y',
      'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
      'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

export { Textarea };
