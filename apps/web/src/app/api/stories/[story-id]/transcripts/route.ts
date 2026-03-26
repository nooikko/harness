import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ 'story-id': string }>;
};

export const GET = async (_request: Request, context: RouteContext) => {
  const { 'story-id': storyId } = await context.params;

  const transcripts = await prisma.storyTranscript.findMany({
    where: { storyId },
    select: {
      id: true,
      label: true,
      processed: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ transcripts });
};
