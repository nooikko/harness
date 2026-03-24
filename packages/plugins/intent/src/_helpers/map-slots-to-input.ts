/**
 * Maps extracted slots to the tool input format expected by each plugin tool handler.
 */

export type MapSlotsToInput = (intent: string, tool: string, slots: Record<string, unknown>) => Record<string, unknown>;

export const mapSlotsToInput: MapSlotsToInput = (intent, tool, slots) => {
  switch (intent) {
    case 'lights.control': {
      const input: Record<string, unknown> = {};
      if (slots.room) {
        input.device = slots.room;
      }
      if (slots.action === 'on') {
        input.state = 'on';
      } else if (slots.action === 'off') {
        input.state = 'off';
      }
      if (slots.color) {
        input.color = slots.color;
      }
      if (slots.brightness !== undefined) {
        input.brightness = slots.brightness;
      }
      return input;
    }

    case 'lights.toggle': {
      const input: Record<string, unknown> = {};
      if (slots.room) {
        input.device = slots.room;
      }
      return input;
    }

    case 'music.play': {
      const input: Record<string, unknown> = {};
      if (slots.query) {
        input.query = slots.query;
      }
      return input;
    }

    case 'music.control': {
      // Map control actions to the appropriate music tool
      // The tool name is already resolved by the intent definition,
      // but we may need different tools for different actions
      if (slots.action === 'volume' && slots.level !== undefined) {
        return { volume: slots.level };
      }
      return {};
    }

    default:
      return slots;
  }
};

/**
 * Resolve the actual tool name for music.control intents,
 * since different actions map to different tools.
 */
export type ResolveMusicTool = (action: string) => string;

export const resolveMusicTool: ResolveMusicTool = (action) => {
  switch (action) {
    case 'pause':
      return 'pause';
    case 'resume':
      return 'resume';
    case 'stop':
      return 'stop';
    case 'skip':
      return 'skip';
    case 'volume':
      return 'set_volume';
    default:
      return 'pause';
  }
};
