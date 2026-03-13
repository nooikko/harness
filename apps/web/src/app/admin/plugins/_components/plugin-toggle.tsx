'use client';

import { Switch } from '@harness/ui';
import { useOptimistic, useTransition } from 'react';
import { togglePlugin } from '../_actions/toggle-plugin';

type PluginToggleProps = {
  id: string;
  enabled: boolean;
};

type PluginToggleComponent = (props: PluginToggleProps) => React.ReactNode;

export const PluginToggle: PluginToggleComponent = ({ id, enabled }) => {
  const [, startTransition] = useTransition();
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticEnabled(!optimisticEnabled);
      await togglePlugin(id);
    });
  };

  return <Switch checked={optimisticEnabled} onCheckedChange={handleToggle} aria-label='Toggle enabled' />;
};
