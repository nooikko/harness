import { Button } from '@harness/ui';
import { Bot, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listAgents } from '../chat/_actions/list-agents';
import { AgentCard } from './_components/agent-card';

export const metadata: Metadata = {
  title: 'Agents | Harness Dashboard',
  description: 'Manage AI agents for the Harness orchestrator',
};

const AgentsPage = async () => {
  const agents = await listAgents();

  return (
    <div className='flex flex-col gap-6 p-6'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Agents</h1>
          <p className='text-sm text-muted-foreground'>Manage AI agent personas and configurations.</p>
        </div>
        <Button asChild className='gap-2'>
          <Link href='/agents/new'>
            <Plus className='h-4 w-4' />
            New Agent
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center'>
          <Bot className='h-10 w-10 text-muted-foreground/50' />
          <div className='flex flex-col gap-1'>
            <p className='text-sm font-medium'>No agents yet</p>
            <p className='text-sm text-muted-foreground'>Create your first agent to get started.</p>
          </div>
          <Button asChild size='sm' className='gap-2'>
            <Link href='/agents/new'>
              <Plus className='h-4 w-4' />
              New Agent
            </Link>
          </Button>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {agents.map((agent) => (
            <AgentCard key={agent.id} id={agent.id} slug={agent.slug} name={agent.name} enabled={agent.enabled} threadCount={agent._count.threads} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
