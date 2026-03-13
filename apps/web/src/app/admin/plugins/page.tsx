// Plugins admin page — configure and manage orchestrator plugins

import type { Metadata } from 'next';
import { PluginsTable } from './_components/plugins-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plugins | Admin | Harness Dashboard',
  description: 'Configure and manage orchestrator plugins.',
};

type PluginsPageComponent = () => React.ReactNode;

const PluginsPage: PluginsPageComponent = () => {
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Plugins</h1>
        <p className='text-sm text-muted-foreground'>Manage orchestrator plugin configurations.</p>
      </div>
      <PluginsTable />
    </div>
  );
};

export default PluginsPage;
