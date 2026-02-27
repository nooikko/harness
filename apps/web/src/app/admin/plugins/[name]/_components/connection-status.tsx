'use client';

import { useEffect, useState } from 'react';
import { useWs } from '@/app/_components/ws-provider';

type ConnectionState = {
  connected: boolean;
  username?: string;
};

type ConnectionStatusProps = {
  pluginName: string;
  initialState: ConnectionState;
};

type ConnectionStatusComponent = (props: ConnectionStatusProps) => React.ReactNode;

export const ConnectionStatus: ConnectionStatusComponent = ({ pluginName, initialState }) => {
  const [state, setState] = useState<ConnectionState>(initialState);
  const { lastEvent } = useWs(`${pluginName}:connection`);

  useEffect(() => {
    if (lastEvent !== null) {
      setState(lastEvent as ConnectionState);
    }
  }, [lastEvent]);

  return (
    <div className='flex items-center gap-2 text-sm'>
      <span className={`inline-block h-2 w-2 rounded-full ${state.connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span>{state.connected ? 'Connected' : 'Disconnected'}</span>
      {state.connected && state.username && <span className='text-muted-foreground'>as {state.username}</span>}
    </div>
  );
};
