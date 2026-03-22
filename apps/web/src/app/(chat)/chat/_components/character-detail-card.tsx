'use client';

import { Badge, Textarea } from '@harness/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import type { listStoryCharacters } from '../_actions/list-story-characters';
import { updateStoryCharacter } from '../_actions/update-story-character';

type CharacterData = Awaited<ReturnType<typeof listStoryCharacters>>[number];

type CharacterDetailCardProps = {
  character: CharacterData;
  onUpdated: () => void;
};

type CharacterDetailCardComponent = (props: CharacterDetailCardProps) => React.ReactNode;

const EDITABLE_FIELDS = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'personality', label: 'Personality' },
  { key: 'mannerisms', label: 'Mannerisms' },
  { key: 'motives', label: 'Motives' },
  { key: 'backstory', label: 'Backstory' },
  { key: 'relationships', label: 'Relationships' },
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number]['key'];

export const CharacterDetailCard: CharacterDetailCardComponent = ({ character, onUpdated }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleBlur = useCallback(
    (field: EditableField, value: string) => {
      const currentValue = character[field] ?? '';
      if (value === currentValue) {
        return;
      }
      startTransition(async () => {
        await updateStoryCharacter({ id: character.id, [field]: value });
        onUpdated();
      });
    },
    [character, onUpdated],
  );

  return (
    <div className='rounded-md border'>
      <button
        type='button'
        onClick={() => setIsExpanded((prev) => !prev)}
        className='flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50'
      >
        {isExpanded ? (
          <ChevronDown className='h-3 w-3 shrink-0 text-muted-foreground' />
        ) : (
          <ChevronRight className='h-3 w-3 shrink-0 text-muted-foreground' />
        )}
        <div className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ backgroundColor: character.color ?? '#888' }} />
        <span className='flex-1 truncate text-sm font-medium'>{character.name}</span>
        {character.status !== 'active' && (
          <Badge variant='secondary' className='text-[10px]'>
            {character.status}
          </Badge>
        )}
        {isPending && <span className='text-[10px] text-muted-foreground'>saving...</span>}
      </button>

      {isExpanded && (
        <div className='flex flex-col gap-3 border-t px-3 py-3'>
          {EDITABLE_FIELDS.map(({ key, label }) => (
            <label key={key} className='flex flex-col gap-1'>
              <span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>{label}</span>
              <Textarea
                defaultValue={character[key] ?? ''}
                onBlur={(e) => handleBlur(key, e.target.value)}
                rows={2}
                className='text-xs'
                placeholder={`No ${label.toLowerCase()} yet...`}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
