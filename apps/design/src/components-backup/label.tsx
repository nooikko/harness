import type * as React from 'react';
import { cn } from 'ui';

const Label = ({ className, ...props }: React.ComponentProps<'label'>) => (
  <label
    className={cn('text-sm font-medium leading-none select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)}
    {...props}
  />
);

export { Label };
