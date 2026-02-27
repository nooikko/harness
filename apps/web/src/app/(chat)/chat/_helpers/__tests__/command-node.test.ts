import { createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';
import { CommandNode } from '../command-node';

// All Lexical node operations must run inside editor.update() or editor.read()
// because LexicalNode constructor calls $setNodeKey which requires an active editor.
const makeEditor = () =>
  createEditor({
    nodes: [CommandNode],
    onError: (err) => {
      throw err;
    },
  });

const runInEditor = <T>(fn: () => T): Promise<T> => {
  const editor = makeEditor();
  return new Promise<T>((resolve, reject) => {
    editor.update(
      () => {
        try {
          resolve(fn());
        } catch (err) {
          reject(err);
        }
      },
      { discrete: true },
    );
  });
};

describe('CommandNode', () => {
  describe('getType', () => {
    it('returns command-mention', () => {
      // Static method — no editor context needed
      expect(CommandNode.getType()).toBe('command-mention');
    });
  });

  describe('clone', () => {
    it('creates a new CommandNode with same trigger, value, and data', async () => {
      const cloned = await runInEditor(() => {
        const original = new CommandNode('/', 'current-time', { extra: 'val' });
        return CommandNode.clone(original);
      });

      expect(cloned).toBeInstanceOf(CommandNode);
      expect((cloned as unknown as Record<string, unknown>).__trigger).toBe('/');
      expect((cloned as unknown as Record<string, unknown>).__value).toBe('current-time');
      expect((cloned as unknown as Record<string, unknown>).__data).toStrictEqual({ extra: 'val' });
    });

    it('handles undefined data', async () => {
      const cloned = await runInEditor(() => {
        const original = new CommandNode('/', 'delegate');
        return CommandNode.clone(original);
      });
      expect((cloned as unknown as Record<string, unknown>).__data).toBeUndefined();
    });
  });

  describe('importJSON', () => {
    it('creates a CommandNode from a serialized node', async () => {
      const node = await runInEditor(() =>
        CommandNode.importJSON({
          trigger: '/',
          value: 'delegate',
          data: { foo: 'bar' },
          type: 'beautifulMention',
          version: 1,
        }),
      );

      expect(node).toBeInstanceOf(CommandNode);
      expect((node as unknown as Record<string, unknown>).__trigger).toBe('/');
      expect((node as unknown as Record<string, unknown>).__value).toBe('delegate');
    });

    it('handles missing data field', async () => {
      const node = await runInEditor(() =>
        CommandNode.importJSON({
          trigger: '/',
          value: 'current-time',
          type: 'beautifulMention',
          version: 1,
        }),
      );
      expect(node).toBeInstanceOf(CommandNode);
    });
  });

  describe('exportJSON', () => {
    it('returns type command-mention', async () => {
      const json = await runInEditor(() => new CommandNode('/', 'current-time').exportJSON());
      expect(json.type).toBe('command-mention');
    });

    it('includes trigger and value', async () => {
      const json = await runInEditor(() => new CommandNode('/', 'model').exportJSON());
      expect(json.trigger).toBe('/');
      expect(json.value).toBe('model');
    });

    it('includes data when present', async () => {
      const json = await runInEditor(() => new CommandNode('/', 'checkin', { key: 'val' }).exportJSON());
      expect((json as Record<string, unknown>).data).toStrictEqual({ key: 'val' });
    });
  });

  describe('component', () => {
    it('returns a non-null React component', async () => {
      const Comp = await runInEditor(() => new CommandNode('/', 'current-time').component());
      expect(Comp).not.toBeNull();
      expect(typeof Comp).toBe('function');
    });
  });
});
