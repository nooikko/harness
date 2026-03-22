import { Button } from '@harness/ui';
import { BookOpen, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listStories } from '../chat/_actions/list-stories';
import { StoryCard } from './_components/story-card';

export const metadata: Metadata = {
  title: 'Stories | Harness Dashboard',
  description: 'Interactive storytelling with emergent character tracking',
};

const StoriesPage = async () => {
  const stories = await listStories();

  return (
    <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>Stories</h1>
          <p className='text-sm text-muted-foreground'>Interactive narratives with emergent character tracking.</p>
        </div>
        <Button asChild className='gap-2'>
          <Link href='/stories/new'>
            <Plus className='h-4 w-4' />
            New Story
          </Link>
        </Button>
      </div>

      {stories.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center'>
          <BookOpen className='h-10 w-10 text-muted-foreground/50' />
          <div className='flex flex-col gap-1'>
            <p className='text-sm font-medium'>No stories yet</p>
            <p className='text-sm text-muted-foreground'>Create your first story to get started.</p>
          </div>
          <Button asChild size='sm' className='gap-2'>
            <Link href='/stories/new'>
              <Plus className='h-4 w-4' />
              New Story
            </Link>
          </Button>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              name={story.name}
              premise={story.premise}
              threadCount={story._count.threads}
              characterCount={story._count.characters}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StoriesPage;
