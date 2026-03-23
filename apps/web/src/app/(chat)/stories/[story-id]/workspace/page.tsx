import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoryWorkspace } from './_components/story-workspace';

type WorkspacePageProps = {
  params: Promise<{ 'story-id': string }>;
};

export const metadata: Metadata = {
  title: 'Story Workspace | Harness',
};

const WorkspacePage = async ({ params }: WorkspacePageProps) => {
  const { 'story-id': storyId } = await params;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, name: true, premise: true, storyTime: true },
  });

  if (!story) {
    notFound();
  }

  // Load transcript list for tabs
  const transcripts = await prisma.storyTranscript.findMany({
    where: { storyId },
    select: {
      id: true,
      label: true,
      sourceType: true,
      processed: true,
      sortOrder: true,
      messageCount: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Find or create the import thread for the chat panel
  let importThread = await prisma.thread.findFirst({
    where: { storyId, source: 'web', sourceId: `import-${storyId}` },
    select: { id: true, kind: true },
  });

  if (importThread && importThread.kind !== 'story-import') {
    await prisma.thread.update({
      where: { id: importThread.id },
      data: { kind: 'story-import' },
    });
  }

  if (!importThread) {
    importThread = await prisma.thread.create({
      data: {
        name: `${story.name} — Import`,
        kind: 'story-import',
        source: 'web',
        sourceId: `import-${storyId}`,
        storyId,
        status: 'active',
        lastActivity: new Date(),
      },
      select: { id: true, kind: true },
    });
  }

  return (
    <StoryWorkspace
      story={{ id: story.id, name: story.name, premise: story.premise, storyTime: story.storyTime }}
      transcripts={transcripts.map((t) => ({
        id: t.id,
        label: t.label,
        sourceType: t.sourceType,
        processed: t.processed,
        sortOrder: t.sortOrder,
        messageCount: t.messageCount,
      }))}
      importThreadId={importThread.id}
    />
  );
};

export default WorkspacePage;
