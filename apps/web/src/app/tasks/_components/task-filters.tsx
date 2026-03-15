'use client';

import { Button } from '@harness/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const STATUSES = [
  { label: 'All', value: '' },
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
] as const;

type TaskFiltersComponent = () => React.ReactNode;

export const TaskFilters: TaskFiltersComponent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') ?? '';

  const handleStatusChange: (status: string) => void = useCallback(
    (status) => {
      const params = new URLSearchParams(searchParams.toString());
      if (status) {
        params.set('status', status);
      } else {
        params.delete('status');
      }
      router.push(`/tasks?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className='flex gap-1 rounded-lg border border-border bg-muted/30 p-1'>
      {STATUSES.map(({ label, value }) => (
        <Button
          key={value}
          variant={currentStatus === value ? 'secondary' : 'ghost'}
          size='sm'
          className='h-7 px-3 text-xs'
          onClick={() => handleStatusChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
};
