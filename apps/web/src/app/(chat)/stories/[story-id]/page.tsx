import { prisma } from '@harness/database';
import { Badge, Button, Skeleton } from '@harness/ui';
import { BookOpen, FileText, GitBranch, Layout } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StoryCharacterGrid } from '../_components/story-character-grid';
import { StoryLocationList } from '../_components/story-location-list';
import { StoryThreadList } from '../_components/story-thread-list';
import { ImportDashboard } from './_components/import-dashboard';

type StoryDetailProps = {
  params: Promise<{ 'story-id': string }>;
};

export const metadata: Metadata = {
  title: 'Story | Harness Dashboard',
};

const StoryDetailPage = async ({ params }: StoryDetailProps) => {
  const { 'story-id': storyId } = await params;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: { agent: { select: { name: true } } },
  });

  if (!story) {
    notFound();
  }

  return (
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      {/* Header */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-3'>
          <h1 className='text-lg font-semibold tracking-tight'>{story.name}</h1>
          {story.agent && (
            <Badge variant='secondary' className='text-xs'>
              {story.agent.name}
            </Badge>
          )}
          {story.storyTime && (
            <Badge variant='outline' className='text-xs'>
              {story.storyTime}
            </Badge>
          )}
        </div>
        {story.premise && <p className='text-sm text-muted-foreground'>{story.premise}</p>}
        <div className='flex items-center gap-2'>
          <Link href={`/stories/${storyId}/moments`}>
            <Button variant='outline' size='sm'>
              <BookOpen className='h-4 w-4 mr-1.5' />
              Moments
            </Button>
          </Link>
          <Link href={`/stories/${storyId}/arcs`}>
            <Button variant='outline' size='sm'>
              <GitBranch className='h-4 w-4 mr-1.5' />
              Story Arcs
            </Button>
          </Link>
          <Link href={`/stories/${storyId}/transcripts`}>
            <Button variant='outline' size='sm'>
              <FileText className='h-4 w-4 mr-1.5' />
              Transcripts
            </Button>
          </Link>
          <Link href={`/stories/${storyId}/workspace`}>
            <Button size='sm'>
              <Layout className='h-4 w-4 mr-1.5' />
              Open Workspace
            </Button>
          </Link>
        </div>
      </div>

      {/* Import Progress */}
      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-medium'>Import Progress</h2>
        <ImportDashboard storyId={storyId} />
      </section>

      {/* Chapters (Threads) */}
      <section className='flex flex-col gap-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-medium'>Chapters</h2>
        </div>
        <Suspense fallback={<Skeleton className='h-24 w-full' />}>
          <StoryThreadList storyId={storyId} />
        </Suspense>
      </section>

      {/* Characters */}
      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-medium'>Characters</h2>
        <Suspense fallback={<Skeleton className='h-24 w-full' />}>
          <StoryCharacterGrid storyId={storyId} />
        </Suspense>
      </section>

      {/* Locations */}
      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-medium'>Locations</h2>
        <Suspense fallback={<Skeleton className='h-16 w-full' />}>
          <StoryLocationList storyId={storyId} />
        </Suspense>
      </section>
    </div>
  );
};

export default StoryDetailPage;
