import type { MusicTrack } from './youtube-music-client';

export const formatSearchResults = (tracks: MusicTrack[]): string => {
  if (tracks.length === 0) {
    return 'No results found.';
  }

  const lines = tracks.map((t, i) => {
    const duration = t.durationText ?? '??:??';
    const album = t.album ? ` | Album: ${t.album}` : '';
    return `${i + 1}. **${t.title}** by ${t.artist} [${duration}]${album}\n   videoId: ${t.videoId}`;
  });

  return `Found ${tracks.length} result(s):\n\n${lines.join('\n\n')}`;
};
