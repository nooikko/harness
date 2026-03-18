import type { ToolResult } from '@harness/plugin-contract';
import type { MusicTrack } from './youtube-music-client';

export const formatSearchResults = (tracks: MusicTrack[], query?: string): ToolResult => {
  if (tracks.length === 0) {
    return 'No results found.';
  }

  const lines = tracks.map((t, i) => {
    const duration = t.durationText ?? '??:??';
    const album = t.album ? ` | Album: ${t.album}` : '';
    return `${i + 1}. **${t.title}** by ${t.artist} [${duration}]${album}\n   videoId: ${t.videoId}`;
  });

  const text = `Found ${tracks.length} result(s):\n\n${lines.join('\n\n')}`;

  return {
    text,
    blocks: [
      {
        type: 'music-search',
        data: {
          query,
          results: tracks.map((t) => ({
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.durationText,
            videoId: t.videoId,
          })),
        },
      },
    ],
  };
};
