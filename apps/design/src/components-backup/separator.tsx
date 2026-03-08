import type * as React from 'react';
import { cn } from 'ui';

type SeparatorProps = React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical';
};

const Separator = ({ orientation = 'horizontal', className, ...props }: SeparatorProps) => (
  <div
    role='separator'
    aria-orientation={orientation}
    className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'bg-border', className)}
    {...props}
  />
);

export { Separator };
