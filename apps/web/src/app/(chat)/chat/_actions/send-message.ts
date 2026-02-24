'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type SendMessageResult = { error: string } | undefined;

type SendMessage = (threadId: string, content: string) => Promise<SendMessageResult>;

export const sendMessage: SendMessage = async (threadId, content) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: 'Message cannot be empty' };
  }

  await prisma.message.create({
    data: {
      threadId,
      role: 'user',
      content: trimmed,
    },
  });

  await prisma.thread.update({
    where: { id: threadId },
    data: { lastActivity: new Date() },
  });

  revalidatePath(`/chat/${threadId}`);

  try {
    await fetch(`${getOrchestratorUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, content: trimmed }),
    });
  } catch {
    return {
      error: 'Could not reach orchestrator. Make sure it is running.',
    };
  }
};
