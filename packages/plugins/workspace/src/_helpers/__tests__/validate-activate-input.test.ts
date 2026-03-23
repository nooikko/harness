import { describe, expect, it } from 'vitest';
import { validateActivateInput } from '../validate-activate-input';

const validInput = {
  objective: 'Get comprehensive test coverage for the delegation plugin',
  tasks: [
    {
      id: 't1',
      title: 'Unit tests for delegation helpers',
      description: 'Write unit tests covering all _helpers/ files',
      acceptanceCriteria: '80%+ line coverage, all edge cases',
    },
    {
      id: 't2',
      title: 'Integration tests',
      description: 'Full pipeline integration tests',
      dependsOn: ['t1'],
      acceptanceCriteria: 'All endpoints tested, no mocked DB',
    },
  ],
  reviewerTemplate:
    'You are a code reviewer. Create a worktree. Spawn worker agents. Review their output for quality. Run pre-commit checks. Report back.',
  workerTemplate:
    'You are an implementer. Work in the provided directory. Write the code for your assigned task. Commit when done. Your code must pass all pre-commit checks.',
  evalCriteria: 'Reject if coverage below 80%. Reject if no error handling tests. Reject if tests only cover happy path.',
};

describe('validateActivateInput', () => {
  it('accepts valid input', () => {
    const result = validateActivateInput(validInput);
    expect(result.valid).toBe(true);
  });

  it('rejects empty objective', () => {
    const result = validateActivateInput({ ...validInput, objective: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'objective')).toBe(true);
    }
  });

  it('rejects empty task list', () => {
    const result = validateActivateInput({ ...validInput, tasks: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'tasks')).toBe(true);
    }
  });

  it('rejects tasks with duplicate IDs', () => {
    const result = validateActivateInput({
      ...validInput,
      tasks: [
        {
          id: 't1',
          title: 'A',
          description: 'A',
          acceptanceCriteria: 'A',
        },
        {
          id: 't1',
          title: 'B',
          description: 'B',
          acceptanceCriteria: 'B',
        },
      ],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes('duplicate'))).toBe(true);
    }
  });

  it('rejects tasks with unresolvable dependencies', () => {
    const result = validateActivateInput({
      ...validInput,
      tasks: [
        {
          id: 't1',
          title: 'A',
          description: 'A',
          dependsOn: ['t99'],
          acceptanceCriteria: 'A',
        },
      ],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes('t99'))).toBe(true);
    }
  });

  it('rejects vague eval criteria', () => {
    const result = validateActivateInput({
      ...validInput,
      evalCriteria: 'Make it good.',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'evalCriteria')).toBe(true);
    }
  });

  it('rejects eval criteria that is too short', () => {
    const result = validateActivateInput({
      ...validInput,
      evalCriteria: 'OK',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes('too short'))).toBe(true);
    }
  });

  it('rejects reviewer template with code blocks', () => {
    const result = validateActivateInput({
      ...validInput,
      reviewerTemplate: 'Implement this:\n```typescript\nconst x = 1;\n```\nThen review.',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'reviewerTemplate')).toBe(true);
    }
  });

  it('rejects empty worker template', () => {
    const result = validateActivateInput({
      ...validInput,
      workerTemplate: '',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'workerTemplate')).toBe(true);
    }
  });

  it('accepts tasks with valid agent assignments', () => {
    const result = validateActivateInput({
      ...validInput,
      tasks: [
        {
          id: 't1',
          title: 'Backend tests',
          description: 'Test the API',
          acceptanceCriteria: 'Full coverage',
          agentId: 'agent-backend-123',
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
});
