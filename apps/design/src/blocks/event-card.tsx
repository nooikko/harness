import { motion } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventCardProps = {
  icon: string;
  title: string;
  detail: string;
  meta?: string;
  accent?: boolean;
  action?: { icon: string; onClick: () => void };
};

// ─── Component ────────────────────────────────────────────────────────────────

const EventCard = ({ icon, title, detail, meta, accent, action }: EventCardProps) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: action ? '6px 8px 6px 12px' : '8px 12px',
      background: accent ? 'var(--accent-subtle)' : 'var(--surface-card)',
      border: `1px solid ${accent ? 'var(--border)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-lg)',
      maxWidth: 320,
    }}
  >
    <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{detail}</div>
    </div>
    {meta && !action && (
      <span
        style={{
          fontSize: 11,
          color: accent ? 'var(--accent)' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
          paddingLeft: 4,
        }}
      >
        {meta}
      </span>
    )}
    {action && (
      <motion.button
        type='button'
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={(e) => {
          e.stopPropagation();
          action.onClick();
        }}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: accent ? 'var(--accent-subtle)' : 'var(--surface-active)',
          border: `1px solid ${accent ? 'var(--border)' : 'var(--border-subtle)'}`,
          color: accent ? 'var(--accent)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {action.icon}
      </motion.button>
    )}
  </div>
);

export type { EventCardProps };
export { EventCard };
