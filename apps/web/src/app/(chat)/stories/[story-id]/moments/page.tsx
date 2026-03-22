import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MomentBrowser } from './_components/moment-browser';

type MomentsPageProps = {
  params: Promise<{ 'story-id': string }>;
};

export const metadata: Metadata = {
  title: 'Moments | Harness Dashboard',
};

const MomentsPage = async ({ params }: MomentsPageProps) => {
  const { 'story-id': storyId } = await params;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, name: true },
  });

  if (!story) {
    notFound();
  }

  return (
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex items-center gap-3'>
        <h1 className='text-lg font-semibold tracking-tight'>{story.name} — Moments</h1>
      </div>
      <Suspense fallback={<div className='h-96 animate-pulse rounded-lg bg-muted' />}>
        <MomentBrowser storyId={storyId} />
      </Suspense>
    </div>
  );
};

export default MomentsPage;
