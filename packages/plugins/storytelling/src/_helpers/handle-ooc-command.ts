import type { parseOocCommand } from './parse-ooc-command';

type OocCommand = ReturnType<typeof parseOocCommand>;

type HandleOocCommand = (
  command: OocCommand,
  db: {
    storyCharacter: {
      findFirst: (args: Record<string, unknown>) => Promise<{ id: string; name: string; aliases: string[]; personality?: string | null } | null>;
      update: (args: Record<string, unknown>) => Promise<unknown>;
    };
    storyLocation: {
      upsert: (args: Record<string, unknown>) => Promise<unknown>;
    };
    story: {
      update: (args: Record<string, unknown>) => Promise<unknown>;
    };
  },
  storyId: string,
) => Promise<string | null>;

export const handleOocCommand: HandleOocCommand = async (command, db, storyId) => {
  switch (command.type) {
    case 'rename': {
      const { from, to } = command.params;
      if (!from || !to) {
        return "Could not parse rename — use: rename 'old name' to 'new name'";
      }

      const character = await db.storyCharacter.findFirst({
        where: { storyId, name: { equals: from, mode: 'insensitive' } },
        select: { id: true, name: true, aliases: true },
      });

      if (!character) {
        return `Character "${from}" not found in this story.`;
      }

      await db.storyCharacter.update({
        where: { id: character.id },
        data: {
          name: to,
          aliases: { push: from },
        },
      });

      return `The author renamed "${from}" to "${to}".`;
    }

    case 'knowledge': {
      const { character, topic } = command.params;
      // Knowledge corrections are complex — for now, return a note for the AI to respect
      return character && topic ? `The author notes: ${character} doesn't know about ${topic}.` : 'Could not parse knowledge correction.';
    }

    case 'personality': {
      const { character: charName, trait } = command.params;
      if (!charName || !trait) {
        return 'Could not parse personality change — use: make [character] more/less [trait]';
      }

      const character = await db.storyCharacter.findFirst({
        where: { storyId, name: { equals: charName, mode: 'insensitive' } },
        select: { id: true, name: true, aliases: true, personality: true },
      });

      if (!character) {
        return `Character matching "${charName}" not found in this story.`;
      }

      const existing = character.personality ?? '';
      await db.storyCharacter.update({
        where: { id: character.id },
        data: {
          personality: `${existing}\nAuthor direction: ${trait}.`,
        },
      });

      return `The author adjusted ${character.name}'s personality: ${trait}.`;
    }

    case 'remove': {
      const { character: charName } = command.params;
      if (!charName) {
        return 'Could not parse remove — use: remove [character] from the story';
      }

      const character = await db.storyCharacter.findFirst({
        where: { storyId, name: { equals: charName, mode: 'insensitive' } },
        select: { id: true, name: true, aliases: true },
      });

      if (!character) {
        return `Character matching "${charName}" not found in this story.`;
      }

      await db.storyCharacter.update({
        where: { id: character.id },
        data: { status: 'departed' },
      });

      return `${character.name} has departed from the story.`;
    }

    case 'color': {
      return 'Color reassignment noted — this will be applied in a future update.';
    }

    case 'time': {
      const { time } = command.params;
      if (!time) {
        return "Could not parse time — use: it's now [time description]";
      }

      await db.story.update({
        where: { id: storyId },
        data: { storyTime: time },
      });

      return `Story time advanced to: ${time}.`;
    }

    case 'location': {
      const { location } = command.params;
      if (!location) {
        return "Could not parse location — use: we're at [location]";
      }

      await db.storyLocation.upsert({
        where: { storyId_name: { storyId, name: location } },
        create: { storyId, name: location },
        update: {},
      });

      return `Current location set to: ${location}.`;
    }
    default:
      return null;
  }
};
