'use client';

import { motion } from 'motion/react';
import { cn } from '../index';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const Switch = ({ checked, onCheckedChange, id, disabled, className }: SwitchProps) => (
  <motion.div
    id={id}
    role='switch'
    aria-checked={checked}
    aria-disabled={disabled}
    onClick={() => !disabled && onCheckedChange(!checked)}
    animate={{ backgroundColor: checked ? 'var(--accent)' : 'var(--border-strong)' }}
    transition={{ duration: 0.15 }}
    className={cn(className)}
    style={{
      width: 40,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      position: 'relative',
      flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <motion.div
      animate={{ x: checked ? 20 : 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        position: 'absolute',
        top: 2,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 3px oklch(0 0 0 / 0.15)',
      }}
    />
  </motion.div>
);

export { Switch };
