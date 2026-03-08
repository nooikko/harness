import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';

// ─── Spring Physics Explorer ────────────────────────────────────────────────
const SpringExplorer = () => {
  const [stiffness, setStiffness] = useState(165);
  const [damping, setDamping] = useState(18);
  const [mass, setMass] = useState(1.2);
  const [key, setKey] = useState(0);
  const play = () => setKey((k) => k + 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Spring Physics Explorer
        </div>
        <button
          type='button'
          onClick={play}
          style={{
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          ▶ Play
        </button>
      </div>

      {/* The animated element */}
      <div
        style={{
          height: 60,
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        <motion.div
          key={key}
          initial={{ x: 0 }}
          animate={{ x: 260 }}
          transition={{ type: 'spring', stiffness, damping, mass }}
          style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', flexShrink: 0 }}
        />
      </div>

      {/* Controls */}
      {[
        { label: 'Stiffness', value: stiffness, set: setStiffness, min: 50, max: 800, hint: 'Higher = snappier' },
        { label: 'Damping', value: damping, set: setDamping, min: 1, max: 80, hint: 'Lower = more bounce' },
        { label: 'Mass', value: mass, set: setMass, min: 0.1, max: 3, hint: 'Higher = heavier, slower' },
      ].map(({ label, value, set, min, max, hint }) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{Number(value).toFixed(1)}</span>
          </div>
          <input
            type='range'
            min={min}
            max={max}
            step={label === 'Mass' ? 0.1 : 1}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>
        </div>
      ))}
    </div>
  );
};

// ─── AnimatePresence — enter/exit ───────────────────────────────────────────
const PresenceDemo = () => {
  const [items, setItems] = useState(['Morning Digest', 'Dev planning', 'Kitchen lights']);

  const remove = (item: string) => setItems((prev) => prev.filter((i) => i !== item));
  const add = () => {
    const options = ['Music queue', 'Calendar sync', 'Weekly review', 'Agent report'];
    const next = options.find((o) => !items.includes(o));
    if (next) {
      setItems((prev) => [...prev, next]);
    }
  };

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        AnimatePresence — add / remove
      </div>
      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <button
          type='button'
          onClick={add}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 36, marginBottom: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                background: 'var(--surface-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--text-primary)',
                cursor: 'default',
              }}
            >
              {item}
              <button
                type='button'
                onClick={() => remove(item)}
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Gesture demos ──────────────────────────────────────────────────────────
const GestureDemo = () => (
  <div>
    <div
      style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}
    >
      Gestures — hover, tap, drag
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Hover + tap button */}
      <motion.button
        whileHover={{ scale: 1.03, backgroundColor: 'var(--accent-hover)' }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          padding: '9px 18px',
          background: 'var(--accent)',
          color: 'var(--text-on-accent)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Send message
      </motion.button>

      {/* Ghost button */}
      <motion.button
        whileHover={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)' }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        style={{
          padding: '9px 18px',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Cancel
      </motion.button>

      {/* Draggable chip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <motion.div
          drag
          dragConstraints={{ left: -40, right: 40, top: -10, bottom: 10 }}
          dragElastic={0.2}
          whileDrag={{ scale: 1.05, boxShadow: '0 8px 24px oklch(0.160 0.010 285 / 0.12)' }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            padding: '6px 12px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          ♫ Linkin Park · drag me
        </motion.div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>constrained drag with elastic</div>
      </div>
    </div>
  </div>
);

// ─── Layout animation — reorder ─────────────────────────────────────────────
const INITIAL_ITEMS = [
  { id: 'a', label: 'Processing message', done: true },
  { id: 'b', label: 'Assembling context', done: true },
  { id: 'c', label: 'Calling Claude', done: false },
  { id: 'd', label: 'Processing response', done: false },
];

const LayoutDemo = () => {
  const [items, setItems] = useState(INITIAL_ITEMS);

  const toggle = (id: string) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
      return [...updated.filter((i) => !i.done), ...updated.filter((i) => i.done)];
    });
  };

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        Layout animations — click to complete
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: item.done ? 'transparent' : 'var(--surface-card)',
                border: '1px solid',
                borderColor: item.done ? 'var(--border-subtle)' : 'var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                cursor: 'pointer',
                textDecoration: item.done ? 'line-through' : 'none',
              }}
            >
              <motion.span animate={{ color: item.done ? 'var(--success)' : 'var(--border-strong)' }} style={{ fontSize: 14, flexShrink: 0 }}>
                {item.done ? '✓' : '○'}
              </motion.span>
              {item.label}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Stagger — list entering ─────────────────────────────────────────────────
const StaggerDemo = () => {
  const [visible, setVisible] = useState(false);
  const threads = ['Primary Assistant', 'Morning Digest', 'Dev planning', 'Kitchen lights', 'Music queue'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Stagger — list reveal
        </div>
        <button
          type='button'
          onClick={() => {
            setVisible(false);
            setTimeout(() => setVisible(true), 50);
          }}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Replay
        </button>
      </div>
      <motion.div
        initial={false}
        animate={visible ? 'show' : 'hidden'}
        variants={{ show: { transition: { staggerChildren: 0.06 } }, hidden: {} }}
        style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {threads.map((t) => (
          <motion.div
            key={t}
            variants={{
              hidden: { opacity: 0, x: -12 },
              show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
            }}
            style={{
              padding: '7px 12px',
              fontSize: 13,
              color: 'var(--text-secondary)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {t}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

// ─── Scroll-linked progress bar ──────────────────────────────────────────────
const ScrollProgress = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 20 });
  const width = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        Scroll-linked — springy progress bar
      </div>
      <div
        ref={containerRef}
        style={{
          height: 160,
          overflowY: 'scroll',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-card)',
        }}
      >
        {/* Progress bar inside the scrollable area header */}
        <div style={{ position: 'sticky', top: 0, height: 3, background: 'var(--border-subtle)', zIndex: 1 }}>
          <motion.div style={{ height: '100%', background: 'var(--accent)', width }} />
        </div>
        <div style={{ padding: '12px 16px' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              Message {i + 1} — scroll to see the springy progress bar above
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main section ────────────────────────────────────────────────────────────
export const MotionSection = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Motion</h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 14 }}>
      Built with Motion (Framer Motion v12) — this is what's actually achievable. Set your expectations here.
    </p>
    <p style={{ color: 'var(--text-tertiary)', marginBottom: 48, fontSize: 13 }}>
      Every demo below uses the real library. Spring physics, AnimatePresence, gesture recognition, layout animations, scroll-linked values.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <SpringExplorer />
        <GestureDemo />
        <ScrollProgress />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <PresenceDemo />
        <LayoutDemo />
        <StaggerDemo />
      </div>
    </div>
  </div>
);
