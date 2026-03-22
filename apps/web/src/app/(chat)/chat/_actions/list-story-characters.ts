'use server';

import { prisma } from '@harness/database';

type StoryCharacterSummary = {
  id: string;
  storyId: string;
  name: string;
  aliases: string[];
  appearance: string | null;
  personality: string | null;
  mannerisms: string | null;
  motives: string | null;
  backstory: string | null;
  relationships: string | null;
  color: string | null;
  status: string;
  firstSeenAt: Date;
  updatedAt: Date;
};

type ListStoryCharacters = (storyId: string) => Promise<StoryCharacterSummary[]>;

export const listStoryCharacters: ListStoryCharacters = async (storyId) => {
  return prisma.storyCharacter.findMany({
    where: { storyId },
    select: {
      id: true,
      storyId: true,
      name: true,
      aliases: true,
      appearance: true,
      personality: true,
      mannerisms: true,
      motives: true,
      backstory: true,
      relationships: true,
      color: true,
      status: true,
      firstSeenAt: true,
      updatedAt: true,
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });
};
