'use client';

import { Switch } from '@harness/ui';
import { useOptimistic, useTransition } from 'react';
import { toggleCronJob } from '../_actions/toggle-cron-job';

type CronJobToggleProps = {
  id: string;
  enabled: boolean;
};

type CronJobToggleComponent = (props: CronJobToggleProps) => React.ReactNode;

export const CronJobToggle: CronJobToggleComponent = ({ id, enabled }) => {
  const [, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticEnabled(!optimisticEnabled);
      await toggleCronJob(id);
    });
  };

  return <Switch checked={optimisticEnabled} onCheckedChange={handleToggle} aria-label='Toggle enabled' />;
};
