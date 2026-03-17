'use client';

import { Button } from '@harness/ui';
import { useTransition } from 'react';
import { disconnectAccount } from '../_actions/disconnect-account';

type DisconnectButtonProps = {
  provider: string;
  accountId: string;
};

type DisconnectButtonComponent = (props: DisconnectButtonProps) => React.ReactNode;

export const DisconnectButton: DisconnectButtonComponent = ({ provider, accountId }) => {
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectAccount(provider, accountId);
    });
  };

  return (
    <Button size='sm' variant='ghost' className='text-destructive hover:text-destructive' disabled={isPending} onClick={handleDisconnect}>
      {isPending ? 'Disconnecting...' : 'Disconnect'}
    </Button>
  );
};
