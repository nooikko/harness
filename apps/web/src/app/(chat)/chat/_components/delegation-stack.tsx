'use client';

import { useCallback, useState } from 'react';
import { useDelegationTasks } from '../_helpers/use-delegation-tasks';
import { DelegationCard } from './delegation-card';

type DelegationStackProps = {
  parentThreadId: string;
};

type DelegationStackComponent = (props: DelegationStackProps) => React.ReactNode;

export const DelegationStack: DelegationStackComponent = ({ parentThreadId }) => {
  const tasks = useDelegationTasks(parentThreadId);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const handleDismiss = useCallback((taskId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, []);

  const visible = tasks.filter((t) => !dismissed.has(t.taskId)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-col gap-2'>
      {visible.map((task) => (
        <DelegationCard key={task.taskId} task={task} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
