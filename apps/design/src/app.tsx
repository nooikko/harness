import { GooeyToaster } from 'goey-toast';
import 'goey-toast/styles.css';
import { useState } from 'react';
import { BlocksSection } from './_sections/blocks-section';
import { ColorSection } from './_sections/color-section';
import { ComponentSection } from './_sections/component-section';
import { MotionSection } from './_sections/motion-section';
import { SurfaceSection } from './_sections/surface-section';
import { TypographySection } from './_sections/typography-section';

type Section = 'surfaces' | 'colors' | 'typography' | 'motion' | 'components' | 'blocks';

const SECTIONS: Section[] = ['surfaces', 'colors', 'typography', 'motion', 'components', 'blocks'];

export const App = () => {
  const [active, setActive] = useState<Section>(() => {
    const hash = location.hash.slice(1) as Section;
    return SECTIONS.includes(hash) ? hash : 'surfaces';
  });

  const navigate = (s: Section) => {
    setActive(s);
    location.hash = s;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Design system nav */}
      <nav
        style={{
          width: 200,
          flexShrink: 0,
          background: 'var(--surface-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
        }}
      >
        <div
          style={{
            padding: '0 16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            Harness
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginTop: 2,
            }}
          >
            Design System
          </div>
        </div>

        {SECTIONS.map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => navigate(s)}
            style={{
              display: 'block',
              width: 'calc(100% - 8px)',
              textAlign: 'left',
              padding: '8px 16px',
              background: active === s ? 'var(--accent-subtle)' : 'transparent',
              color: active === s ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: active === s ? 600 : 400,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
              borderRadius: '0 var(--radius-md) var(--radius-md) 0',
              textTransform: 'capitalize',
              fontFamily: 'inherit',
            }}
          >
            {s}
          </button>
        ))}
      </nav>

      <GooeyToaster position='bottom-center' preset='bouncy' />

      {/* Content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--surface-page)',
          padding: 40,
        }}
      >
        {active === 'surfaces' && <SurfaceSection />}
        {active === 'colors' && <ColorSection />}
        {active === 'typography' && <TypographySection />}
        {active === 'motion' && <MotionSection />}
        {active === 'components' && <ComponentSection />}
        {active === 'blocks' && <BlocksSection />}
      </main>
    </div>
  );
};
