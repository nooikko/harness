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
    <div className='mx-auto max-w-3xl space-y-2 p-6'>
      <h1 className='text-lg font-medium'>Agent Runs</h1>
      <AgentRunsTable />
    </div>
  );
};

export default AgentRunsPage;
