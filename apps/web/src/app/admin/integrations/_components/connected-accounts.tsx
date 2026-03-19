import { prisma } from '@harness/database';
import { Badge } from '@harness/ui';
import { DisconnectButton } from './disconnect-button';

type ConnectionStatus = 'connected' | 'reauth-required';

type DeriveConnectionStatus = (token: { refreshToken: string | null; expiresAt: Date }) => ConnectionStatus;

const deriveConnectionStatus: DeriveConnectionStatus = (token) => {
  const hasRefreshToken = token.refreshToken !== null;
  const isExpired = token.expiresAt.getTime() < Date.now();

  if (!isExpired || hasRefreshToken) {
    return 'connected';
  }
  return 'reauth-required';
};

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: 'bg-green-500', label: 'Connected' },
  'reauth-required': {
    color: 'bg-red-500',
    label: 'Re-authentication required',
  },
};

type ConnectedAccountsProps = {
  provider?: string;
};

type ConnectedAccountsComponent = (props: ConnectedAccountsProps) => Promise<React.ReactNode>;

export const ConnectedAccounts: ConnectedAccountsComponent = async ({ provider }) => {
  const tokens = await prisma.oAuthToken.findMany({
    where: provider ? { provider } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      accountId: true,
      expiresAt: true,
      refreshToken: true,
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

        const status = deriveConnectionStatus(token);
        const { color, label } = STATUS_CONFIG[status];

        return (
          <div key={token.id} className='flex items-center justify-between rounded-lg border p-4'>
            <div className='flex items-center gap-3'>
              <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
              <div className='flex flex-col gap-0.5'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium'>{meta?.displayName ?? meta?.email ?? token.accountId}</span>
                  <span className={`text-xs ${status === 'connected' ? 'text-muted-foreground' : 'text-red-500'}`}>{label}</span>
                </div>
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
