import type * as React from 'react';
import { cn } from 'ui';

// divide-y divide-border adds the internal dividers between header/content/footer
// overflow-hidden ensures border-radius clips children cleanly
// border border-border must be explicit — border alone defaults to currentColor in Tailwind v4

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'bg-card text-card-foreground flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border shadow-sm',
      className,
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col gap-0.5 px-4 py-3', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('text-sm font-semibold text-foreground', className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('text-xs text-muted-foreground', className)} {...props} />
);

const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('px-4 py-3 text-sm text-muted-foreground', className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('flex items-center justify-end gap-2 px-4 py-2', className)} {...props} />
);

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
