import type { ToolResult } from '@harness/plugin-contract';

type LikedSong = {
  title: string;
  artist: string;
  videoId: string;
};

export const formatLikedSongs = (songs: LikedSong[]): ToolResult => {
  const lines = songs.map((s, i) => `${i + 1}. **${s.title}** by ${s.artist} (videoId: ${s.videoId})`);
  const text = `Liked songs (${songs.length}):\n\n${lines.join('\n')}`;

  return {
    text,
    blocks: [
      {
        type: 'music-search',
        data: {
          results: songs.map((s) => ({
            title: s.title,
            artist: s.artist,
            videoId: s.videoId,
          })),
        },
      },
    ],
  };
};
