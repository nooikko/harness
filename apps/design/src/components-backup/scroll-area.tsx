import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type * as React from 'react';

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root>;

const ScrollArea = ({ children, style, ...props }: ScrollAreaProps) => (
  <ScrollAreaPrimitive.Root
    style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface-card)',
      ...style,
    }}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport style={{ width: '100%', height: '100%' }}>{children}</ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation='vertical'
      style={{
        display: 'flex',
        width: 6,
        padding: '2px',
        background: 'var(--surface-active)',
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
      }}
    >
      <ScrollAreaPrimitive.Thumb style={{ flex: 1, background: 'var(--border-strong)', borderRadius: 'var(--radius-pill)' }} />
    </ScrollAreaPrimitive.Scrollbar>
  </ScrollAreaPrimitive.Root>
);

export { ScrollArea };
