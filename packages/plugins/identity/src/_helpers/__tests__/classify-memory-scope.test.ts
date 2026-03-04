import { describe, expect, it } from 'vitest';
import { classifyMemoryScope } from '../classify-memory-scope';

describe('classifyMemoryScope', () => {
  describe('trusts valid Haiku classification', () => {
    it('returns THREAD when haikuScope is THREAD and threadId present', () => {
      expect(classifyMemoryScope({ haikuScope: 'THREAD', threadId: 'thread-1', projectId: 'proj-1' })).toBe('THREAD');
    });

    it('returns PROJECT when haikuScope is PROJECT and projectId present', () => {
      expect(classifyMemoryScope({ haikuScope: 'PROJECT', projectId: 'proj-1', threadId: 'thread-1' })).toBe('PROJECT');
    });

    it('returns AGENT when haikuScope is AGENT', () => {
      expect(classifyMemoryScope({ haikuScope: 'AGENT', projectId: 'proj-1', threadId: 'thread-1' })).toBe('AGENT');
    });

    it('handles case-insensitive haikuScope', () => {
      expect(classifyMemoryScope({ haikuScope: 'thread', threadId: 'thread-1' })).toBe('THREAD');
      expect(classifyMemoryScope({ haikuScope: 'project', projectId: 'proj-1' })).toBe('PROJECT');
      expect(classifyMemoryScope({ haikuScope: 'agent' })).toBe('AGENT');
    });
  });

  describe('downgrades when context is missing', () => {
    it('downgrades THREAD to PROJECT when threadId is absent but projectId present', () => {
      expect(classifyMemoryScope({ haikuScope: 'THREAD', projectId: 'proj-1' })).toBe('PROJECT');
    });

    it('downgrades THREAD to AGENT when both threadId and projectId are absent', () => {
      expect(classifyMemoryScope({ haikuScope: 'THREAD' })).toBe('AGENT');
    });

    it('downgrades PROJECT to AGENT when projectId is absent', () => {
      expect(classifyMemoryScope({ haikuScope: 'PROJECT' })).toBe('AGENT');
    });

    it('downgrades PROJECT to AGENT when projectId is null', () => {
      expect(classifyMemoryScope({ haikuScope: 'PROJECT', projectId: null })).toBe('AGENT');
    });
  });

  describe('fallback heuristic when haikuScope is missing or invalid', () => {
    it('returns PROJECT when projectId present and no haikuScope', () => {
      expect(classifyMemoryScope({ projectId: 'proj-1' })).toBe('PROJECT');
    });

    it('returns AGENT when no projectId and no haikuScope', () => {
      expect(classifyMemoryScope({})).toBe('AGENT');
    });

    it('returns AGENT when haikuScope is garbage string', () => {
      expect(classifyMemoryScope({ haikuScope: 'GLOBAL' })).toBe('AGENT');
    });

    it('returns AGENT when haikuScope is null', () => {
      expect(classifyMemoryScope({ haikuScope: null })).toBe('AGENT');
    });

    it('returns AGENT when threadId present but no projectId and no valid haikuScope', () => {
      expect(classifyMemoryScope({ threadId: 'thread-1' })).toBe('AGENT');
    });

    it('returns PROJECT when projectId present and haikuScope is invalid', () => {
      expect(classifyMemoryScope({ haikuScope: 'INVALID', projectId: 'proj-1' })).toBe('PROJECT');
    });
  });
});
