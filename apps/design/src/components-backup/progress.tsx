import { motion } from 'motion/react';

type ProgressProps = {
  value: number; // 0–1
  label?: string;
  showPercent?: boolean;
};

const Progress = ({ value, label, showPercent = true }: ProgressProps) => {
  const color = value > 0.85 ? 'var(--destructive)' : value > 0.6 ? 'var(--accent)' : 'var(--success)';

  return (
    <div>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {label && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>}
          {showPercent && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{Math.round(value * 100)}%</span>
          )}
        </div>
      )}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 'var(--radius-pill)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
          style={{ height: '100%', background: color, borderRadius: 'var(--radius-pill)' }}
        />
      </div>
    </div>
  );
};

export { Progress };
