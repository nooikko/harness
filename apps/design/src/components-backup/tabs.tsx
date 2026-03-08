import { motion } from 'motion/react';
import * as React from 'react';

type TabsProps = {
  tabs: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  defaultTab?: string;
  style?: React.CSSProperties;
};

const Tabs = ({ tabs, activeTab: controlledTab, onTabChange, defaultTab, style }: TabsProps) => {
  const [internalTab, setInternalTab] = React.useState(defaultTab ?? tabs[0] ?? '');
  const active = controlledTab ?? internalTab;
  const handleChange = onTabChange ?? setInternalTab;

  return (
    <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--border-subtle)', ...style }}>
      {tabs.map((tab) => (
        <motion.button
          key={tab}
          type='button'
          onClick={() => handleChange(tab)}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'relative',
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            fontSize: 13,
            fontWeight: active === tab ? 600 : 400,
            color: active === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'color 0.12s',
          }}
        >
          {tab}
          {active === tab && (
            <motion.div
              layoutId='tab-indicator'
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--accent)',
                borderRadius: 'var(--radius-pill)',
              }}
            />
          )}
        </motion.button>
      ))}
    </div>
  );
};

export { Tabs };
