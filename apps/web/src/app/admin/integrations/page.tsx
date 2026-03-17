import { Separator } from '@harness/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConnectButton } from './_components/connect-button';
import { ConnectedAccounts } from './_components/connected-accounts';
import { OAuthStatusMessage } from './_components/oauth-status-message';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Integrations | Admin',
  description: 'Manage connected accounts and third-party integrations.',
};

const IntegrationsPage = async ({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : undefined;
  const success = params.success === 'true';

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Integrations</h1>
        <p className='text-sm text-muted-foreground'>Connect external services to enable email, calendar, and other integrations.</p>
      </div>

      <OAuthStatusMessage error={error} success={success} />

      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-medium'>Microsoft 365</h2>
          <ConnectButton />
        </div>
        <Separator />
        <Suspense fallback={<div className='text-sm text-muted-foreground'>Loading accounts...</div>}>
          <ConnectedAccounts />
        </Suspense>
      </div>
    </div>
  );
};

export default IntegrationsPage;
