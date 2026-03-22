'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpsertAnnotationParams = {
  messageId: string;
  content: string;
};

type UpsertAnnotationResult = { success: true; id: string } | { error: string };

type UpsertAnnotation = (params: UpsertAnnotationParams) => Promise<UpsertAnnotationResult>;

export const upsertAnnotation: UpsertAnnotation = async ({ messageId, content }) => {
  if (!messageId || !content?.trim()) {
    return { error: 'Message ID and content are required' };
  }

  try {
    // Look up the agent from the message's thread
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { threadId: true, thread: { select: { agentId: true } } },
    });

    if (!message) {
      return { error: 'Message not found' };
    }

    const annotation = await prisma.messageAnnotation.upsert({
      where: { messageId },
      create: {
        messageId,
        agentId: message.thread.agentId,
        content: content.trim(),
      },
      update: {
        content: content.trim(),
      },
    });

    revalidatePath('/chat');

    return { success: true, id: annotation.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};
