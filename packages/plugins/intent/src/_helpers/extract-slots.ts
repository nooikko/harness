export type ExtractSlots = (utterance: string, intent: string) => Record<string, unknown>;

const ROOMS = [
  'office',
  'bedroom',
  'living room',
  'kitchen',
  'bathroom',
  'garage',
  'hallway',
  'dining room',
  'basement',
  'attic',
  'nursery',
  'studio',
  'den',
  'patio',
  'porch',
  'foyer',
  'loft',
];

const COLORS = ['red', 'blue', 'green', 'white', 'warm', 'cool', 'purple', 'orange', 'yellow', 'pink', 'cyan', 'magenta'];

const extractLightsSlots = (text: string): Record<string, unknown> => {
  const lower = text.toLowerCase();
  const slots: Record<string, unknown> = {};

  // Extract room
  const room = ROOMS.find((r) => lower.includes(r));
  if (room) {
    slots.room = room;
  }

  // Extract action
  if (/\b(turn\s+on|switch\s+on|enable)\b/.test(lower)) {
    slots.action = 'on';
  } else if (/\b(turn\s+off|switch\s+off|shut\s+(off|down)|disable)\b/.test(lower)) {
    slots.action = 'off';
  } else if (/\bdim\b/.test(lower)) {
    slots.action = 'on';
    slots.brightness = 30;
  } else if (/\bset\b/.test(lower)) {
    slots.action = 'on';
  } else {
    slots.action = 'toggle';
  }

  // Extract color
  const color = COLORS.find((c) => lower.includes(c));
  if (color) {
    slots.color = color;
  }

  // Extract brightness percentage
  const brightnessMatch = /(\d+)\s*%/.exec(lower);
  if (brightnessMatch?.[1]) {
    slots.brightness = Number.parseInt(brightnessMatch[1], 10);
  }

  return slots;
};

const extractMusicPlaySlots = (text: string): Record<string, unknown> => {
  const lower = text.toLowerCase();

  // Remove common prefixes to get the query
  const cleaned = lower
    .replace(/^(play|put on|listen to|queue|queue up)\s+/i, '')
    .replace(/\b(some|a|the)\b\s*/g, '')
    .replace(/\bmusic\b/g, '')
    .trim();

  if (cleaned.length === 0) {
    return {};
  }

  return { query: cleaned };
};

const extractMusicControlSlots = (text: string): Record<string, unknown> => {
  const lower = text.toLowerCase();

  if (/\bpause\b/.test(lower)) {
    return { action: 'pause' };
  }
  if (/\b(resume|unpause|continue)\b/.test(lower)) {
    return { action: 'resume' };
  }
  if (/\bstop\b/.test(lower)) {
    return { action: 'stop' };
  }
  if (/\b(skip|next)\b/.test(lower)) {
    return { action: 'skip' };
  }

  const volumeMatch = /\bvolume\b.*?(\d+)/.exec(lower);
  if (volumeMatch?.[1]) {
    return { action: 'volume', level: Number.parseInt(volumeMatch[1], 10) };
  }

  return {};
};

export const extractSlots: ExtractSlots = (utterance, intent) => {
  switch (intent) {
    case 'lights.control':
      return extractLightsSlots(utterance);
    case 'music.play':
      return extractMusicPlaySlots(utterance);
    case 'music.control':
      return extractMusicControlSlots(utterance);
    default:
      return {};
  }
};
