'use server';

import { prisma } from '@harness/database';

type AnnotationSummary = {
  id: string;
  messageId: string;
  content: string;
  messageExcerpt: string;
  threadId: string;
  threadName: string | null;
  createdAt: Date;
};

type ListAgentAnnotations = (agentId: string) => Promise<AnnotationSummary[]>;

export const listAgentAnnotations: ListAgentAnnotations = async (agentId) => {
  const annotations = await prisma.messageAnnotation.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      messageId: true,
      content: true,
      createdAt: true,
      message: {
        select: {
          content: true,
          threadId: true,
          thread: { select: { name: true } },
        },
      },
    },
  });

  return annotations.map((ann) => ({
    id: ann.id,
    messageId: ann.messageId,
    content: ann.content,
    messageExcerpt: ann.message.content.length > 200 ? `${ann.message.content.slice(0, 200)}...` : ann.message.content,
    threadId: ann.message.threadId,
    threadName: ann.message.thread.name,
    createdAt: ann.createdAt,
  }));
};
