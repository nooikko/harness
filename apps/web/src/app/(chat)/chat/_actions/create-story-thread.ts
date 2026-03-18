'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { buildStoryRecap } from '../_helpers/build-story-recap';

type CreateStoryThreadResult = { threadId: string };

type CreateStoryThread = (storyId: string) => Promise<CreateStoryThreadResult>;

export const createStoryThread: CreateStoryThread = async (storyId) => {
  const story = await prisma.story.findUniqueOrThrow({
    where: { id: storyId },
    select: {
      premise: true,
      storyTime: true,
      agentId: true,
      name: true,
    },
  });

  // Load active characters
  const characters = await prisma.storyCharacter.findMany({
    where: { storyId, status: 'active' },
    select: {
      name: true,
      personality: true,
      appearance: true,
      status: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Load top 10 moments by importance
  const moments = await prisma.storyMoment.findMany({
    where: { storyId },
    select: {
      summary: true,
      storyTime: true,
      characters: {
        select: { characterName: true },
      },
    },
    orderBy: { importance: 'desc' },
    take: 10,
  });

  // Load last 15 messages from the most recent thread in this story
  const latestThread = await prisma.thread.findFirst({
    where: { storyId },
    orderBy: { lastActivity: 'desc' },
    select: { id: true },
  });

  let recentMessages: { role: string; content: string }[] = [];
  if (latestThread) {
    const messages = await prisma.message.findMany({
      where: {
        threadId: latestThread.id,
        kind: 'text',
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { role: true, content: true },
    });
    recentMessages = messages.reverse();
  }

  // Build recap text
  const recapContent = buildStoryRecap({
    characters: characters.map((c) => ({
      name: c.name,
      personality: c.personality,
      appearance: c.appearance,
      status: c.status,
    })),
    moments: moments.map((m) => ({
      summary: m.summary,
      storyTime: m.storyTime,
      characterNames: m.characters.map((c) => c.characterName),
    })),
    recentMessages,
    premise: story.premise,
  });

  // Create the new thread
  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'storytelling',
      status: 'active',
      name: `${story.name} (continued)`,
      storyId,
      agentId: story.agentId,
    },
  });

  // Create the recap as the first message
  await prisma.message.create({
    data: {
      threadId: thread.id,
      role: 'system',
      kind: 'recap',
      content: recapContent,
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
