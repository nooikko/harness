import type { PrismaClient } from '@harness/database';

type UpdateSelfInput = {
  name?: string;
  soul?: string;
  identity?: string;
  role?: string;
  goal?: string;
  backstory?: string;
};

type UpdateAgentSelf = (db: PrismaClient, threadId: string, input: UpdateSelfInput) => Promise<string>;

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const updateAgentSelf: UpdateAgentSelf = async (db, threadId, input) => {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: { agentId: true },
  });
  if (!thread?.agentId) {
    return '(this thread has no assigned agent)';
  }

  const agentId = thread.agentId;

  // Build update data — only include fields that were provided
  const updateData: Record<string, unknown> = {};
  if (input.name) {
    updateData.name = input.name;
    updateData.slug = toSlug(input.name);
  }
  if (input.soul) {
    updateData.soul = input.soul;
  }
  if (input.identity) {
    updateData.identity = input.identity;
  }
  if (input.role !== undefined) {
    updateData.role = input.role;
  }
  if (input.goal !== undefined) {
    updateData.goal = input.goal;
  }
  if (input.backstory !== undefined) {
    updateData.backstory = input.backstory;
  }

  const agent = await db.agent.update({
    where: { id: agentId },
    data: updateData,
  });

  // Mark as bootstrapped
  await db.agentConfig.upsert({
    where: { agentId },
    update: { bootstrapped: true },
    create: {
      agentId,
      memoryEnabled: true,
      reflectionEnabled: false,
      bootstrapped: true,
    },
  });

  return `Identity updated. I am now ${agent.name}.`;
};
