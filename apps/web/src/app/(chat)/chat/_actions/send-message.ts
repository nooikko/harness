'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';
import { logServerError } from '@/lib/log-server-error';

type SendMessageResult = { error: string } | undefined;

type SendMessage = (threadId: string, content: string, fileIds?: string[]) => Promise<SendMessageResult>;

export const sendMessage: SendMessage = async (threadId, content, fileIds) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: 'Message cannot be empty' };
  }

  const message = await prisma.message.create({
    data: {
      threadId,
      role: 'user',
      content: trimmed,
    },
  });

  if (fileIds && fileIds.length > 0) {
    await prisma.file.updateMany({
      where: { id: { in: fileIds }, threadId },
      data: { messageId: message.id },
    });
  }

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
      cache: 'no-store',
    });
  } catch (err) {
    logServerError({ action: 'sendMessage', error: err, context: { threadId } });
    return {
      error: 'Could not reach orchestrator. Make sure it is running.',
    };
  }
};
