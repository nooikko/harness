import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../index';

// Grid layout: first column holds the icon (0 width when absent, 16px when present).
// When the `icon` prop is provided the column widens explicitly.
// has-[>svg] handles the case where an SVG is passed as a direct child without `icon`.
const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid grid-cols-[0_1fr] gap-y-0.5 items-start has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        info: 'bg-accent text-accent-foreground border-accent-foreground/20',
        success: 'bg-success/10 border-success/30 text-foreground [&>svg]:text-success',
        warning: 'bg-warning/10 border-warning/30 text-foreground [&>svg]:text-warning',
        destructive: 'bg-destructive/10 border-destructive/30 text-destructive [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

type AlertProps = React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    icon?: React.ReactNode;
  };

const Alert = ({ className, variant, icon, children, ...props }: AlertProps) => (
  <div
    data-slot='alert'
    role='alert'
    className={cn(
      alertVariants({ variant }),
      // Widen first column when icon prop is provided (handles non-SVG icons like emoji)
      icon !== undefined && 'grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3',
      className,
    )}
    {...props}
  >
    {icon !== undefined && (
      <span data-slot='alert-icon' className='flex size-4 translate-y-0.5 items-center justify-center text-current'>
        {icon}
      </span>
    )}
    {children}
  </div>
);

const AlertTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='alert-title' className={cn('col-start-2 font-semibold leading-none tracking-tight', className)} {...props} />
);

const AlertDescription = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='alert-description' className={cn('col-start-2 text-sm leading-relaxed [&_p]:leading-relaxed', className)} {...props} />
);

export { Alert, alertVariants, AlertDescription, AlertTitle };
export type { AlertProps };
