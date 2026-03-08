import type * as React from 'react';

type BadgeVariant = 'active' | 'success' | 'warning' | 'error' | 'neutral';

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  active: { background: 'var(--accent-subtle)', color: 'var(--accent)' },
  success: { background: 'oklch(0.95 0.04 150)', color: 'var(--success)' },
  warning: { background: 'oklch(0.96 0.04 70)', color: 'var(--warning)' },
  error: { background: 'oklch(0.96 0.03 20)', color: 'var(--destructive)' },
  neutral: { background: 'var(--surface-active)', color: 'var(--text-secondary)' },
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

const Badge = ({ variant = 'neutral', children, style }: BadgeProps) => (
  <div
    style={{
      padding: '3px 9px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 11,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      ...variantStyles[variant],
      ...style,
    }}
  >
    {children}
  </div>
);

export { Badge };
export type { BadgeVariant };
