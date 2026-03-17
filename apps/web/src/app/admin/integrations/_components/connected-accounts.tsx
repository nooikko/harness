import { prisma } from '@harness/database';
import { Badge } from '@harness/ui';
import { DisconnectButton } from './disconnect-button';

type ConnectedAccountsComponent = () => Promise<React.ReactNode>;

export const ConnectedAccounts: ConnectedAccountsComponent = async () => {
  const tokens = await prisma.oAuthToken.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      accountId: true,
      expiresAt: true,
      scopes: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (tokens.length === 0) {
    return <p className='text-sm text-muted-foreground'>No accounts connected. Click &quot;Connect Account&quot; to get started.</p>;
  }

  return (
    <div className='flex flex-col gap-3'>
      {tokens.map((token) => {
        const meta = token.metadata as {
          email?: string;
          displayName?: string;
        } | null;
        const now = Date.now();
        const expiresAt = token.expiresAt.getTime();
        const fiveMinutes = 5 * 60 * 1000;

        let status: 'valid' | 'expiring' | 'expired';
        if (expiresAt < now) {
          status = 'expired';
        } else if (expiresAt - now < fiveMinutes) {
          status = 'expiring';
        } else {
          status = 'valid';
        }

        const statusColor = {
          valid: 'bg-green-500',
          expiring: 'bg-yellow-500',
          expired: 'bg-red-500',
        }[status];

        return (
          <div key={token.id} className='flex items-center justify-between rounded-lg border p-4'>
            <div className='flex items-center gap-3'>
              <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
              <div className='flex flex-col gap-0.5'>
                <span className='text-sm font-medium'>{meta?.displayName ?? meta?.email ?? token.accountId}</span>
                {meta?.email && <span className='text-xs text-muted-foreground'>{meta.email}</span>}
                <div className='flex gap-1 pt-1'>
                  {token.scopes.slice(0, 4).map((scope) => (
                    <Badge key={scope} variant='secondary' className='px-1.5 py-0 text-[10px]'>
                      {scope}
                    </Badge>
                  ))}
                  {token.scopes.length > 4 && (
                    <Badge variant='secondary' className='px-1.5 py-0 text-[10px]'>
                      +{token.scopes.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-xs text-muted-foreground'>Connected {token.createdAt.toLocaleDateString()}</span>
              <DisconnectButton provider={token.provider} accountId={token.accountId} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
