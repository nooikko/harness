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
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Plugins</h1>
        <p className='mt-1 text-muted-foreground'>Configure and manage orchestrator plugins.</p>
      </div>
      <PluginsTable />
    </div>
  );
};

export default PluginsPage;
