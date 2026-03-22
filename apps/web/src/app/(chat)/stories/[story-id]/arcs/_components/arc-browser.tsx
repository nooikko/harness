'use client';

import { Badge, Card, cn, ScrollArea } from '@harness/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { listStoryArcs } from '../../_actions/list-story-arcs';

type Arc = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  importance: number;
  annotation: string | null;
  momentCount: number;
};

type ArcBrowserProps = {
  storyId: string;
};

const STATUS_COLORS: Record<string, string> = {
  building: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  climaxed: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  dormant: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

type ArcCardProps = {
  arc: Arc;
};

const ArcCard = ({ arc }: ArcCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className='flex flex-col gap-0 overflow-hidden'>
      <button
        type='button'
        className='flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors'
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
        ) : (
          <ChevronRight className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
        )}

        <div className='flex flex-1 flex-col gap-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium'>{arc.name}</span>
            <Badge variant='secondary' className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[arc.status] ?? '')}>
              {arc.status}
            </Badge>
            <span className='text-[10px] text-muted-foreground'>{arc.momentCount} moments</span>
          </div>
          {arc.description && <p className='text-xs text-muted-foreground truncate'>{arc.description}</p>}
        </div>
      </button>

      {expanded && (
        <div className='flex flex-col gap-2 border-t px-4 py-3 bg-muted/30'>
          {arc.description && <p className='text-sm text-muted-foreground'>{arc.description}</p>}
          {arc.annotation && (
            <div className='flex flex-col gap-1'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Why This Matters</span>
              <p className='text-sm text-violet-600 dark:text-violet-400'>{arc.annotation}</p>
            </div>
          )}
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <span>Importance: {arc.importance}/10</span>
            <span>|</span>
            <span>
              {arc.momentCount} linked moment{arc.momentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

export const ArcBrowser = ({ storyId }: ArcBrowserProps) => {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [isPending, startTransition] = useTransition();

  const loadArcs = useCallback(() => {
    startTransition(async () => {
      const result = await listStoryArcs(storyId);
      setArcs(result);
    });
  }, [storyId]);

  useEffect(() => {
    loadArcs();
  }, [loadArcs]);

  const grouped = {
    building: arcs.filter((a) => a.status === 'building'),
    climaxed: arcs.filter((a) => a.status === 'climaxed'),
    resolved: arcs.filter((a) => a.status === 'resolved'),
    dormant: arcs.filter((a) => a.status === 'dormant'),
  };

  return (
    <ScrollArea className='h-[calc(100vh-12rem)]'>
      <div className='flex flex-col gap-6 pr-4'>
        {isPending && arcs.length === 0 && <div className='text-sm text-muted-foreground py-8 text-center'>Loading arcs...</div>}
        {!isPending && arcs.length === 0 && (
          <div className='text-sm text-muted-foreground py-8 text-center'>
            No story arcs yet. Create arcs in a story thread using the create_arc tool.
          </div>
        )}

        {Object.entries(grouped).map(([status, statusArcs]) =>
          statusArcs.length > 0 ? (
            <div key={status} className='flex flex-col gap-2'>
              <h2 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{status}</h2>
              {statusArcs.map((arc) => (
                <ArcCard key={arc.id} arc={arc} />
              ))}
            </div>
          ) : null,
        )}
      </div>
    </ScrollArea>
  );
};
