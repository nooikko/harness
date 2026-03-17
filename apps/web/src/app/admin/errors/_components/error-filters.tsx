'use client';

// Client component — filter controls for error log list (level + source)

import { Badge, Button } from '@harness/ui';
import { useRouter, useSearchParams } from 'next/navigation';

type ErrorFiltersProps = {
  sources: string[];
};

type ErrorFiltersComponent = (props: ErrorFiltersProps) => React.ReactNode;

const LEVELS = ['all', 'error', 'warn'] as const;

type LevelOption = (typeof LEVELS)[number];

type LevelLabel = Record<LevelOption, string>;

const LEVEL_LABELS: LevelLabel = {
  all: 'All',
  error: 'Error',
  warn: 'Warn',
};

export const ErrorFilters: ErrorFiltersComponent = ({ sources }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLevel = searchParams.get('level') ?? 'all';
  const currentSource = searchParams.get('source') ?? 'all';

  type UpdateFilter = (key: string, value: string) => void;

  const updateFilter: UpdateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '/admin/errors');
  };

  return (
    <div className='flex flex-wrap items-center gap-3'>
      <div className='flex items-center gap-1.5'>
        <span className='text-xs text-muted-foreground'>Level:</span>
        {LEVELS.map((level) => (
          <Button
            key={level}
            variant={currentLevel === level ? 'default' : 'outline'}
            size='sm'
            className='h-7 px-2.5 text-xs'
            onClick={() => updateFilter('level', level)}
          >
            {LEVEL_LABELS[level]}
          </Button>
        ))}
      </div>

      <div className='flex items-center gap-1.5'>
        <span className='text-xs text-muted-foreground'>Source:</span>
        <select
          value={currentSource}
          onChange={(e) => updateFilter('source', e.target.value)}
          className='h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'
        >
          <option value='all'>All sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      {(currentLevel !== 'all' || currentSource !== 'all') && (
        <Button variant='ghost' size='sm' className='h-7 px-2 text-xs text-muted-foreground' onClick={() => router.push('/admin/errors')}>
          Clear filters
        </Button>
      )}

      {(currentLevel !== 'all' || currentSource !== 'all') && (
        <Badge variant='neutral' className='text-[10px]'>
          Filtered
        </Badge>
      )}
    </div>
  );
};
