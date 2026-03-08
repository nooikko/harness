const Swatch = ({
  label,
  token,
  description,
  textColor = 'var(--text-primary)',
}: {
  label: string;
  token: string;
  description: string;
  textColor?: string;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
    <div
      style={{
        width: 64,
        height: 40,
        borderRadius: 'var(--radius-md)',
        background: `var(${token})`,
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}
    />
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, color: textColor }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{token}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{description}</div>
    </div>
  </div>
);

export const SurfaceSection = () => (
  <div>
    <h1
      style={{
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 6,
      }}
    >
      Surfaces
    </h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: 14 }}>
      The five surface levels that create depth through separation, not shadow. Linear-style: dividers define hierarchy, not elevation.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
      {/* Swatches column */}
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
          Token Scale
        </h2>

        <Swatch token='--surface-page' label='Page' description='Chat area, main content — pure white' />
        <Swatch token='--surface-sidebar' label='Sidebar' description='Sidebar background, nav, thread list' />
        <Swatch token='--surface-card' label='Card' description='Cards on white — subtle lift above page' />
        <Swatch token='--surface-hover' label='Hover' description='Interactive hover states' />
        <Swatch token='--surface-active' label='Active' description='Selected / pressed states' />
        <Swatch token='--accent-subtle' label='Selected / Message' description='Active thread row, user message backgrounds' />
        <Swatch token='--accent' label='Action' description='Primary buttons, links, focus rings — filled accent surface' textColor='var(--accent)' />
        {/* On-accent shown against the accent bg so it's actually visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div
            style={{
              width: 64,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: 'var(--text-on-accent)',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Aa
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>On Accent</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>--text-on-accent</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Text/icons on top of --accent surfaces</div>
          </div>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
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
            Borders
          </h2>
          <Swatch token='--border-subtle' label='Subtle' description='Sidebar/content divider — lightest visible line' />
          <Swatch token='--border' label='Border' description='Card borders, input borders' />
          <Swatch token='--border-strong' label='Strong' description='Focused inputs, prominent dividers' />
        </div>
      </div>

      {/* Layout mock column */}
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

        {/* Mini Harness layout mock */}
        <div
          style={{
            height: 520,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              width: 180,
              background: 'var(--surface-sidebar)',
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 0',
              flexShrink: 0,
            }}
          >
            {/* Brand */}
            <div
              style={{
                padding: '0 14px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Harness
              </div>
            </div>

            {/* Nav items */}
            {['+ New chat', 'Projects', 'Agents'].map((item) => (
              <div
                key={item}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {item}
              </div>
            ))}

            <div
              style={{
                padding: '14px 14px 6px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 8,
              }}
            >
              Recents
            </div>

            {/* Active thread — uses hover state */}
            <div
              style={{
                padding: '7px 14px',
                fontSize: 13,
                color: 'var(--accent)',
                fontWeight: 600,
                background: 'var(--accent-subtle)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                width: 'calc(100% - 8px)',
                cursor: 'pointer',
              }}
            >
              Primary Assistant
            </div>

            {['Morning Digest', 'Dev planning'].map((t) => (
              <div
                key={t}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </div>
            ))}

            {/* Widget zone — bottom of sidebar */}
            <div style={{ flex: 1 }} />
            <div
              style={{
                margin: '0 8px 8px',
                padding: '10px 12px',
                background: 'var(--surface-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>♫ Now playing</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Linkin Park</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>In the End</div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                <span style={{ cursor: 'pointer' }}>⏮</span>
                <span style={{ cursor: 'pointer', color: 'var(--accent)' }}>⏸</span>
                <span style={{ cursor: 'pointer' }}>⏭</span>
              </div>
            </div>
          </div>

          {/* Main chat area */}
          <div
            style={{
              flex: 1,
              background: 'var(--surface-page)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Chat header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Primary Assistant
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Agent response — plain text, no avatar */}
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 16 }}>
                Sure — playing <em>Lo-Fi Study Beats</em> on Living Room speaker.
              </div>

              {/* Pipeline status — centered, muted */}
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Pipeline started</div>
              {['Processing message', 'Assembling context', 'Calling Claude', 'Processing response'].map((s) => (
                <div key={s} style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 1, paddingLeft: 8 }}>
                  ✓ {s}
                </div>
              ))}

              {/* Thinking block — collapsible row */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 12px',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  marginBottom: 4,
                  background: 'var(--surface-card)',
                  cursor: 'pointer',
                }}
              >
                <span>›</span> Thinking
              </div>

              {/* Tool call block */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 12px',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                  background: 'var(--surface-card)',
                  cursor: 'pointer',
                }}
              >
                <span>›</span> Read <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>/context/world-state.md</span>
              </div>

              {/* Pipeline complete */}
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                Pipeline completed · 1.2s · 312 tokens
              </div>

              {/* User message — plain text, right-aligned, subtle bg */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
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

              {/* Agent response + event card */}
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 10 }}>Done — kitchen set to 40%.</div>

              {/* Event card — inline, not persistent */}
              <div
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 16 }}>💡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>Kitchen</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>40% · warm white</div>
                </div>
                <div style={{ flex: 2, height: 3, background: 'var(--surface-active)', borderRadius: 2, position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '40%',
                      height: '100%',
                      background: 'var(--accent-muted)',
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 28 }}>40%</span>
              </div>
            </div>

            {/* Input */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 14px',
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  background: 'var(--surface-page)',
                }}
              >
                Send a message...
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                  }}
                >
                  System ▾
                </span>
                <span
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                  }}
                >
                  Haiku ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>↑ Realistic Harness layout — all surfaces labeled above</p>
      </div>
    </div>

    {/* Semantic colors in context */}
    <div style={{ marginTop: 64, paddingTop: 48, borderTop: '1px solid var(--border-subtle)' }}>
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
        Semantic Colors — In Context
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {/* Success */}
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
            Success
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--success)',
                background: 'oklch(from var(--success) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ● Completed
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--success)',
                background: 'oklch(from var(--success) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ✓ Online
            </span>
          </div>

          {/* Inline chat confirmation */}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>
            Done — kitchen lights set to 40%.
            <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 12 }}>✓</span>
          </div>

          {/* Alert bar */}
          <div
            style={{
              background: 'oklch(from var(--success) l c h / 0.10)',
              border: '1px solid oklch(from var(--success) l c h / 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--success)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span>✓</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Delegation complete</div>
              <div style={{ color: 'var(--text-secondary)' }}>Sub-agent finished in 4.2s · 1,240 tokens</div>
            </div>
          </div>
        </div>

        {/* Warning */}
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
            Warning
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--warning)',
                background: 'oklch(from var(--warning) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ● Pending
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--warning)',
                background: 'oklch(from var(--warning) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ⚠ Slow
            </span>
          </div>

          {/* Inline */}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>
            Response took longer than expected.
            <span style={{ color: 'var(--warning)', marginLeft: 6, fontSize: 12 }}>12.4s</span>
          </div>

          {/* Alert bar */}
          <div
            style={{
              background: 'oklch(from var(--warning) l c h / 0.10)',
              border: '1px solid oklch(from var(--warning) l c h / 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--warning)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span>⚠</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Context limit approaching</div>
              <div style={{ color: 'var(--text-secondary)' }}>Thread will be summarized after next message</div>
            </div>
          </div>
        </div>

        {/* Destructive */}
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
            Destructive
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--destructive)',
                background: 'oklch(from var(--destructive) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ● Failed
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--destructive)',
                background: 'oklch(from var(--destructive) l c h / 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ✕ Error
            </span>
          </div>

          {/* Inline */}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>
            Invocation failed after 3 retries.
            <span style={{ color: 'var(--destructive)', marginLeft: 6, fontSize: 12 }}>timeout</span>
          </div>

          {/* Alert bar */}
          <div
            style={{
              background: 'oklch(from var(--destructive) l c h / 0.10)',
              border: '1px solid oklch(from var(--destructive) l c h / 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--destructive)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span>✕</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Delegation failed</div>
              <div style={{ color: 'var(--text-secondary)' }}>Validator rejected output · max iterations reached</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
