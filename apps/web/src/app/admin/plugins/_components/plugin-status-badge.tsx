'use client';

import { useContext, useEffect, useState } from 'react';
import { WsContext } from '@/app/_components/ws-provider';

type PluginStatusLevel = 'healthy' | 'degraded' | 'error';

type StatusUpdate = {
  pluginName: string;
  status: {
    level: PluginStatusLevel;
    message?: string;
    since: number;
  };
};

type PluginStatusBadgeProps = {
  pluginName: string;
  enabled: boolean;
};

type PluginStatusBadgeComponent = (props: PluginStatusBadgeProps) => React.ReactNode;

const LEVEL_STYLES: Record<PluginStatusLevel, { dot: string; label: string }> = {
  healthy: { dot: 'bg-success', label: 'healthy' },
  degraded: { dot: 'bg-warning', label: 'degraded' },
  error: { dot: 'bg-destructive', label: 'error' },
};

export const PluginStatusBadge: PluginStatusBadgeComponent = ({ pluginName, enabled }) => {
  const ws = useContext(WsContext);
  const [status, setStatus] = useState<{ level: PluginStatusLevel; message?: string } | null>(null);

  useEffect(() => {
    if (!ws) {
      return;
    }

    return ws.subscribe('plugin:status-changed', (data: unknown) => {
      const update = data as StatusUpdate;
      if (update.pluginName === pluginName) {
        setStatus({ level: update.status.level, message: update.status.message });
      }
    });
  }, [ws, pluginName]);

  if (!enabled) {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
        <span className='h-2 w-2 rounded-full bg-muted-foreground/40' aria-hidden='true' />
        disabled
      </span>
    );
  }

  if (!status) {
    // No live status yet — show enabled as default
    return (
      <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
        <span className='h-2 w-2 rounded-full bg-success' aria-hidden='true' />
        enabled
      </span>
    );
  }

  const style = LEVEL_STYLES[status.level];

  return (
    <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground' title={status.message}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden='true' />
      <span>{style.label}</span>
      {status.message && status.level !== 'healthy' && <span className='max-w-50 truncate text-muted-foreground/60'>{status.message}</span>}
    </span>
  );
};
