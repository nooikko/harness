'use client';

import { motion } from 'motion/react';
import * as React from 'react';
import { cn } from '../index';

type TabsContextValue = { value: string; onValueChange: (value: string) => void };
const TabsContext = React.createContext<TabsContextValue>({ value: '', onValueChange: () => {} });

type TabsProps = React.ComponentProps<'div'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const Tabs = ({ children, value: controlledValue, onValueChange: controlledChange, defaultValue, className, ...props }: TabsProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const handleChange = (next: string) => {
    setInternalValue(next);
    controlledChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
      <div data-slot='tabs' className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ className, style, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='tabs-list'
    role='tablist'
    className={className}
    style={{
      position: 'relative',
      display: 'flex',
      borderBottom: '1px solid var(--border-subtle)',
      ...style,
    }}
    {...props}
  />
);

type TabsTriggerProps = React.ComponentProps<'button'> & { value: string };

const TabsTrigger = ({ className, value, children, style, ...props }: TabsTriggerProps) => {
  const { value: activeValue, onValueChange } = React.useContext(TabsContext);
  const isActive = activeValue === value;
  return (
    <motion.button
      data-slot='tabs-trigger'
      type='button'
      role='tab'
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={cn('disabled:pointer-events-none disabled:opacity-50', className)}
      style={{
        position: 'relative',
        padding: '8px 16px',
        background: 'none',
        border: 'none',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'color 0.12s',
        ...style,
      }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId='tab-indicator'
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--accent)',
            borderRadius: 'var(--radius-pill)',
          }}
        />
      )}
    </motion.button>
  );
};

type TabsContentProps = React.ComponentProps<'div'> & { value: string };

const TabsContent = ({ className, value, children, ...props }: TabsContentProps) => {
  const { value: activeValue } = React.useContext(TabsContext);
  if (activeValue !== value) {
    return null;
  }
  return (
    <div data-slot='tabs-content' role='tabpanel' className={cn('flex-1 outline-none', className)} {...props}>
      {children}
    </div>
  );
};

export { Tabs, TabsContent, TabsList, TabsTrigger };
