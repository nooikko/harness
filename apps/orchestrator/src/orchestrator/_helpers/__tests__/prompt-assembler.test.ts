import { describe, expect, it } from 'vitest';
import type { ThreadMeta } from '../prompt-assembler';
import { assemblePrompt } from '../prompt-assembler';

describe('assemblePrompt', () => {
  const baseMeta: ThreadMeta = {
    threadId: 'thread-abc',
    kind: 'general',
    name: undefined,
  };

  it('includes thread header with id and kind', () => {
    const { prompt } = assemblePrompt('hello', baseMeta);

    expect(prompt).toContain('[Thread: thread-abc | general]');
  });

  it('includes thread name in header when provided', () => {
    const meta: ThreadMeta = { ...baseMeta, name: 'Research Task' };

    const { prompt } = assemblePrompt('hello', meta);

    expect(prompt).toContain('[Thread: thread-abc | Research Task (general)]');
  });

  it('includes user message in a structured section', () => {
    const { prompt } = assemblePrompt('What is the weather?', baseMeta);

    expect(prompt).toContain('## User Message');
    expect(prompt).toContain('What is the weather?');
  });

  it('preserves multiline user messages', () => {
    const message = 'Line one\nLine two\nLine three';

    const { prompt } = assemblePrompt(message, baseMeta);

    expect(prompt).toContain('Line one\nLine two\nLine three');
  });

  it('returns thread metadata unchanged in the result', () => {
    const meta: ThreadMeta = {
      threadId: 'thread-xyz',
      kind: 'task',
      name: 'Build feature',
    };

    const { threadMeta } = assemblePrompt('do the thing', meta);

    expect(threadMeta).toEqual(meta);
  });

  describe('thread kind instructions', () => {
    it('includes primary thread instruction', () => {
      const meta: ThreadMeta = { ...baseMeta, kind: 'primary' };

      const { prompt } = assemblePrompt('hello', meta);

      expect(prompt).toContain('primary assistant');
      expect(prompt).toContain('proactive');
    });

    it('includes task thread instruction', () => {
      const meta: ThreadMeta = { ...baseMeta, kind: 'task' };

      const { prompt } = assemblePrompt('hello', meta);

      expect(prompt).toContain('delegated task');
      expect(prompt).toContain('focused');
    });

    it('includes cron thread instruction', () => {
      const meta: ThreadMeta = { ...baseMeta, kind: 'cron' };

      const { prompt } = assemblePrompt('hello', meta);

      expect(prompt).toContain('automated cron invocation');
      expect(prompt).toContain('scheduled task');
    });

    it('includes general thread instruction', () => {
      const meta: ThreadMeta = { ...baseMeta, kind: 'general' };

      const { prompt } = assemblePrompt('hello', meta);

      expect(prompt).toContain('general conversation thread');
    });

    it('falls back to general instruction for unknown kinds', () => {
      const meta: ThreadMeta = { ...baseMeta, kind: 'unknown-kind' };

      const { prompt } = assemblePrompt('hello', meta);

      expect(prompt).toContain('general conversation thread');
    });
  });

  describe('prompt structure', () => {
    it('places thread header before kind instruction', () => {
      const { prompt } = assemblePrompt('hello', baseMeta);
      const headerIdx = prompt.indexOf('[Thread:');
      const instructionIdx = prompt.indexOf('general conversation');

      expect(headerIdx).toBeLessThan(instructionIdx);
    });

    it('places kind instruction before user message', () => {
      const { prompt } = assemblePrompt('hello', baseMeta);
      const instructionIdx = prompt.indexOf('general conversation');
      const messageIdx = prompt.indexOf('## User Message');

      expect(instructionIdx).toBeLessThan(messageIdx);
    });

    it('separates sections with double newlines', () => {
      const { prompt } = assemblePrompt('hello', baseMeta);

      // Header, instruction, and message sections are separated by \n\n
      const sections = prompt.split('\n\n');
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });

    it('produces a non-empty prompt for empty messages', () => {
      const { prompt } = assemblePrompt('', baseMeta);

      expect(prompt).toContain('[Thread:');
      expect(prompt).toContain('## User Message');
    });
  });

  describe('output is ready for hook chain consumption', () => {
    it('returns a string prompt that can be passed to runChainHooks', () => {
      const { prompt } = assemblePrompt('test message', baseMeta);

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('includes all structural elements in the correct order', () => {
      const meta: ThreadMeta = {
        threadId: 't-123',
        kind: 'primary',
        name: 'Main Thread',
      };

      const { prompt } = assemblePrompt('Build a feature', meta);

      // All three structural elements present
      expect(prompt).toContain('[Thread: t-123 | Main Thread (primary)]');
      expect(prompt).toContain('primary assistant');
      expect(prompt).toContain('## User Message\n\nBuild a feature');
    });
  });
});
