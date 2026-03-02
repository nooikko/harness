import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAgentMemories } from '../../chat/_actions/list-agent-memories';
import { AgentMemoryBrowser } from '../_components/agent-memory-browser';
import { EditAgentForm } from '../_components/edit-agent-form';

type AgentEditPageProps = {
  params: Promise<{ 'agent-id': string }>;
};

export const generateMetadata = async ({ params }: AgentEditPageProps): Promise<Metadata> => {
  const { 'agent-id': agentId } = await params;
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true } });
  return {
    title: agent ? `Edit ${agent.name} | Harness Dashboard` : 'Agent Not Found',
  };
};

const AgentEditPage = async ({ params }: AgentEditPageProps) => {
  const { 'agent-id': agentId } = await params;

  const [agent, memories] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        slug: true,
        name: true,
        soul: true,
        identity: true,
        role: true,
        goal: true,
        backstory: true,
        enabled: true,
        version: true,
      },
    }),
    listAgentMemories(agentId),
  ]);

  if (!agent) {
    notFound();
  }

  return (
    <div className='flex flex-col gap-6 p-6 max-w-3xl'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>{agent.name}</h1>
        <p className='text-sm text-muted-foreground'>Edit agent configuration and soul definition.</p>
      </div>
      <EditAgentForm agent={agent} />
      <AgentMemoryBrowser agentId={agentId} memories={memories} />
    </div>
  );
};

export default AgentEditPage;
