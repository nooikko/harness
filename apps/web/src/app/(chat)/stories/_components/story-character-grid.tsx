import { Badge } from '@harness/ui';
import { Users } from 'lucide-react';
import { listStoryCharacters } from '../../chat/_actions/list-story-characters';

type StoryCharacterGridProps = { storyId: string };
type StoryCharacterGridComponent = (props: StoryCharacterGridProps) => Promise<React.ReactNode>;

export const StoryCharacterGrid: StoryCharacterGridComponent = async ({ storyId }) => {
  const characters = await listStoryCharacters(storyId);

  if (characters.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center'>
        <Users className='h-8 w-8 text-muted-foreground/50' />
        <p className='text-sm text-muted-foreground'>Characters will appear here as the story unfolds.</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
      {characters.map((char) => (
        <div key={char.id} className='flex items-start gap-3 rounded-lg border p-3'>
          <div className='mt-1 h-3 w-3 shrink-0 rounded-full' style={{ backgroundColor: char.color ?? '#888' }} />
          <div className='flex min-w-0 flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <span className='truncate text-sm font-medium'>{char.name}</span>
              {char.status !== 'active' && (
                <Badge variant='secondary' className='text-[10px]'>
                  {char.status}
                </Badge>
              )}
            </div>
            {char.personality && <p className='line-clamp-1 text-xs text-muted-foreground'>{char.personality}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};
