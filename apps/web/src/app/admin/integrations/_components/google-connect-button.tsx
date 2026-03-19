'use client';

import { Button } from '@harness/ui';
import { useTransition } from 'react';
import { connectGoogle } from '../_actions/connect-google';

type GoogleConnectButtonComponent = () => React.ReactNode;

export const GoogleConnectButton: GoogleConnectButtonComponent = () => {
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      await connectGoogle();
    });
  };

  return (
    <Button size='sm' variant='outline' disabled={isPending} onClick={handleConnect}>
      {isPending ? 'Connecting...' : 'Connect Account'}
    </Button>
  );
};
