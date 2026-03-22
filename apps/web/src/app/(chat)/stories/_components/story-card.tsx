'use client';

import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@harness/ui';
import { BookOpen, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteStory } from '../../chat/_actions/delete-story';

type StoryCardProps = {
  id: string;
  name: string;
  premise: string | null;
  threadCount: number;
  characterCount: number;
};

type StoryCardComponent = (props: StoryCardProps) => React.ReactNode;

export const StoryCard: StoryCardComponent = ({ id, name, premise, threadCount, characterCount }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deleteStory(id);
      setConfirmDelete(false);
    });
  };

  const handleClick = () => {
    router.push(`/stories/${id}`);
  };

  return (
    <Card className='cursor-pointer transition-colors hover:bg-accent/50' onClick={handleClick}>
      <CardHeader className='pb-2'>
        <CardTitle className='truncate text-base font-semibold'>{name}</CardTitle>
      </CardHeader>
      {premise && (
        <CardContent className='pb-2'>
          <p className='line-clamp-2 text-sm text-muted-foreground'>{premise}</p>
        </CardContent>
      )}
      <CardFooter className='justify-between'>
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <BookOpen className='h-3 w-3' />
            {threadCount} {threadCount === 1 ? 'chapter' : 'chapters'}
          </span>
          <span className='flex items-center gap-1'>
            <Users className='h-3 w-3' />
            {characterCount}
          </span>
        </div>
        <Button
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size='sm'
          onClick={handleDelete}
          disabled={isPending}
          className={confirmDelete ? 'gap-1.5' : 'gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10'}
        >
          <Trash2 className='h-3.5 w-3.5' />
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </Button>
      </CardFooter>
    </Card>
  );
};
