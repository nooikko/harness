import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { TranscriptViewer } from './_components/transcript-viewer';

type TranscriptViewerPageProps = {
  params: Promise<{ 'story-id': string; 'transcript-id': string }>;
};

export const metadata: Metadata = {
  title: 'Transcript Viewer | Harness Dashboard',
};

const TranscriptViewerPage = async ({ params }: TranscriptViewerPageProps) => {
  const { 'story-id': storyId, 'transcript-id': transcriptId } = await params;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, name: true },
  });

  if (!story) {
    notFound();
  }

  return (
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <Suspense fallback={<div className='h-96 animate-pulse rounded-lg bg-muted' />}>
        <TranscriptViewer storyId={storyId} transcriptId={transcriptId} />
      </Suspense>
    </div>
  );
};

export default TranscriptViewerPage;
