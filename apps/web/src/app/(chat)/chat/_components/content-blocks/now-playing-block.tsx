'use client';

import { Music, Pause, Play, Radio, Speaker } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type QueueItem = {
  title: string;
  artist: string;
  videoId?: string;
};

type NowPlayingBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const NowPlayingBlock: NowPlayingBlockComponent = ({ data }) => {
  const deviceName = (data.deviceName ?? 'Unknown device') as string;
  const state = (data.state ?? 'IDLE') as string;
  const radioEnabled = data.radioEnabled as boolean | undefined;
  const currentTrack = data.currentTrack as QueueItem | undefined;
  const queue = (data.queue ?? []) as QueueItem[];

  const isPlaying = state === 'PLAYING';
  const isPaused = state === 'PAUSED';

  return (
    <div className='rounded-md border border-border/40 bg-background overflow-hidden'>
      {/* Now playing header */}
      <div className='flex items-center gap-3 px-4 py-3 bg-muted/20'>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isPlaying ? 'bg-primary/10' : 'bg-muted'}`}>
          {isPlaying ? (
            <Play className='h-5 w-5 text-primary' />
          ) : isPaused ? (
            <Pause className='h-5 w-5 text-muted-foreground' />
          ) : (
            <Music className='h-5 w-5 text-muted-foreground/50' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          {currentTrack ? (
            <>
              <p className='truncate text-sm font-medium text-foreground'>{currentTrack.title}</p>
              <p className='truncate text-xs text-muted-foreground'>{currentTrack.artist}</p>
            </>
          ) : (
            <p className='text-sm text-muted-foreground/60 italic'>Nothing playing</p>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-2 text-xs text-muted-foreground'>
          <Speaker className='h-3 w-3' />
          <span className='truncate max-w-25'>{deviceName}</span>
        </div>
      </div>

      {/* Status bar */}
      <div className='flex items-center gap-3 border-t border-border/30 px-4 py-1.5 text-xs text-muted-foreground'>
        <span className={`inline-flex items-center gap-1 ${isPlaying ? 'text-primary' : ''}`}>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${isPlaying ? 'bg-primary animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`}
          />
          {state}
        </span>
        {radioEnabled !== undefined && (
          <span className='inline-flex items-center gap-1'>
            <Radio className='h-3 w-3' />
            Radio {radioEnabled ? 'on' : 'off'}
          </span>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className='border-t border-border/30 px-4 py-2'>
          <p className='mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground'>Up Next ({queue.length})</p>
          <div className='space-y-1'>
            {queue.slice(0, 8).map((item, i) => (
              <div key={i} className='flex items-center gap-2 text-xs'>
                <span className='w-4 shrink-0 text-right text-muted-foreground/50'>{i + 1}</span>
                <span className='truncate text-foreground/80'>
                  <span className='font-medium'>{item.title}</span>
                  <span className='text-muted-foreground'> — {item.artist}</span>
                </span>
              </div>
            ))}
            {queue.length > 8 && <p className='text-xs text-muted-foreground/50 pl-6'>+{queue.length - 8} more</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NowPlayingBlock;
