import { cn, Tabs, TabsList, TabsTrigger } from '@harness/ui';
import { CalendarRange, Columns, Grid2X2, Grid3X3, List } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo } from 'react';
import type { TCalendarView } from '../_helpers/types';
import { useCalendar } from './calendar-context';

const tabs = [
  {
    name: 'Agenda',
    value: 'agenda',
    icon: () => <CalendarRange className='h-4 w-4' />,
  },
  {
    name: 'Day',
    value: 'day',
    icon: () => <List className='h-4 w-4' />,
  },
  {
    name: 'Week',
    value: 'week',
    icon: () => <Columns className='h-4 w-4' />,
  },
  {
    name: 'Month',
    value: 'month',
    icon: () => <Grid3X3 className='h-4 w-4' />,
  },
  {
    name: 'Year',
    value: 'year',
    icon: () => <Grid2X2 className='h-4 w-4' />,
  },
];

type ViewsComponent = () => React.ReactNode;

const Views: ViewsComponent = () => {
  const { view, setView } = useCalendar();

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as TCalendarView)} className='gap-4 sm:w-auto w-full'>
      <TabsList className='h-auto gap-2 rounded-xl p-1 w-full' style={{ borderBottom: 'none' }}>
        {tabs.map(({ icon: Icon, name, value }) => {
          const isActive = view === value;

          return (
            <motion.div
              key={value}
              layout
              className={cn('flex h-8 items-center justify-center overflow-hidden rounded-md', isActive ? 'flex-1' : 'flex-none')}
              onClick={() => setView(value as TCalendarView)}
              initial={false}
              animate={{
                width: isActive ? 120 : 32,
              }}
              transition={{
                type: 'tween',
                stiffness: 400,
                damping: 25,
              }}
            >
              <TabsTrigger
                value={value}
                aria-label={name}
                className='flex h-8 w-full items-center justify-center cursor-pointer'
                style={{ color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', background: 'none', border: 'none', padding: 0 }}
              >
                <Icon />
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      className='font-medium'
                      initial={{ opacity: 0, scaleX: 0.8 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{ originX: 0 }}
                    >
                      {name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </TabsTrigger>
            </motion.div>
          );
        })}
      </TabsList>
    </Tabs>
  );
};

export default memo(Views);
