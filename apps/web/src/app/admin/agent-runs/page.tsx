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
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='space-y-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Agent Runs</h1>
        <p className='text-sm text-muted-foreground'>Model invocations with token usage and cost tracking.</p>
      </div>
      <AgentRunsTable />
    </div>
  );
};

export default AgentRunsPage;
