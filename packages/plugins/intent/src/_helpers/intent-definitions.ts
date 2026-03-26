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
      // Direct commands
      'turn on the office lights',
      'turn off the bedroom lights',
      'turn off the office',
      'turn on the bedroom',
      'shut down the office',
      'shut off the kitchen',
      'kill the office lights',
      'switch off the office lights',
      'office lights off',
      'office lights on',
      // Color and brightness
      'set the office lights to red',
      'set the living room to blue',
      'dim the bedroom lights',
      'set lights to 50%',
      // Conversational wrappers — natural speech patterns
      'can you turn on the office lights',
      'can you turn off the bedroom',
      'hey turn off the office lights',
      'hey turn on the kitchen lights',
      'turn off the office lights please',
      'turn off the lights in the office',
      'turn off the kitchen lights',
      'turn on the kitchen lights',
    ],
  },
  {
    intent: 'lights.toggle',
    plugin: 'govee',
    tool: 'toggle_light',
    examples: ['toggle the office lights', 'toggle bedroom', 'flip the lights', 'toggle the kitchen', 'flip the office lights'],
  },
  {
    intent: 'music.play',
    plugin: 'music',
    tool: 'play',
    examples: [
      // Direct commands
      'play some jazz',
      'play lofi beats',
      'put on some music',
      'play a song',
      'play chill vibes',
      'play hip hop',
      'queue up some rock',
      'play taylor swift',
      'put on classical music',
      'play my playlist',
      // Conversational wrappers
      'can you play something relaxing',
      'can you put on some music',
      'hey play some jazz',
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
