const Row = ({ token, label, desc }: { token: string; label: string; desc: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-md)',
        background: `var(${token})`,
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}
    />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{token}</div>
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260, textAlign: 'right' }}>{desc}</div>
  </div>
);

export const ColorSection = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Colors</h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: 14 }}>
      Full token palette. Soft purple direction — not neon, not corporate. OKLCH hue 285 throughout for perceptual consistency.
    </p>

    <div style={{ marginBottom: 40 }}>
      <h2
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        Surfaces
      </h2>
      <Row token='--surface-page' label='Page' desc='Chat area, main content — pure white' />
      <Row token='--surface-sidebar' label='Sidebar' desc='Sidebar background, nav, thread list' />
      <Row token='--surface-card' label='Card' desc='Cards, thinking blocks, tool call rows' />
      <Row token='--surface-hover' label='Hover' desc='Interactive hover states' />
      <Row token='--surface-active' label='Active' desc='Selected / pressed states' />
    </div>

    <div style={{ marginBottom: 40 }}>
      <h2
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        Borders
      </h2>
      <Row token='--border-subtle' label='Subtle' desc='Sidebar/content divider — lightest visible line' />
      <Row token='--border' label='Border' desc='Card borders, input borders' />
      <Row token='--border-strong' label='Strong' desc='Focused inputs, prominent dividers' />
    </div>

    <div style={{ marginBottom: 40 }}>
      <h2
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        Accent
      </h2>
      <Row token='--accent' label='Accent' desc='Primary action color — buttons, links, focus rings' />
      <Row token='--accent-hover' label='Accent Hover' desc='Darkened on hover/pressed' />
      <Row token='--accent-subtle' label='Accent Subtle' desc='Selected row bg, user message backgrounds — very washed' />
      <Row token='--accent-muted' label='Accent Muted' desc='Secondary badges, soft indicators' />
    </div>

    <div style={{ marginBottom: 40 }}>
      <h2
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        Text
      </h2>
      <Row token='--text-primary' label='Primary' desc='Main body text, headings' />
      <Row token='--text-secondary' label='Secondary' desc='Labels, metadata, muted content' />
      <Row token='--text-tertiary' label='Tertiary' desc='Timestamps, placeholders, very faint' />
      <Row token='--text-on-accent' label='On Accent' desc='Text and icons on top of --accent surfaces' />
    </div>

    <div>
      <h2
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        Semantic
      </h2>
      <Row token='--success' label='Success' desc='Confirmations, completed states' />
      <Row token='--warning' label='Warning' desc='Cautions, pending states' />
      <Row token='--destructive' label='Destructive' desc='Errors, delete actions' />
    </div>
  </div>
);
