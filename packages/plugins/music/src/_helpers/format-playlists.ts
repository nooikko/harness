import type { ToolResult } from '@harness/plugin-contract';

type PlaylistItem = {
  title: string;
  id: string;
};

export const formatPlaylists = (playlists: PlaylistItem[]): ToolResult => {
  const lines = playlists.map((p, i) => `${i + 1}. **${p.title}** (ID: ${p.id})`);
  const text = `Your playlists:\n\n${lines.join('\n')}`;

  return {
    text,
    blocks: [
      {
        type: 'music-search',
        data: {
          results: playlists.map((p) => ({
            title: p.title,
            artist: '',
            videoId: p.id,
          })),
        },
      },
    ],
  };
};
