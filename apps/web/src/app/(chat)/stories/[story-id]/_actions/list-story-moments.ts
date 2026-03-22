'use server';

import { prisma } from '@harness/database';

type ListStoryMomentsInput = {
  storyId: string;
  characterName?: string;
  arcId?: string;
  search?: string;
  minImportance?: number;
  limit?: number;
  offset?: number;
};

type MomentResult = {
  id: string;
  summary: string;
  description: string | null;
  storyTime: string | null;
  kind: string;
  importance: number;
  annotation: string | null;
  sourceNotes: string | null;
  createdAt: string;
  location: { name: string } | null;
  characters: {
    characterName: string;
    role: string;
    perspective: string | null;
    emotionalImpact: string | null;
    relationshipContext: string | null;
  }[];
  arcs: string[];
};

type ListStoryMomentsResult = {
  moments: MomentResult[];
  total: number;
};

type ListStoryMoments = (input: ListStoryMomentsInput) => Promise<ListStoryMomentsResult>;

export const listStoryMoments: ListStoryMoments = async (input) => {
  const where: Record<string, unknown> = {
    storyId: input.storyId,
    deletedAt: null,
  };

  if (input.characterName) {
    where.characters = {
      some: { characterName: { contains: input.characterName, mode: 'insensitive' } },
    };
  }

  if (input.arcId) {
    where.arcs = { some: { arcId: input.arcId } };
  }

  if (input.search) {
    where.OR = [
      { summary: { contains: input.search, mode: 'insensitive' } },
      { description: { contains: input.search, mode: 'insensitive' } },
      { annotation: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  if (input.minImportance) {
    where.importance = { gte: input.minImportance };
  }

  const [moments, total] = await Promise.all([
    prisma.storyMoment.findMany({
      where,
      include: {
        location: { select: { name: true } },
        characters: {
          select: {
            characterName: true,
            role: true,
            perspective: true,
            emotionalImpact: true,
            relationshipContext: true,
          },
        },
        arcs: {
          include: { arc: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    }),
    prisma.storyMoment.count({ where }),
  ]);

  return {
    moments: moments.map((m) => ({
      id: m.id,
      summary: m.summary,
      description: m.description,
      storyTime: m.storyTime,
      kind: m.kind,
      importance: m.importance,
      annotation: m.annotation,
      sourceNotes: m.sourceNotes,
      createdAt: m.createdAt.toISOString(),
      location: m.location,
      characters: m.characters,
      arcs: m.arcs.map((a) => a.arc.name),
    })),
    total,
  };
};
