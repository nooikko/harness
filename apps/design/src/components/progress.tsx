import * as ProgressPrimitive from '@radix-ui/react-progress';
import { motion } from 'motion/react';
import type * as React from 'react';
import { cn } from 'ui';

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number; // 0–1
  label?: string;
  showPercent?: boolean;
};

const barColor = (value: number) => {
  if (value > 0.85) {
    return 'bg-destructive';
  }
  if (value > 0.6) {
    return 'bg-primary';
  }
  return 'bg-success';
};

const Progress = ({ className, value, label, showPercent = true, ...props }: ProgressProps) => (
  <div className={cn('w-full', className)}>
    {(label !== undefined || showPercent) && (
      <div className='mb-1.5 flex items-center justify-between'>
        {label !== undefined && <span className='text-xs text-muted-foreground'>{label}</span>}
        {showPercent && <span className='font-mono text-[11px] text-muted-foreground/70'>{Math.round(value * 100)}%</span>}
      </div>
    )}
    <ProgressPrimitive.Root
      data-slot='progress'
      className='relative h-1 w-full overflow-hidden rounded-full bg-secondary'
      value={Math.round(value * 100)}
      {...props}
    >
      <motion.div
        data-slot='progress-indicator'
        className={cn('h-full rounded-full', barColor(value))}
        initial={{ width: '0%' }}
        animate={{ width: `${value * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      />
    </ProgressPrimitive.Root>
  </div>
);

export { Progress };
