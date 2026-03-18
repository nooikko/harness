import type { ToolResult } from '@harness/plugin-contract';
import type { DevicePlaybackState } from './playback-controller';

export const formatQueueState = (state: DevicePlaybackState): ToolResult => {
  const lines: string[] = [];
  lines.push(`**Device:** ${state.device.name}`);
  lines.push(`**State:** ${state.playerState}`);
  lines.push(`**Radio:** ${state.radioEnabled ? 'on' : 'off'}`);

  if (state.currentTrack) {
    lines.push(`\n**Now Playing:** ${state.currentTrack.title} by ${state.currentTrack.artist}`);
  } else {
    lines.push('\n**Now Playing:** (nothing)');
  }

  if (state.queue.length > 0) {
    lines.push(`\n**Up Next (${state.queue.length}):**`);
    for (const [i, t] of state.queue.entries()) {
      lines.push(`  ${i + 1}. ${t.title} by ${t.artist}`);
    }
  } else {
    lines.push('\n**Up Next:** (empty)');
  }

  const text = lines.join('\n');

  return {
    text,
    blocks: [
      {
        type: 'now-playing',
        data: {
          deviceName: state.device.name,
          state: state.playerState,
          radioEnabled: state.radioEnabled,
          currentTrack: state.currentTrack
            ? {
                title: state.currentTrack.title,
                artist: state.currentTrack.artist,
                videoId: state.currentTrack.videoId,
              }
            : null,
          queue: state.queue.map((t) => ({
            title: t.title,
            artist: t.artist,
            videoId: t.videoId,
          })),
        },
      },
    ],
  };
};
