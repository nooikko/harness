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
    <div className='mx-auto max-w-3xl space-y-2 p-6'>
      <h1 className='text-lg font-medium'>Plugins</h1>
      <PluginsTable />
    </div>
  );
};

export default PluginsPage;
