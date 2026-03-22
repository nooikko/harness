'use client';

import { ScrollArea } from '@harness/ui';
import { Users, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { listStoryCharacters } from '../_actions/list-story-characters';
import { CharacterDetailCard } from './character-detail-card';

type CharacterData = Awaited<ReturnType<typeof listStoryCharacters>>[number];

type CharacterPanelProps = {
  storyId: string;
  onClose: () => void;
};

type CharacterPanelComponent = (props: CharacterPanelProps) => React.ReactNode;

export const CharacterPanel: CharacterPanelComponent = ({ storyId, onClose }) => {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await listStoryCharacters(storyId);
      setCharacters(data);
    });
  }, [storyId]);

  const handleCharacterUpdated = () => {
    startTransition(async () => {
      const data = await listStoryCharacters(storyId);
      setCharacters(data);
    });
  };

  return (
    <div className='flex w-80 shrink-0 flex-col border-l bg-background'>
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Users className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm font-medium'>Characters</span>
          <span className='text-xs text-muted-foreground'>({characters.length})</span>
        </div>
        <button type='button' onClick={onClose} className='text-muted-foreground hover:text-foreground' aria-label='Close character panel'>
          <X className='h-4 w-4' />
        </button>
      </div>
      <ScrollArea className='flex-1'>
        <div className='flex flex-col gap-1 p-2'>
          {isLoading && characters.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>Loading characters...</div>
          ) : characters.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>No characters detected yet.</div>
          ) : (
            characters.map((char) => <CharacterDetailCard key={char.id} character={char} onUpdated={handleCharacterUpdated} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
