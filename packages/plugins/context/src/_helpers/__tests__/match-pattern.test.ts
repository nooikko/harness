import { describe, expect, it } from 'vitest';
import { matchPattern } from '../match-pattern';

describe('matchPattern', () => {
  describe('wildcard (*)', () => {
    it('matches any filename with extension', () => {
      expect(matchPattern('memory.md', '*.md')).toBe(true);
      expect(matchPattern('world-state.md', '*.md')).toBe(true);
    });

    it('does not match files with different extension', () => {
      expect(matchPattern('notes.txt', '*.md')).toBe(false);
    });

    it('does not match files in subdirectories', () => {
      expect(matchPattern('sub/file.md', '*.md')).toBe(false);
    });

    it('matches prefix patterns', () => {
      expect(matchPattern('draft-notes.md', 'draft-*')).toBe(true);
      expect(matchPattern('final-notes.md', 'draft-*')).toBe(false);
    });
  });

  describe('double wildcard (**)', () => {
    it('matches files at any depth', () => {
      expect(matchPattern('sub/file.md', '**/*.md')).toBe(true);
      expect(matchPattern('a/b/c/file.md', '**/*.md')).toBe(true);
    });

    it('matches files in root directory too', () => {
      expect(matchPattern('file.md', '**/*.md')).toBe(true);
    });

    it('matches everything with **', () => {
      expect(matchPattern('anything.txt', '**')).toBe(true);
      expect(matchPattern('a/b/c.md', '**')).toBe(true);
    });
  });

  describe('question mark (?)', () => {
    it('matches single character', () => {
      expect(matchPattern('a.md', '?.md')).toBe(true);
      expect(matchPattern('ab.md', '?.md')).toBe(false);
    });
  });

  describe('dot-prefixed patterns', () => {
    it('matches hidden files with dot prefix pattern', () => {
      expect(matchPattern('.hidden', '.*')).toBe(true);
      expect(matchPattern('.gitignore', '.*')).toBe(true);
    });

    it('does not match non-hidden files', () => {
      expect(matchPattern('visible.md', '.*')).toBe(false);
    });
  });

  describe('complex patterns', () => {
    it('matches draft files', () => {
      expect(matchPattern('notes.draft.md', '*.draft.md')).toBe(true);
      expect(matchPattern('notes.md', '*.draft.md')).toBe(false);
    });

    it('exact match works', () => {
      expect(matchPattern('memory.md', 'memory.md')).toBe(true);
      expect(matchPattern('other.md', 'memory.md')).toBe(false);
    });
  });
});
