import { describe, expect, it } from 'vitest';
import { buildRubricPrompt } from '../build-rubric-prompt';

describe('buildRubricPrompt', () => {
  const baseParams = {
    taskPrompt: 'Write a summary of the quarterly earnings report.',
    result: 'The earnings report shows a 15% revenue increase.',
    iteration: 1,
    maxIterations: 3,
  };

  it('contains the task prompt text', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain(baseParams.taskPrompt);
  });

  it('contains the result text', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain(baseParams.result);
  });

  it('contains the iteration number', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain('iteration 1 of 3');
  });

  it('contains VERDICT: PASS instruction', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain('VERDICT: PASS');
  });

  it('contains VERDICT: FAIL instruction', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain('VERDICT: FAIL');
  });

  it('reflects different iteration values correctly', () => {
    const prompt = buildRubricPrompt({ ...baseParams, iteration: 2, maxIterations: 5 });
    expect(prompt).toContain('iteration 2 of 5');
  });

  it('includes all four rubric questions', () => {
    const prompt = buildRubricPrompt(baseParams);
    expect(prompt).toContain('Q1.');
    expect(prompt).toContain('Q2.');
    expect(prompt).toContain('Q3.');
    expect(prompt).toContain('Q4.');
  });
});
