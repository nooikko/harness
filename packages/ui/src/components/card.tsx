import type * as React from 'react';
import { cn } from '../index';

// overflow-hidden clips border-radius cleanly on children
// divide-y divide-border adds internal dividers between header/content/footer
// border border-border must be explicit — bare `border` defaults to currentColor in Tailwind v4

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card'
    className={cn('bg-card text-card-foreground flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border', className)}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-header' className={cn('flex flex-col gap-0.5 px-4 py-3', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-title' className={cn('text-sm font-semibold text-foreground', className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-description' className={cn('text-xs text-muted-foreground', className)} {...props} />
);

const CardAction = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-action' className={cn('ml-auto shrink-0', className)} {...props} />
);

const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-content' className={cn('px-4 py-3 text-sm', className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-footer' className={cn('flex items-center justify-end gap-2 px-4 py-2', className)} {...props} />
);

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
