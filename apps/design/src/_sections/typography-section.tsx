import { useState } from 'react';

const FONTS = [
  { name: 'Figtree', stack: '"Figtree", system-ui, sans-serif', desc: 'Warm, rounded, friendly — current frontrunner' },
  { name: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif', desc: 'Clean, geometric, very UI-native' },
  { name: 'Manrope', stack: '"Manrope", system-ui, sans-serif', desc: 'Geometric humanist — maybe. Comma is debatable.' },
];

const Scale = ({ size, weight, label, sample }: { size: number; weight: number; label: string; sample: string }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ width: 120, flexShrink: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
        {size}px · {weight}
      </div>
    </div>
    <div style={{ fontSize: size, fontWeight: weight, color: 'var(--text-primary)', lineHeight: 1.3 }}>{sample}</div>
  </div>
);

export const TypographySection = () => {
  const [activeFont, setActiveFont] = useState(FONTS[0]!);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Typography</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
        Paired with JetBrains Mono for code and token names. Click a font to preview everything below.
      </p>

      {/* Font picker */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 48 }}>
        {FONTS.map((f) => (
          <button
            type='button'
            key={f.name}
            onClick={() => setActiveFont(f)}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: activeFont.name === f.name ? 'var(--accent)' : 'var(--border)',
              background: activeFont.name === f.name ? 'var(--accent-subtle)' : 'transparent',
              color: activeFont.name === f.name ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeFont.name === f.name ? 600 : 400,
              fontSize: 13,
              fontFamily: f.stack,
              cursor: 'pointer',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
            title={f.desc}
          >
            {f.name}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 40, marginTop: -32 }}>{activeFont.desc}</p>

      <div style={{ fontFamily: activeFont.stack }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }}>
          {/* Left: scale + weights */}
          <div>
            {/* Type scale */}
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              Type Scale
            </h2>

            <Scale size={32} weight={700} label='Display' sample='Good morning, Quinn.' />
            <Scale size={24} weight={700} label='Heading 1' sample='Primary Assistant' />
            <Scale size={18} weight={600} label='Heading 2' sample='Memory & Identity' />
            <Scale size={15} weight={600} label='Heading 3' sample='Recent threads' />
            <Scale size={14} weight={400} label='Body' sample='Sure — playing Lo-Fi Study Beats on the Living Room speaker.' />
            <Scale size={13} weight={400} label='Body Small' sample='Dim the kitchen lights to 40%' />
            <Scale size={12} weight={400} label='Caption' sample='Pipeline completed · 1.2s · 312 tokens' />
            <Scale size={11} weight={600} label='Label' sample='RECENTS · AGENTS · PROJECTS' />

            {/* Weights */}
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: 48,
                marginBottom: 4,
              }}
            >
              Weights
            </h2>
            {([400, 500, 600, 700] as const).map((w) => (
              <div
                key={w}
                style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div style={{ width: 120, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{w}</div>
                <div style={{ fontSize: 16, fontWeight: w, color: 'var(--text-primary)' }}>
                  {w === 400
                    ? 'Regular — body text, messages'
                    : w === 500
                      ? 'Medium — nav items, metadata'
                      : w === 600
                        ? 'Semibold — labels, subheadings'
                        : 'Bold — headings, agent name'}
                </div>
              </div>
            ))}

            {/* Mono */}
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: 48,
                marginBottom: 4,
              }}
            >
              Monospace — JetBrains Mono
            </h2>
            {[
              { label: 'Token name', sample: '--accent-subtle' },
              { label: 'File path', sample: '/context/world-state.md' },
              { label: 'Code inline', sample: 'ctx.sendToThread(threadId, prompt)' },
              { label: 'Timestamp', sample: '2026-03-05 · 07:14 MST' },
            ].map(({ label, sample }) => (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div style={{ width: 120, fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{sample}</div>
              </div>
            ))}
          </div>

          {/* Right: in-context examples */}
          <div>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 20,
              }}
            >
              In Context
            </h2>

            {/* Sidebar nav example */}
            <div
              style={{
                background: 'var(--surface-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                marginBottom: 24,
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Harness
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>Primary Assistant</div>
              </div>
              <div style={{ padding: '8px 0' }}>
                {['+ New chat', 'Projects', 'Agents'].map((item) => (
                  <div key={item} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {item}
                  </div>
                ))}
                <div
                  style={{
                    padding: '10px 14px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 4,
                  }}
                >
                  Recents
                </div>
                <div style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)' }}>
                  Primary Assistant
                </div>
                <div style={{ padding: '7px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>Morning Digest</div>
                <div style={{ padding: '5px 14px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>Yesterday · 3 messages</div>
              </div>
            </div>

            {/* Chat message example */}
            <div
              style={{
                background: 'var(--surface-page)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Primary Assistant
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                  Sure — playing <em>Lo-Fi Study Beats</em> on Living Room speaker.
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>Pipeline completed · 1.2s · 312 tokens</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      background: 'var(--accent-subtle)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      maxWidth: '80%',
                      lineHeight: 1.5,
                    }}
                  >
                    Dim the kitchen lights to 40%
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>Done — kitchen set to 40%.</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>07:14 MST · claude-haiku-4-5</div>
              </div>
            </div>

            {/* Pipeline status example */}
            <div
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Pipeline step</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {['Processing message', 'Assembling context', 'Calling Claude', 'Processing response'].map((s) => (
                  <div key={s} style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 4 }}>
                    ✓ {s}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '7px 12px',
                  background: 'var(--surface-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>›</span>
                <span>Read </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>/context/world-state.md</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
