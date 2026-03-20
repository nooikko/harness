import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { Badge, Progress } from 'ui';

// ─── Music Widget ─────────────────────────────────────────────────────────────

const MusicWidgetContent = () => {
  const [playing, setPlaying] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('widget:music:playing') ?? 'true') as boolean;
    } catch {
      return true;
    }
  });
  const [progress, setProgress] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('widget:music:progress') ?? '35') as number;
    } catch {
      return 35;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('widget:music:playing', JSON.stringify(playing));
    } catch {}
  }, [playing]);

  React.useEffect(() => {
    try {
      localStorage.setItem('widget:music:progress', JSON.stringify(progress));
    } catch {}
  }, [progress]);

  return (
    <div>
      {/* Track info */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, oklch(0.45 0.15 285), oklch(0.30 0.08 285))',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          🎵
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Lo-Fi Study Beats
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Living Room · Cast</div>
        </div>
      </div>

      {/* Scrubber — clickable, so Progress doesn't fit; keep custom */}
      <div style={{ marginBottom: 4 }}>
        <button
          type='button'
          style={{
            height: 3,
            background: 'var(--border)',
            borderRadius: 2,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            border: 'none',
            padding: 0,
            display: 'block',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setProgress(Math.round(((e.clientX - rect.left) / rect.width) * 100));
          }}
        >
          <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, borderRadius: 2, transition: 'width 0.1s' }} />
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span>
            {(() => {
              const s = Math.floor((progress / 100) * 242);
              return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
            })()}
          </span>
          <span>4:02</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 8 }}>
        {[
          { icon: '⏮', size: 14, key: 'prev' },
          { icon: playing ? '⏸' : '▶', size: 22, key: 'play' },
          { icon: '⏭', size: 14, key: 'next' },
        ].map(({ icon, size, key }) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => key === 'play' && setPlaying((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: size,
              color: key === 'play' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              padding: 4,
              lineHeight: 1,
            }}
          >
            {icon}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ─── Timer Widget ─────────────────────────────────────────────────────────────

const TimerWidgetContent = () => {
  const [remaining, setRemaining] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('widget:timer:remaining') ?? '1500') as number;
    } catch {
      return 1500;
    }
  });
  const [running, setRunning] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const total = 1500;

  React.useEffect(() => {
    try {
      localStorage.setItem('widget:timer:remaining', JSON.stringify(remaining));
    } catch {}
  }, [remaining]);

  React.useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running]);

  const mins = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const elapsed = total - remaining;
  const done = remaining === 0;

  return (
    <div>
      {/* Time info */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 600,
              color: done ? 'var(--success)' : 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {mins}:{secs}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{done ? 'Complete' : running ? 'Running' : 'Paused'}</div>
        </div>
      </div>

      {/* Scrubber — non-interactive, Progress fits perfectly */}
      <div style={{ marginBottom: 6 }}>
        <Progress value={elapsed / total} showPercent={false} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span>
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
          </span>
          <span>25:00</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 2 }}>
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            if (!done) {
              setRunning((v) => !v);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: done ? 'default' : 'pointer',
            fontSize: 22,
            color: 'var(--text-primary)',
            padding: 4,
            lineHeight: 1,
          }}
        >
          {done ? '⏹' : running ? '⏸' : '▶'}
        </motion.button>
      </div>
    </div>
  );
};

// ─── Smart Stack shell ────────────────────────────────────────────────────────

type Widget = { id: string; icon: string; label: string; plugin: string; live?: boolean };

type SmartStackProps = {
  widgets?: Widget[];
  contents?: React.ReactNode[];
};

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'music', icon: '♫', label: 'Now Playing', plugin: 'music', live: true },
  { id: 'timer', icon: '◷', label: 'Timer', plugin: 'time' },
];

const DEFAULT_CONTENTS = [<MusicWidgetContent key='music' />, <TimerWidgetContent key='timer' />];

const SmartStack = ({ widgets = DEFAULT_WIDGETS, contents = DEFAULT_CONTENTS }: SmartStackProps) => {
  const [current, setCurrent] = React.useState(0);
  const [direction, setDirection] = React.useState(1);

  const goTo = (idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  };

  const widget = widgets[current]!;

  return (
    <div
      style={{
        width: 288,
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px oklch(0.160 0.010 285 / 0.06)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AnimatePresence mode='wait'>
            <motion.span
              key={`${widget.id}-icon`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 13, lineHeight: 1 }}
            >
              {widget.icon}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode='wait'>
            <motion.span
              key={`${widget.id}-label`}
              initial={{ opacity: 0, x: direction * 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -8 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {widget.label}
            </motion.span>
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {widget.live && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <motion.div
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>live</span>
            </div>
          )}
          <Badge variant='neutral' className='px-1.5 py-px text-[10px]'>
            {widget.plugin}
          </Badge>
        </div>
      </div>

      {/* Content — both widgets stay mounted to preserve state */}
      <div style={{ overflow: 'hidden', position: 'relative', height: 130 }}>
        {contents.map((content, idx) => (
          <motion.div
            key={idx}
            animate={{ x: `${(idx - current) * 100}%`, opacity: idx === current ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'absolute',
              inset: 0,
              padding: '10px 14px 8px',
              boxSizing: 'border-box',
              overflow: 'hidden',
              pointerEvents: idx === current ? 'auto' : 'none',
            }}
          >
            {content}
          </motion.div>
        ))}
      </div>

      {/* Navigation dots */}
      {widgets.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px 12px' }}>
          {widgets.map((w, i) => (
            <motion.button
              key={w.id}
              onClick={() => goTo(i)}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? 'var(--accent)' : 'var(--border-strong)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export type { Widget };
export { MusicWidgetContent, SmartStack, TimerWidgetContent };
