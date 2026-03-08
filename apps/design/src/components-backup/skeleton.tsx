import type * as React from 'react';
import { cn } from 'ui';

const Skeleton = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
);

export { Skeleton };
