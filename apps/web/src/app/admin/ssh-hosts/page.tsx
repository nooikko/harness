// SSH hosts admin page — manage SSH connection targets for automation

import { Button } from '@harness/ui';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { loadEnv } from '@/app/_helpers/env';
import { SshHostTable } from './_components/ssh-host-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SSH Hosts | Admin | Harness Dashboard',
  description: 'Manage SSH connection targets for agent automation.',
};

type SshHostsPageComponent = () => React.ReactNode;

const SshHostsPage: SshHostsPageComponent = () => {
  const hasEncryptionKey = !!loadEnv().HARNESS_ENCRYPTION_KEY;

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      {!hasEncryptionKey && (
        <div className='rounded-md border border-yellow-800 bg-yellow-950 p-3 text-sm text-yellow-200'>
          <strong>Warning:</strong> HARNESS_ENCRYPTION_KEY is not configured. SSH private keys cannot be stored securely. Set this in your .env file.
        </div>
      )}
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>SSH Hosts</h1>
          <p className='text-sm text-muted-foreground'>Configured SSH connection targets for agent automation.</p>
        </div>
        <Button asChild className='gap-2'>
          <Link href='/admin/ssh-hosts/new'>
            <Plus className='h-4 w-4' />
            Add Host
          </Link>
        </Button>
      </div>
      <SshHostTable />
    </div>
  );
};

export default SshHostsPage;
