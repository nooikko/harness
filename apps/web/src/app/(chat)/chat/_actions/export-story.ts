'use server';

import { prisma } from '@harness/database';
import { logServerError } from '@/lib/log-server-error';

type ExportStoryResult = { data: string; filename: string } | { error: string };

type ExportStory = (storyId: string) => Promise<ExportStoryResult>;

export const exportStory: ExportStory = async (storyId) => {
  if (!storyId?.trim()) {
    return { error: 'Story ID is required' };
  }

  try {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: {
        characters: {
          orderBy: { name: 'asc' },
        },
        locations: {
          include: {
            relationsFrom: true,
            relationsTo: true,
          },
          orderBy: { name: 'asc' },
        },
        moments: {
          where: { deletedAt: null },
          include: {
            characters: true,
            arcs: {
              include: {
                arc: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        arcs: {
          include: {
            moments: {
              include: {
                moment: {
                  select: { id: true, summary: true, storyTime: true },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
        transcripts: {
          select: {
            id: true,
            label: true,
            sourceType: true,
            processed: true,
            processedThrough: true,
            totalChunks: true,
            messageCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!story) {
      return { error: 'Story not found' };
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      story: {
        id: story.id,
        name: story.name,
        premise: story.premise,
        storyTime: story.storyTime,
        currentScene: story.currentScene,
        createdAt: story.createdAt.toISOString(),
      },
      characters: story.characters.map((c) => ({
        id: c.id,
        name: c.name,
        aliases: c.aliases,
        appearance: c.appearance,
        personality: c.personality,
        mannerisms: c.mannerisms,
        motives: c.motives,
        backstory: c.backstory,
        relationships: c.relationships,
        color: c.color,
        status: c.status,
        importNotes: c.importNotes,
      })),
      locations: story.locations.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        parentId: l.parentId,
        relationsFrom: l.relationsFrom.map((r) => ({
          toId: r.toId,
          distance: r.distance,
          direction: r.direction,
          notes: r.notes,
        })),
      })),
      moments: story.moments.map((m) => ({
        id: m.id,
        summary: m.summary,
        description: m.description,
        storyTime: m.storyTime,
        locationId: m.locationId,
        kind: m.kind,
        importance: m.importance,
        sourceNotes: m.sourceNotes,
        annotation: m.annotation,
        createdAt: m.createdAt.toISOString(),
        characters: m.characters.map((c) => ({
          characterId: c.characterId,
          characterName: c.characterName,
          role: c.role,
          perspective: c.perspective,
          emotionalImpact: c.emotionalImpact,
          knowledgeGained: c.knowledgeGained,
          relationshipContext: c.relationshipContext,
        })),
        arcs: m.arcs.map((a) => a.arc.name),
      })),
      arcs: story.arcs.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        status: a.status,
        importance: a.importance,
        annotation: a.annotation,
        momentIds: a.moments.map((m) => m.moment.id),
      })),
      transcripts: story.transcripts,
    };

    const slug = story.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-export-${date}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
    };
  } catch (err) {
    logServerError({
      action: 'exportStory',
      error: err,
      context: { storyId },
    });
    return { error: 'Failed to export story' };
  }
};
