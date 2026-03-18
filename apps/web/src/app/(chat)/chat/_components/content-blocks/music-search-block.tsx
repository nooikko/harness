'use client';

import { Disc3, Music } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type SearchResult = {
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  videoId?: string;
};

type MusicSearchBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const MusicSearchBlock: MusicSearchBlockComponent = ({ data }) => {
  const results = (data.results ?? []) as SearchResult[];
  const query = (data.query ?? '') as string;

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <Music className='h-3.5 w-3.5' />
        <span>
          {results.length} result{results.length !== 1 ? 's' : ''}
          {query && <span className='text-muted-foreground/50'> for &quot;{query}&quot;</span>}
        </span>
      </div>
      <div className='space-y-0.5'>
        {results.map((track, i) => (
          <div key={i} className='flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/20 transition-colors'>
            <span className='w-5 shrink-0 text-right text-xs text-muted-foreground/50'>{i + 1}</span>
            <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted'>
              <Disc3 className='h-4 w-4 text-muted-foreground/50' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-foreground'>{track.title}</p>
              <p className='truncate text-xs text-muted-foreground'>
                {track.artist}
                {track.album && <span> &middot; {track.album}</span>}
              </p>
            </div>
            {track.duration && <span className='shrink-0 text-xs text-muted-foreground/50'>{track.duration}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MusicSearchBlock;
