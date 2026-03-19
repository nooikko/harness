'use client';

import type { CalendarEventSource } from '@harness/database';
import { cn } from '@harness/ui';
import { format } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { getEventsCount, navigateDate } from '../_helpers/calendar-helpers';
import { SOURCE_STYLES } from '../_helpers/source-style-map';
import type { TCalendarView } from '../_helpers/types';
import { useCalendar } from './calendar-context';
import Views from './view-tabs';

type CalendarHeaderProps = {
  activeSources: CalendarEventSource[];
  onToggleSource: (source: CalendarEventSource) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

const ALL_SOURCES: CalendarEventSource[] = ['OUTLOOK', 'GOOGLE', 'LOCAL', 'TASK', 'CRON'];

type CalendarHeaderComponent = (props: CalendarHeaderProps) => React.ReactNode;

const CalendarHeader: CalendarHeaderComponent = ({ activeSources, onToggleSource, search, onSearchChange }) => {
  const { view, events, selectedDate, setSelectedDate } = useCalendar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const handlePrev = () => setSelectedDate(navigateDate(selectedDate, view as TCalendarView, 'previous'));
  const handleNext = () => setSelectedDate(navigateDate(selectedDate, view as TCalendarView, 'next'));
  const handleToday = () => setSelectedDate(new Date());

  const eventCount = getEventsCount(events, selectedDate, view as TCalendarView);
  const allActive = activeSources.length === ALL_SOURCES.length;
  const someActive = activeSources.length > 0 && activeSources.length < ALL_SOURCES.length;

  const closeSearch = () => {
    setSearchOpen(false);
    onSearchChange('');
  };

  return (
    <div className='relative z-30 flex items-center justify-between gap-3 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur-sm'>
      {/* LEFT: Today shortcut + date navigation */}
      <div className='flex items-center gap-2'>
        {/* Today button — mini date card */}
        <button
          type='button'
          onClick={handleToday}
          className='group flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border/50 bg-card transition-colors hover:bg-accent'
        >
          <span className='text-[9px] font-bold uppercase tracking-widest text-primary transition-colors' style={{ lineHeight: 1 }}>
            {format(new Date(), 'MMM')}
          </span>
          <span className='text-base font-bold leading-tight text-foreground'>{new Date().getDate()}</span>
        </button>

        {/* Prev + month/year label + Next */}
        <div className='flex items-center gap-0.5'>
          <button
            type='button'
            onClick={handlePrev}
            className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>

          <div className='flex min-w-32.5 items-center gap-2 px-1'>
            <AnimatePresence mode='wait'>
              <motion.span
                key={selectedDate.toISOString().slice(0, 7)}
                className='text-sm font-semibold text-foreground'
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.14 }}
              >
                {format(selectedDate, 'MMMM yyyy')}
              </motion.span>
            </AnimatePresence>

            {eventCount > 0 && (
              <span suppressHydrationWarning className='rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary'>
                {eventCount}
              </span>
            )}
          </div>

          <button
            type='button'
            onClick={handleNext}
            className='flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* RIGHT: View selector + source filter + search */}
      <div className='flex items-center gap-2'>
        {/* View tabs — reuse existing animated component */}
        <Views />

        <div className='h-5 w-px bg-border/60' />

        {/* Source filter */}
        <div className='relative'>
          <button
            type='button'
            onClick={() => setSourcesOpen((v) => !v)}
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors',
              someActive
                ? 'border-primary/40 bg-primary/8 text-primary hover:bg-primary/12'
                : 'border-border/50 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span className='flex items-center gap-0.5'>
              {ALL_SOURCES.map((s) => (
                <span
                  key={s}
                  className='inline-block h-1.5 w-1.5 rounded-full transition-opacity'
                  style={{
                    backgroundColor: SOURCE_STYLES[s]!.color,
                    opacity: activeSources.includes(s) ? 1 : 0.2,
                  }}
                />
              ))}
            </span>
            <span>{allActive ? 'All sources' : someActive ? `${activeSources.length} sources` : 'No sources'}</span>
          </button>

          <AnimatePresence>
            {sourcesOpen && (
              <>
                <button
                  type='button'
                  aria-label='Close sources menu'
                  className='fixed inset-0 z-40 cursor-default'
                  onClick={() => setSourcesOpen(false)}
                />
                <motion.div
                  className='absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl shadow-black/10'
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.13 }}
                >
                  <div className='p-1.5'>
                    {ALL_SOURCES.map((source) => {
                      const style = SOURCE_STYLES[source]!;
                      const active = activeSources.includes(source);
                      const Icon = style.icon;
                      return (
                        <button
                          key={source}
                          type='button'
                          onClick={() => onToggleSource(source)}
                          className='flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent'
                        >
                          <span
                            className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md'
                            style={{ backgroundColor: `${style.color}20` }}
                          >
                            <Icon className='h-3.5 w-3.5' style={{ color: style.color }} />
                          </span>
                          <span className='flex-1 text-left text-foreground'>{style.label}</span>
                          <span
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded transition-colors',
                              active ? 'bg-primary text-primary-foreground' : 'border border-border/70 bg-transparent',
                            )}
                          >
                            {active && <Check className='h-2.5 w-2.5' />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <AnimatePresence mode='wait' initial={false}>
          {searchOpen ? (
            <motion.div
              key='open'
              className='flex h-8 items-center gap-1.5 overflow-hidden rounded-lg border border-border/60 bg-card pl-2.5 pr-1'
              initial={{ width: 32, opacity: 0.5 }}
              animate={{ width: 190, opacity: 1 }}
              exit={{ width: 32, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              <Search className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
              <input
                ref={searchInputRef}
                type='text'
                placeholder='Search events…'
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className='h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50'
              />
              <button
                type='button'
                onClick={closeSearch}
                className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key='closed'
              type='button'
              onClick={() => setSearchOpen(true)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                search
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/50 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Search className='h-3.5 w-3.5' />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export { CalendarHeader };
