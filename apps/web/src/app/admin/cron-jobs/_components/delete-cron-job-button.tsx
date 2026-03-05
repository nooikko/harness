'use client';

import { Button } from '@harness/ui';
import { useTransition } from 'react';
import { deleteCronJob } from '../_actions/delete-cron-job';

type DeleteCronJobButtonProps = {
  id: string;
  name: string;
};

type DeleteCronJobButtonComponent = (props: DeleteCronJobButtonProps) => React.ReactNode;

export const DeleteCronJobButton: DeleteCronJobButtonComponent = ({ id, name }) => {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const confirmed = window.confirm(`Are you sure you want to delete "${name}"?`);
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await deleteCronJob(id);
    });
  };

  return (
    <Button variant='ghost' size='sm' className='text-destructive hover:text-destructive' onClick={handleClick} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
};
