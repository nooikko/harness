'use client';

import { Button } from '@harness/ui';
import { useTransition } from 'react';
import { connectMicrosoft } from '../_actions/connect-microsoft';

type ConnectButtonComponent = () => React.ReactNode;

export const ConnectButton: ConnectButtonComponent = () => {
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      await connectMicrosoft();
    });
  };

  return (
    <Button size='sm' variant='outline' disabled={isPending} onClick={handleConnect}>
      {isPending ? 'Connecting...' : 'Connect Account'}
    </Button>
  );
};
