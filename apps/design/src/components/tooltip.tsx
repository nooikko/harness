import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from 'ui';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const Tooltip = ({ content, children, className }: TooltipProps) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: intentional hover wrapper for tooltip */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: intentional hover wrapper for tooltip */}
      <div className={cn('relative', className)} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
        {children}
        <AnimatePresence>
          {visible && (
            <div className='pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2'>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.1 }}
                className='whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] font-medium text-background'
              >
                {content}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export { Tooltip };
