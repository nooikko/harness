import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAgentAnnotations } from '../../chat/_actions/list-agent-annotations';
import { listAgentMemories } from '../../chat/_actions/list-agent-memories';
import { AgentAnnotationsBrowser } from '../_components/agent-annotations-browser';
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

  const [agent, memories, agentConfig, cronJobs, annotations] = await Promise.all([
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
    listAgentAnnotations(agentId),
  ]);

  if (!agent) {
    notFound();
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8'>
      <EditAgentForm agent={agent} agentConfig={agentConfig} />
      <AgentAnnotationsBrowser agentId={agentId} annotations={annotations} />
      <AgentMemoryBrowser agentId={agentId} memories={memories} />
      <AgentScheduledTasks tasks={cronJobs} agentId={agentId} />
    </div>
  );
};

export default AgentEditPage;
