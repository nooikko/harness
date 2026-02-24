// Agent runs admin page — view model invocations, token usage, and costs

import type { Metadata } from 'next';
import { AgentRunsTable } from './_components/agent-runs-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agent Runs | Admin | Harness Dashboard',
  description: 'View model invocations, token usage, and costs per run.',
};

type AgentRunsPageComponent = () => React.ReactNode;

const AgentRunsPage: AgentRunsPageComponent = () => {
  return (
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Agent Runs</h1>
        <p className='mt-1 text-muted-foreground'>View model invocations, token usage, and costs per run.</p>
      </div>
      <AgentRunsTable />
    </div>
  );
};

export default AgentRunsPage;
