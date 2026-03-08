import { motion } from 'motion/react';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const Switch = ({ checked, onCheckedChange }: SwitchProps) => (
  <motion.div
    role='switch'
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    animate={{ backgroundColor: checked ? 'var(--accent)' : 'var(--border-strong)' }}
    transition={{ duration: 0.15 }}
    style={{
      width: 40,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      position: 'relative',
      flexShrink: 0,
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
