import type * as React from 'react';
import { cn } from 'ui';

export type AlertVariant = 'info' | 'success' | 'warning' | 'destructive';

// Semantic colors not in @theme — defined explicitly per variant
const VARIANT_COLORS: Record<AlertVariant, { bg: string; borderColor: string; iconColor: string }> = {
  info: { bg: 'var(--accent-subtle)', borderColor: 'var(--accent-muted)', iconColor: 'var(--accent)' },
  success: { bg: 'oklch(0.95 0.04 150)', borderColor: 'oklch(0.78 0.08 150)', iconColor: 'var(--success)' },
  warning: { bg: 'oklch(0.96 0.04 70)', borderColor: 'oklch(0.78 0.07 70)', iconColor: 'var(--warning)' },
  destructive: { bg: 'oklch(0.96 0.03 20)', borderColor: 'oklch(0.75 0.09 20)', iconColor: 'var(--destructive)' },
};

export type AlertProps = React.ComponentProps<'div'> & {
  variant?: AlertVariant;
  icon?: React.ReactNode;
};

// border sets width + style; inline borderColor sets the semantic hue — no conflict
const Alert = ({ variant = 'info', icon, className, children, style, ...props }: AlertProps) => {
  const { bg, borderColor, iconColor } = VARIANT_COLORS[variant];
  return (
    <div
      role='alert'
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm', className)}
      style={{ background: bg, borderColor, ...style }}
      {...props}
    >
      {icon !== undefined && (
        <span className='mt-0.5 shrink-0' style={{ color: iconColor }}>
          {icon}
        </span>
      )}
      <span className='leading-relaxed text-foreground'>{children}</span>
    </div>
  );
};

const AlertTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('font-semibold leading-none', className)} {...props} />
);

const AlertDescription = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('text-sm leading-relaxed', className)} {...props} />
);

export { Alert, AlertDescription, AlertTitle };
