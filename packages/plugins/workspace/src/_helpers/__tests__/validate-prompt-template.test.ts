import { describe, expect, it } from 'vitest';
import { validatePromptTemplate } from '../validate-prompt-template';

describe('validatePromptTemplate', () => {
  describe('reviewer template', () => {
    it('accepts a valid reviewer template', () => {
      const result = validatePromptTemplate({
        tier: 'reviewer',
        template:
          'You are a code reviewer. Create a worktree. Spawn worker agents for implementation. Review all worker output for quality and correctness. Run pre-commit checks. Report back with your assessment.',
      });

      expect(result.valid).toBe(true);
    });

    it('rejects reviewer template containing code blocks', () => {
      const result = validatePromptTemplate({
        tier: 'reviewer',
        template: 'You are a reviewer. Here is the implementation:\n```typescript\nconst foo = () => { return "bar"; };\n```\nMake sure this works.',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]?.field).toBe('reviewerTemplate');
        expect(result.errors[0]?.message).toContain('code');
      }
    });

    it('rejects reviewer template containing function declarations', () => {
      const result = validatePromptTemplate({
        tier: 'reviewer',
        template: 'You are a reviewer. Implement const handleSubmit = async () => { await db.save(); } and then review it.',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]?.message).toContain('implementation code');
      }
    });

    it('rejects empty reviewer template', () => {
      const result = validatePromptTemplate({
        tier: 'reviewer',
        template: '   ',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]?.message).toContain('empty');
      }
    });

    it('allows code-like references in reviewer template (file paths, tool names)', () => {
      const result = validatePromptTemplate({
        tier: 'reviewer',
        template:
          'You are a reviewer. Check the output of src/index.ts. Use workspace__report to submit findings. Ensure pre-commit checks pass in the worktree.',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('worker template', () => {
    it('accepts a valid worker template', () => {
      const result = validatePromptTemplate({
        tier: 'worker',
        template:
          'You are an implementer. Work in the provided directory. Write the code, commit when done. Your code must pass all pre-commit checks.',
      });

      expect(result.valid).toBe(true);
    });

    it('rejects worker template that is too short', () => {
      const result = validatePromptTemplate({
        tier: 'worker',
        template: 'Write code.',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]?.message).toContain('too short');
      }
    });

    it('rejects empty worker template', () => {
      const result = validatePromptTemplate({
        tier: 'worker',
        template: '',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]?.message).toContain('empty');
      }
    });
  });
});
