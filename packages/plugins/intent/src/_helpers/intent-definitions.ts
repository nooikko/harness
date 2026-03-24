import type { IntentDefinition } from './intent-registry';

/**
 * Known intent definitions for fast-path routing.
 * Each intent maps to a specific plugin tool with example utterances
 * that get pre-encoded as embeddings at startup.
 *
 * To add a new fast-path intent:
 * 1. Add an IntentDefinition here
 * 2. Add slot extraction logic in extract-slots.ts
 * 3. Add tool input mapping in map-slots-to-input.ts
 */
export const INTENT_DEFINITIONS: IntentDefinition[] = [
  {
    intent: 'lights.control',
    plugin: 'govee',
    tool: 'set_light',
    examples: [
      'turn on the office lights',
      'turn off the bedroom lights',
      'turn on the lights',
      'shut down the office',
      'set the office lights to red',
      'dim the bedroom lights',
      'turn off the kitchen',
      'lights on',
      'office lights off',
      'can you turn on the office',
      'set the living room to blue',
      'turn on the bedroom',
      'kill the lights',
      'switch off the office lights',
      'set lights to 50%',
    ],
  },
  {
    intent: 'lights.toggle',
    plugin: 'govee',
    tool: 'toggle_light',
    examples: ['toggle the office lights', 'toggle bedroom', 'flip the lights'],
  },
  {
    intent: 'music.play',
    plugin: 'music',
    tool: 'play',
    examples: [
      'play some jazz',
      'play lofi beats',
      'put on some music',
      'play a song',
      'play chill vibes',
      'can you play something relaxing',
      'play hip hop',
      'queue up some rock',
      'play taylor swift',
      'put on classical music',
      'play my playlist',
    ],
  },
  {
    intent: 'music.control',
    plugin: 'music',
    tool: 'pause',
    examples: [
      'pause the music',
      'stop playing',
      'resume playback',
      'skip this song',
      'next track',
      'set volume to 50',
      'turn it up',
      'turn down the volume',
      'mute',
      'stop the music',
    ],
  },
];
