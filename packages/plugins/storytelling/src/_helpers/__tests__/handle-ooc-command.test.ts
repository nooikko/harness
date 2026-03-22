import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOocCommand } from '../handle-ooc-command';

type MockDb = {
  storyCharacter: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  storyLocation: {
    upsert: ReturnType<typeof vi.fn>;
  };
  story: {
    update: ReturnType<typeof vi.fn>;
  };
};

type HandleOocDb = Parameters<typeof handleOocCommand>[1];

type CreateMockDb = () => MockDb & HandleOocDb;

const createMockDb: CreateMockDb = () =>
  ({
    storyCharacter: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    storyLocation: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    story: {
      update: vi.fn().mockResolvedValue({}),
    },
  }) as unknown as MockDb & HandleOocDb;

describe('handleOocCommand', () => {
  let db: MockDb & HandleOocDb;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('rename', () => {
    it('renames a character and pushes old name to aliases', async () => {
      db.storyCharacter.findFirst.mockResolvedValue({
        id: 'char-1',
        name: 'the cheerleader',
        aliases: [],
      });

      const result = await handleOocCommand({ type: 'rename', params: { from: 'the cheerleader', to: 'Mikenze' } }, db, 'story-1');

      expect(result).toBe('The author renamed "the cheerleader" to "Mikenze".');
      expect(db.storyCharacter.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: {
          name: 'Mikenze',
          aliases: { push: 'the cheerleader' },
        },
      });
    });

    it('returns error when character not found', async () => {
      const result = await handleOocCommand({ type: 'rename', params: { from: 'nobody', to: 'someone' } }, db, 'story-1');

      expect(result).toContain('not found');
    });

    it('returns error when from/to params are empty', async () => {
      const result = await handleOocCommand({ type: 'rename', params: { from: '', to: '' } }, db, 'story-1');

      expect(result).toContain('Could not parse');
    });
  });

  describe('remove', () => {
    it('sets character status to departed', async () => {
      db.storyCharacter.findFirst.mockResolvedValue({
        id: 'char-2',
        name: 'The Innkeeper',
        aliases: [],
      });

      const result = await handleOocCommand({ type: 'remove', params: { character: 'innkeeper' } }, db, 'story-1');

      expect(result).toContain('departed');
      expect(db.storyCharacter.update).toHaveBeenCalledWith({
        where: { id: 'char-2' },
        data: { status: 'departed' },
      });
    });

    it('returns error when character not found', async () => {
      const result = await handleOocCommand({ type: 'remove', params: { character: 'ghost' } }, db, 'story-1');

      expect(result).toContain('not found');
    });
  });

  describe('time', () => {
    it('updates story storyTime', async () => {
      const result = await handleOocCommand({ type: 'time', params: { time: 'midnight' } }, db, 'story-1');

      expect(result).toBe('Story time advanced to: midnight.');
      expect(db.story.update).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        data: { storyTime: 'midnight' },
      });
    });

    it('returns error when time param is empty', async () => {
      const result = await handleOocCommand({ type: 'time', params: { time: '' } }, db, 'story-1');

      expect(result).toContain('Could not parse');
    });
  });

  describe('location', () => {
    it('upserts a story location', async () => {
      const result = await handleOocCommand({ type: 'location', params: { location: 'the tavern' } }, db, 'story-1');

      expect(result).toBe('Current location set to: the tavern.');
      expect(db.storyLocation.upsert).toHaveBeenCalledWith({
        where: { storyId_name: { storyId: 'story-1', name: 'the tavern' } },
        create: { storyId: 'story-1', name: 'the tavern' },
        update: {},
      });
    });

    it('returns error when location param is empty', async () => {
      const result = await handleOocCommand({ type: 'location', params: { location: '' } }, db, 'story-1');

      expect(result).toContain('Could not parse');
    });
  });

  describe('knowledge', () => {
    it('returns a note about the knowledge correction', async () => {
      const result = await handleOocCommand({ type: 'knowledge', params: { character: 'Elena', topic: 'the betrayal' } }, db, 'story-1');

      expect(result).toContain('Elena');
      expect(result).toContain('the betrayal');
    });
  });

  describe('personality', () => {
    it('appends personality direction to character with existing personality', async () => {
      db.storyCharacter.findFirst.mockResolvedValue({
        id: 'char-3',
        name: 'Elena',
        aliases: [],
        personality: 'Kind and thoughtful',
      });

      const result = await handleOocCommand({ type: 'personality', params: { character: 'Elena', trait: 'more aggressive' } }, db, 'story-1');

      expect(result).toContain('more aggressive');
      expect(db.storyCharacter.update).toHaveBeenCalledWith({
        where: { id: 'char-3' },
        data: {
          personality: 'Kind and thoughtful\nAuthor direction: more aggressive.',
        },
      });
    });

    it('sets personality direction when character has no existing personality', async () => {
      db.storyCharacter.findFirst.mockResolvedValue({
        id: 'char-3',
        name: 'Elena',
        aliases: [],
        personality: null,
      });

      const result = await handleOocCommand({ type: 'personality', params: { character: 'Elena', trait: 'more cautious' } }, db, 'story-1');

      expect(result).toContain('more cautious');
      expect(db.storyCharacter.update).toHaveBeenCalledWith({
        where: { id: 'char-3' },
        data: {
          personality: '\nAuthor direction: more cautious.',
        },
      });
    });
  });

  describe('color', () => {
    it('returns a note about future color reassignment', async () => {
      const result = await handleOocCommand({ type: 'color', params: { characters: 'Elena' } }, db, 'story-1');

      expect(result).toContain('future update');
    });
  });

  describe('unknown', () => {
    it('returns null for unknown commands', async () => {
      const result = await handleOocCommand({ type: 'unknown', params: {} }, db, 'story-1');

      expect(result).toBeNull();
    });
  });
});
