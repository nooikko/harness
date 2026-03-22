'use server';

import { prisma } from '@harness/database';

type ImportStats = {
  characters: { total: number; active: number };
  transcripts: { total: number; processed: number; pending: number };
  moments: { total: number; active: number; deleted: number; driftFlagged: number };
  arcs: { total: number; totalLinkedMoments: number };
  locations: number;
  annotations: number;
};

type GetImportStats = (storyId: string) => Promise<ImportStats>;

export const getImportStats: GetImportStats = async (storyId) => {
  const [
    totalCharacters,
    activeCharacters,
    totalTranscripts,
    processedTranscripts,
    totalMoments,
    deletedMoments,
    totalArcs,
    totalLinkedMoments,
    locations,
    annotations,
  ] = await Promise.all([
    prisma.storyCharacter.count({ where: { storyId } }),
    prisma.storyCharacter.count({ where: { storyId, status: 'active' } }),
    prisma.storyTranscript.count({ where: { storyId } }),
    prisma.storyTranscript.count({ where: { storyId, processed: true } }),
    prisma.storyMoment.count({ where: { storyId } }),
    prisma.storyMoment.count({ where: { storyId, deletedAt: { not: null } } }),
    prisma.storyArc.count({ where: { storyId } }),
    prisma.momentInArc.count({ where: { arc: { storyId } } }),
    prisma.storyLocation.count({ where: { storyId } }),
    prisma.transcriptAnnotation.count({ where: { transcript: { storyId } } }),
  ]);

  return {
    characters: { total: totalCharacters, active: activeCharacters },
    transcripts: { total: totalTranscripts, processed: processedTranscripts, pending: totalTranscripts - processedTranscripts },
    moments: { total: totalMoments, active: totalMoments - deletedMoments, deleted: deletedMoments, driftFlagged: 0 },
    arcs: { total: totalArcs, totalLinkedMoments },
    locations,
    annotations,
  };
};
