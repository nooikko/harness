'use client';

import { Badge, Button, Card, cn, Input, ScrollArea, Textarea } from '@harness/ui';
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { listStoryMoments } from '../../_actions/list-story-moments';
import { updateStoryMoment } from '../../_actions/update-story-moment';

type Moment = {
  id: string;
  summary: string;
  description: string | null;
  storyTime: string | null;
  kind: string;
  importance: number;
  annotation: string | null;
  sourceNotes: string | null;
  createdAt: string;
  location: { name: string } | null;
  characters: {
    characterName: string;
    role: string;
    perspective: string | null;
    emotionalImpact: string | null;
    relationshipContext: string | null;
  }[];
  arcs: string[];
};

type MomentBrowserProps = {
  storyId: string;
};

const KIND_COLORS: Record<string, string> = {
  dialogue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  action: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  revelation: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  bonding: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  confrontation: 'bg-red-500/10 text-red-600 dark:text-red-400',
  intimate: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  breakthrough: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  comedic: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  routine: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  decision: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
};

const IMPORTANCE_BAR_COLORS = [
  '', // 0
  'bg-gray-300', // 1
  'bg-gray-400', // 2
  'bg-blue-400', // 3
  'bg-blue-500', // 4
  'bg-emerald-500', // 5
  'bg-amber-500', // 6
  'bg-orange-500', // 7
  'bg-red-400', // 8
  'bg-red-500', // 9
  'bg-purple-500', // 10
];

type MomentCardProps = {
  moment: Moment;
  onAnnotationSave: (momentId: string, annotation: string) => void;
};

const MomentCard = ({ moment, onAnnotationSave }: MomentCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [annotationDraft, setAnnotationDraft] = useState(moment.annotation ?? '');

  return (
    <Card className='flex flex-col gap-0 overflow-hidden'>
      {/* Header row */}
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

        {/* Importance bar */}
        <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', IMPORTANCE_BAR_COLORS[moment.importance] ?? 'bg-gray-300')} />

        <div className='flex flex-1 flex-col gap-1 min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            {moment.storyTime && <span className='text-xs font-medium text-muted-foreground shrink-0'>{moment.storyTime}</span>}
            <span className='text-sm font-medium'>{moment.summary}</span>
          </div>

          <div className='flex items-center gap-1.5 flex-wrap'>
            <Badge variant='secondary' className={cn('text-[10px] px-1.5 py-0', KIND_COLORS[moment.kind] ?? '')}>
              {moment.kind}
            </Badge>
            {moment.location && (
              <Badge variant='outline' className='text-[10px] px-1.5 py-0'>
                {moment.location.name}
              </Badge>
            )}
            {moment.characters.slice(0, 5).map((c) => (
              <Badge key={c.characterName} variant='outline' className='text-[10px] px-1.5 py-0'>
                {c.characterName}
              </Badge>
            ))}
            {moment.characters.length > 5 && <span className='text-[10px] text-muted-foreground'>+{moment.characters.length - 5} more</span>}
            {moment.arcs.map((arc) => (
              <Badge key={arc} className='text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 dark:text-violet-400'>
                {arc}
              </Badge>
            ))}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className='flex flex-col gap-3 border-t px-4 py-3 bg-muted/30'>
          {moment.description && <p className='text-sm text-muted-foreground'>{moment.description}</p>}

          {/* Character perspectives */}
          {moment.characters.length > 0 && (
            <div className='flex flex-col gap-2'>
              <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Characters</span>
              {moment.characters.map((c) => (
                <div key={c.characterName} className='flex flex-col gap-0.5 pl-3 border-l-2 border-muted'>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs font-medium'>{c.characterName}</span>
                    <span className='text-[10px] text-muted-foreground italic'>{c.role}</span>
                  </div>
                  {c.perspective && <p className='text-xs text-muted-foreground'>{c.perspective}</p>}
                  {c.emotionalImpact && <p className='text-xs text-muted-foreground/80 italic'>{c.emotionalImpact}</p>}
                  {c.relationshipContext && <p className='text-xs text-violet-600 dark:text-violet-400'>{c.relationshipContext}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Annotation */}
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Your Notes</span>
            <Textarea
              value={annotationDraft}
              onChange={(e) => setAnnotationDraft(e.target.value)}
              onBlur={() => {
                if (annotationDraft !== (moment.annotation ?? '')) {
                  onAnnotationSave(moment.id, annotationDraft);
                }
              }}
              rows={2}
              className='text-xs'
              placeholder='Add notes about this moment...'
            />
          </div>

          {/* Metadata */}
          {moment.sourceNotes && <p className='text-[10px] text-muted-foreground/60'>{moment.sourceNotes}</p>}
        </div>
      )}
    </Card>
  );
};

export const MomentBrowser = ({ storyId }: MomentBrowserProps) => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [characterFilter, setCharacterFilter] = useState('');
  const [characterPairFilter, setCharacterPairFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadMoments = useCallback(() => {
    startTransition(async () => {
      const result = await listStoryMoments({
        storyId,
        search: search || undefined,
        characterName: characterFilter || undefined,
        limit: 200,
      });

      // Client-side pair filter (both characters must be present)
      let filtered = result.moments;
      if (characterPairFilter.trim()) {
        const pairName = characterPairFilter.trim().toLowerCase();
        filtered = filtered.filter((m) => m.characters.some((c) => c.characterName.toLowerCase().includes(pairName)));
      }

      setMoments(filtered);
      setTotal(result.total);
    });
  }, [storyId, search, characterFilter, characterPairFilter]);

  useEffect(() => {
    loadMoments();
  }, [loadMoments]);

  const handleAnnotationSave = useCallback((momentId: string, annotation: string) => {
    startTransition(async () => {
      await updateStoryMoment({ momentId, annotation: annotation || null });
    });
  }, []);

  return (
    <div className='flex flex-col gap-4'>
      {/* Search + filters */}
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search moments...' className='pl-9 text-sm' />
        </div>
        <Button variant='outline' size='sm' onClick={() => setShowFilters(!showFilters)} className={cn(showFilters && 'bg-muted')}>
          <Filter className='h-4 w-4 mr-1' />
          Filters
        </Button>
        <span className='text-xs text-muted-foreground shrink-0'>
          {total} moment{total !== 1 ? 's' : ''}
        </span>
      </div>

      {showFilters && (
        <div className='flex items-center gap-2'>
          <Input
            value={characterFilter}
            onChange={(e) => setCharacterFilter(e.target.value)}
            placeholder='Filter by character...'
            className='text-sm max-w-xs'
          />
          <Input
            value={characterPairFilter}
            onChange={(e) => setCharacterPairFilter(e.target.value)}
            placeholder='+ second character (pair filter)...'
            className='text-sm max-w-xs'
          />
        </div>
      )}

      {/* Moment list */}
      <ScrollArea className='h-[calc(100vh-16rem)]'>
        <div className='flex flex-col gap-2 pr-4'>
          {isPending && moments.length === 0 && <div className='text-sm text-muted-foreground py-8 text-center'>Loading moments...</div>}
          {!isPending && moments.length === 0 && (
            <div className='text-sm text-muted-foreground py-8 text-center'>
              No moments found.{search || characterFilter ? ' Try adjusting your filters.' : ''}
            </div>
          )}
          {moments.map((moment) => (
            <MomentCard key={moment.id} moment={moment} onAnnotationSave={handleAnnotationSave} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
