import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAgentMemories } from '../../chat/_actions/list-agent-memories';
import { AgentMemoryBrowser } from '../_components/agent-memory-browser';
import { AgentScheduledTasks } from '../_components/agent-scheduled-tasks';
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

  const [agent, memories, agentConfig, cronJobs] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        slug: true,
        name: true,
        soul: true,
        identity: true,
        userContext: true,
        role: true,
        goal: true,
        backstory: true,
        enabled: true,
        version: true,
      },
    }),
    listAgentMemories(agentId),
    prisma.agentConfig.findUnique({
      where: { agentId },
      select: {
        memoryEnabled: true,
        reflectionEnabled: true,
      },
    }),
    prisma.cronJob.findMany({
      where: { agentId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        schedule: true,
        fireAt: true,
        enabled: true,
        lastRunAt: true,
        nextRunAt: true,
      },
    }),
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
      <EditAgentForm agent={agent} agentConfig={agentConfig} />
      <AgentMemoryBrowser agentId={agentId} memories={memories} />
      <AgentScheduledTasks tasks={cronJobs} agentId={agentId} />
    </div>
  );
};

export default AgentEditPage;
