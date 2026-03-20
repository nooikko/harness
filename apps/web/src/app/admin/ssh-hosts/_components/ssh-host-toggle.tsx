'use client';

import { Switch } from '@harness/ui';
import { useOptimistic, useTransition } from 'react';
import { toggleSshHost } from '../_actions/toggle-ssh-host';

type SshHostToggleProps = {
  id: string;
  enabled: boolean;
};

type SshHostToggleComponent = (props: SshHostToggleProps) => React.ReactNode;

export const SshHostToggle: SshHostToggleComponent = ({ id, enabled }) => {
  const [, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticEnabled(!optimisticEnabled);
      await toggleSshHost(id);
    });
  };

  return <Switch checked={optimisticEnabled} onCheckedChange={handleToggle} aria-label='Toggle enabled' />;
};
