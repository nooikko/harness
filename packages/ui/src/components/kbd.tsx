import type * as React from 'react';
import { cn } from '../index';

const Kbd = ({ className, style, ...props }: React.ComponentProps<'kbd'>) => (
  <kbd
    className={cn('inline-flex items-center justify-center', className)}
    style={{
      padding: '2px 6px',
      background: 'var(--surface-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 11,
      lineHeight: 1.6,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      cursor: 'default',
      ...style,
    }}
    {...props}
  />
);

export { Kbd };
