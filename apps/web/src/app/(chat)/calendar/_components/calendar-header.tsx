'use client';

import type { CalendarEventSource } from '@harness/database';
import { SOURCE_STYLES } from '../_helpers/source-style-map';

type CalendarHeaderProps = {
  activeSources: CalendarEventSource[];
  onToggleSource: (source: CalendarEventSource) => void;
};

type CalendarHeaderComponent = (props: CalendarHeaderProps) => React.ReactNode;

const ALL_SOURCES: CalendarEventSource[] = ['OUTLOOK', 'LOCAL', 'MEMORY', 'TASK', 'CRON'];

const CalendarHeader: CalendarHeaderComponent = ({ activeSources, onToggleSource }) => {
  return (
    <div className='flex items-center gap-2 px-4 py-2 border-b border-border/40'>
      <span className='text-xs text-muted-foreground mr-1'>Sources:</span>
      {ALL_SOURCES.map((source) => {
        const style = SOURCE_STYLES[source]!;
        const active = activeSources.includes(source);
        const Icon = style.icon;
        return (
          <button
            key={source}
            type='button'
            onClick={() => onToggleSource(source)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
              active ? 'bg-accent text-accent-foreground' : 'bg-transparent text-muted-foreground/50 hover:text-muted-foreground'
            }`}
          >
            <span className='inline-block h-2 w-2 rounded-full' style={{ backgroundColor: active ? style.color : 'currentColor' }} />
            <Icon className='h-3 w-3' />
            <span>{style.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export { CalendarHeader };
